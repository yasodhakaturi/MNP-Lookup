var express = require('express');
const crypto = require('crypto');
const uuidAPIKey = require('uuid-apikey');
const _ = require('lodash');
const rateLimit = require("express-rate-limit");

const UserModel = require('../models/users_model');
const RequestDataModel = require('../models/requested_data_model');
const MnpRequestModel = require('../models/mnp_requests_model');

const jobs= require('../middleware/jobs/jobs');
const mnpResponseMapping = require('../common/response.mapping');
const dispatcher = require('../common/response.dispatcher');

var router = express.Router();

var passport = require('passport'),
  HeaderAPIKeyStrategy = require('passport-headerapikey').HeaderAPIKeyStrategy;

passport.use(new HeaderAPIKeyStrategy(
  { header: 'Authorization', prefix: 'Api-Key ' },
  false,
  function(apikey, done) {
    UserModel.model.findOne({ apikey: apikey }, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      return done(null, user, { scope: 'all' });
    })
  }

));

const requestDataValidator = function (options) {
  return function (req, res, next) {
    // Implement the middleware function based on the options objectr
    req.processedData = {valid:[], invalid:[]}

    if(!req.body.numbers || req.body.numbers.length == 0){
      // no numbers requested
      req.processedData.error = {"statusCode": 422, error: "Wrong data: No numbers found"}
    }else if(!_.isArray(req.body.numbers)){
      req.processedData.error = {"statusCode": 422, error: "Wrong data: Numbers should be in a array"}
    }else if(!req.body.hook_url){
      req.processedData.error = {"statusCode": 422, error: "Wrong data: No web hook URL found"}
    }else{
      _.each(req.body.numbers, (number)=>{
        if((_.startsWith(number, '971') && number.length == 12)){
          req.processedData.valid.push(number);
        }else{
          req.processedData.invalid.push(number);
        }
      })
      if(req.processedData.valid && req.processedData.valid.length == 0){
        req.processedData.error = {"statusCode": 422, error: "Wrong data: No valid numbers found"}
      // }else if(req.processedData.valid && req.processedData.valid.length > 1 && !req.body.hook_url){
      //   //when no web hook found in request
      //   req.processedData.error = {"statusCode": 422, error: "Wrong data: No hook URL found"}
      }
    }

    next()
  }
};

const jobIdIdentifier = function(){
  return function (req, res, next){
    MnpRequestModel.model.findOne({ _id: req.params.job_id }, function (err, job) {
      if (err) { return next(err); }
      if (!job) { return next(null, false); };
      req.job = job;
      return next(null, job, { scope: 'all' });
    })
  }
}

//TODO: skip the count if the requested mobile number data is already exists.
const requestLimiter = rateLimit({
  windowMs: .5 * 60 * 1000, // 30 sec window
  max: 3, // start 3 blocking after  requests
  message: {error:"Reached the limit on number concurrent requests per user, please try again after 30 seconds, or use Async Service without a limit on concurrent requests."},
  keyGenerator: function (req ) {
    return req.user._id;
  },
  skipFailedRequests:true,
});


/* GET api page. */
router.get('/', function(req, res, next) {
  res.send('Your are accessing MNP-lookup services');
});

/* GET sample api to test provide api . */
router.post('/test', function(req, res, next) {
  // jobs.requestedDataToQueue('new_request').then((result) =>{
  //   res.json(result);
  // }).catch((err)=>{
  //   res.json(err);
  // });

  console.log(req.data);
  console.log(req.headers);
  console.log('----------------');

  res.status(200);
  res.json({
    "results":[
      {
        "error":{
          "groupId":0,
          "name":"string",
          "id":0,
          "description":"string",
          "permanent":true,
          "groupName":"string"
        },
        "roamingNetwork":{
          "networkName":"string",
          "networkPrefix":"string",
          "countryPrefix":"string",
          "countryName":"string"
        },
        "mccMnc":"string",
        "imsi":"123123123",
        "status":{
          "groupName":"string",
          "action":"string",
          "groupId":0,
          "name":"string",
          "id":0,
          "description":"string"
        },
        "roaming":true,
        "originalNetwork":{
          "networkName":"string",
          "networkPrefix":"string",
          "countryPrefix":"string",
          "countryName":"string"
        },
        "portedNetwork":{
          "networkName":"string",
          "networkPrefix":"string",
          "countryPrefix":"string",
          "countryName":"string"
        },
        "ported":true,
        "to":"string",
        "servingMSC":"string"
      }
    ],
    "bulkId":"string"
  });

});

/* POST api/authenticate page. */
router.post('/authenticate',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  function(req, res, next) {

    res.send('This service validates the api-key in the headers');
});


/* GET api/unauthorized calls when header api key is not authorized page. */
router.get('/unauthorized', function(req, res, next) {
  res.json({ message: "Unauthorized request." })
});


router.post('/MNP-Lookup',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  requestDataValidator(),
  function(req, res) {

    if(req.processedData.error){
      res.status(req.processedData.error.statusCode);
      res.json({status:"error", message: req.processedData.error.error});
    }else {
      // res.json({status:"Success", batch_id: 'Batch Id', valid_numbers: req.processedData.valid, invalid_numbers: req.processedData.invalid});
      // RequestDataModel
      RequestDataModel.createAsyncRequest(req)
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage })
          }else{
            res.status(200);
            res.json({status:"Processing",batch_id: result._id, valid_numbers: result.requested_data.split(','), invalid_numbers: req.processedData.invalid});
          }
        });
    }
  });

//todo;
router.get('/MNP-Lookup/:mobile_number',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  requestLimiter,
  function(req, res){
    if(req.params.mobile_number && (_.startsWith(req.params.mobile_number, '971') && req.params.mobile_number.length == 12)){
      RequestDataModel.createSyncRequest(req)
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage });
            result.status = 'error'
            result.save();
          }else{

            res.status(200);
            res.json({status:"Success", results: result});
          }
        });
    }else{
      res.status(422);
      res.json({status:"error", message: "Invalid mobile number"});
    }
  });

router.post('/receiver/:job_id',
  jobIdIdentifier(),
  function(req, res){
  console.log("Web-hook data received", req.body)
    if(req.body.results && req.body.results.length > 0){
      mnpResponseMapping.saveMapping(req.body.results, req.job).then((mnp_data)=>{
        //todo: call the respective Hooks and send data;
        console.log(dispatcher.dispatcherService(req.job, mnp_data))
      })
    }
  res.status(200);
  res.json({status:"received"});
});


/* POST api/authenticate page. */
router.post('/user',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  function(req, res, next) {

    let email = req.body.email || "";
    let password = req.body.password || "";
    let firstName = req.body.first_name || "";
    let lastName = req.body.last_name || "";
    let companyName = req.body.company_name || "";
    let permissionLevel = 100;
    let apikey = uuidAPIKey.create().apiKey;
    let createdBy = req.user._id;
    if(req.user.permissionLevel == 100){
      res.status(401);
      res.json({status:"error",message: "UnAuthorized"});
    }else if(!email){
      res.status(422);
      res.json({status:"error",message: "Email Required"});
    }else if(!password){
      res.status(422);
      res.json({status:"error",message: "Password Required"});
    }else if(!firstName){
      res.status(422);
      res.json({status:"error",message: "First Name Required"});
    }else{
      let salt = crypto.randomBytes(16).toString('base64');
      let hash = crypto.createHmac('sha512', salt).update(req.body.password || "sample").digest("base64");
      req.body.password = salt + "$" + hash;
      req.body.permissionLevel = 1;
      console.log(`user ${email} created by ${req.user.email}`)
      UserModel.createUser({email,password,firstName,lastName, companyName, permissionLevel, apikey})
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage })
          }else{
            res.status(201);
            res.json({status:"Success",id: result._id});
          }
        });
    }

  });

//
// const UsersController = require('./controllers/users.controller');
// const PermissionMiddleware = require('../common/middlewares/auth.permission.middleware');
// const ValidationMiddleware = require('../common/middlewares/auth.validation.middleware');
// const config = require('../common/config/env.config');
//
// const ADMIN = config.permissionLevels.ADMIN;
// const PAID = config.permissionLevels.PAID_USER;
// const FREE = config.permissionLevels.NORMAL_USER;
//
// exports.routesConfig = function (app) {
//   app.post('/users', [
//     UsersController.insert
//   ]);
//   app.get('/users', [
//     ValidationMiddleware.validJWTNeeded,
//     PermissionMiddleware.minimumPermissionLevelRequired(PAID),
//     UsersController.list
//   ]);
//   app.get('/users/:userId', [
//     ValidationMiddleware.validJWTNeeded,
//     PermissionMiddleware.minimumPermissionLevelRequired(FREE),
//     PermissionMiddleware.onlySameUserOrAdminCanDoThisAction,
//     UsersController.getById
//   ]);
//   app.patch('/users/:userId', [
//     ValidationMiddleware.validJWTNeeded,
//     PermissionMiddleware.minimumPermissionLevelRequired(FREE),
//     PermissionMiddleware.onlySameUserOrAdminCanDoThisAction,
//     UsersController.patchById
//   ]);
//   app.delete('/users/:userId', [
//     ValidationMiddleware.validJWTNeeded,
//     PermissionMiddleware.minimumPermissionLevelRequired(ADMIN),
//     UsersController.removeById
//   ]);
// };
//
//


//
// /* GET api/authenticate page. */
// router.post('/MNP-Lookup', function(req, res, next) {
//   passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
//   res.send('This service validates the api-key in the headers and creates a MNP-lookup for a request.');
// });

module.exports = router;
