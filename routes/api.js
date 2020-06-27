var express = require('express');
const crypto = require('crypto');
const uuidAPIKey = require('uuid-apikey');
const _ = require('lodash');
const rateLimit = require("express-rate-limit");
var ipRangeCheck = require("ip-range-check");

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

const trailValidateCountUpdate = function(type){
  return function (req, res, next) {
    let user = req.user;
    if(!req.processedData){
      req.processedData = {valid:[], invalid:[]}
    }
    if(user.isActive){
      if(user.isTrail){
        let requestedCount = user.requestedCount;
        let allowedLimit = user.allowedLimit;
        let currentRequestNumbers = 0;
        if(type == 'SYNC'){

          if(req.params.mobile_number && (_.startsWith(req.params.mobile_number, '971') && req.params.mobile_number.length == 12)){
            currentRequestNumbers = 1;
            if(allowedLimit < (currentRequestNumbers + requestedCount)){
              req.processedData.error = {"statusCode": 403, error: "Trail Limit reached, please contact administrator."}
            }
          }else{
            req.processedData.error = {"statusCode": 422, error: "Invalid mobile number"}
          }
        }else if(type == 'ASYNC'){
          currentRequestNumbers = req.processedData.valid.length;
          if(allowedLimit < (currentRequestNumbers + requestedCount)){
            req.processedData.error = {"statusCode": 403, error: `Trail Limit will exceed with number of valid numbers, you have ${allowedLimit - requestedCount} credits left, please contact administrator.`}
          }
        }
      }else{
        let requestedCount = user.requestedCount;
        let allowedLimit = user.allowedLimit;
        let currentRequestNumbers = 0;
        if(type == 'SYNC'){
          if(req.params.mobile_number && (_.startsWith(req.params.mobile_number, '971') && req.params.mobile_number.length == 12)){
            currentRequestNumbers = 1;
            if(allowedLimit < (currentRequestNumbers + requestedCount)){
              req.processedData.error = {"statusCode": 403, error: "Requests limit reached, please contact administrator."}
            }
          }else{
            req.processedData.error = {"statusCode": 422, error: "Invalid mobile number"}
          }
        }else if(type == 'ASYNC'){
          currentRequestNumbers = req.processedData.valid.length;
          if(allowedLimit < (currentRequestNumbers + requestedCount)){
            req.processedData.error = {"statusCode": 403, error: `Requests Limit will exceed with number of valid numbers, you have ${allowedLimit - requestedCount} credits left, please contact administrator.`}
          }
        }
      }
    }else{
      req.processedData.error = {"statusCode": 403, error: "User is Inactive, Please contact administrator."}
    }
    next()
  }
}

const jobIdIdentifier = function(){
  return function (req, res, next){
    MnpRequestModel.model.findOne({ _id: req.params.job_id }, function (err, job) {
      if (err) { return next(err); }
      if (!job) { return next(null, false); };
      req.job = job;
      return next(null, job, { scope: 'all' });
    })
  }
};

const IPValidator = function(){
  return function (req, res, next){

    let user = req.user;
    let userAllowedIps = (user.allowIpAddress || '*').split(',');
    if(userAllowedIps && userAllowedIps.length > 0 && userAllowedIps[0] != '*'){
      req.isIpAllowed = ipRangeCheck(req.clientIp, userAllowedIps)
      console.log("IP Validator: ",req.clientIp, userAllowedIps, req.isIpAllowed)
    }else {
      req.isIpAllowed = true;
    }

    next();
  }
};

const batchIdIdentifier = function(){
  return function (req, res, next){
    RequestDataModel.model.findOne({ _id: req.params.batch_id }, function (err, batch) {
        if (err) { return next(err); }
      if (!batch) { return next(null, false); };
      req.batch = batch;
      return next(null, batch, { scope: 'all' });
    })
  }
};

//TODO: skip the count if the requested mobile number data is already exists.
const requestLimiter = rateLimit({
  windowMs: 1 * 1000, // 30 sec window
  max: 50, // start 3 blocking after  requests
  message: {error:"Reached the limit of 5 concurrent requests per user. you use Async Service without a limit on concurrent requests."},
  keyGenerator: function (req ) {
    return req.user._id;
  },
  skipFailedRequests:true,
});


/* GET api page. */
router.get('/', function(req, res, next) {
  res.send('Welcome to Mobilytics.me MNP services');
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
  IPValidator(),
  requestDataValidator(),
  trailValidateCountUpdate('ASYNC'),
  function(req, res) {

    if(!req.isIpAllowed){
      res.status(403);
      res.json({status:"error", message: 'Not allowed, IP mismatch, please contact our administrator.'});
    }else if(req.processedData.error){
      res.status(req.processedData.error.statusCode);
      res.json({status:"error", message: req.processedData.error.error});
    }else{
      // res.json({status:"Success", batch_id: 'Batch Id', valid_numbers: req.processedData.valid, invalid_numbers: req.processedData.invalid});
      // RequestDataModel
      RequestDataModel.createAsyncRequest(req)
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage })
          }else{
            let validNumbers = result.requested_data.split(',')
            res.status(200);
            res.json({status:"Processing",batch_id: result._id, valid_numbers: validNumbers, invalid_numbers: req.processedData.invalid});
            req.user.requestedCount = req.user.requestedCount + validNumbers.length;
            req.user.save();
          }
        });
    }
  });

router.get('/MNP-Lookup/:mobile_number',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  IPValidator(),
  requestLimiter,
  trailValidateCountUpdate('SYNC'),
  function(req, res){
    if(!req.isIpAllowed){
      res.status(403);
      res.json({status:"error", message: 'Not allowed, IP mismatch, please contact our administrator.'});
    }if(req.processedData.error){
      res.status(req.processedData.error.statusCode);
      res.json({status:"error", message: req.processedData.error.error});
    }else if(req.params.mobile_number && (_.startsWith(req.params.mobile_number, '971') && req.params.mobile_number.length == 12)){
      RequestDataModel.createSyncRequest(req)
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage });
            result.status = 'error'
            result.save();
          }else{

            res.status(200);
            res.json({status:"Success", results: _.map(result, _.partialRight(_.pick, ['mobile_number', "mnp_data"]))});
            req.user.requestedCount = req.user.requestedCount + 1;
            req.user.save();
          }
        });
    }else{
      res.status(422);
      res.json({status:"error", message: "Invalid mobile number"});
    }
  });

router.post('/receiver/:job_id',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  jobIdIdentifier(),
  function(req, res){
  console.log("Web-hook data received", req.body)
    if(req.body.results && req.body.results.length > 0){
      mnpResponseMapping.saveMapping(req.body.results, req.job).then((mnp_data)=>{
        //todo: call the respective Hooks and send data;
        dispatcher.dispatcherService(req.job, mnp_data)
      })
    }
  res.status(200);
  res.json({status:"received"});
});

router.post('/test-web-hook',
  function(req, res){
  console.log("test web hook for testing data received", req.body)
  res.status(200);
  res.json({status:""});
})

//todo: get the request batch status
router.get('/MNP-Lookup-Status/:batch_id',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  batchIdIdentifier(),
  function(req, res){
  console.log("service to get the status of batch requested", req.body)
  if(!req.batch || !req.batch._id){
    res.status(404);
    res.json({error:"Error: Sorry we're not able to identify the batch number provided"});
  }else {
    let batch = req.batch;
    MnpRequestModel.getBatchStatusDetails(batch).then((details)=>{
      res.status(200);
      res.json({batch_id:req.params.batch_id, batch_details:{
          "requested": batch.requested_data,
          "dispatched": batch.dispatched_count,
          "dispatched_details": details || [],
          "status": batch.status
        }});
    }).catch(()=>{
      res.status(200);
      res.json({batch_id:req.params.batch_id, batch_details:{
          "requested": batch.requested_data,
          "dispatched": batch.dispatched_count,
          "dispatched_details":{"error": "failed to fetch dispatched details"},
          "status": batch.status
        }});
    })

  }
})


/* POST api/user page. */
router.post('/user',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  function(req, res, next) {

    let email = req.body.email || "";
    let password = req.body.password || "";
    let firstName = req.body.first_name || "";
    let lastName = req.body.last_name || "";
    let companyName = req.body.company_name || "";
    let allowIpAddress = req.body.allowed_ips || "*";
    let isActive = !!req.body.is_active;
    let isTrail = !!req.body.is_trail;
    let allowedLimit =  req.body.allowed_credits || (!!req.body.is_trail ? 15 : 100000);

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
      password = salt + "$" + hash;

      console.log(`user ${email} created by ${req.user.email}`)
      UserModel.createUser({email,password,firstName,lastName, companyName, permissionLevel, apikey, allowIpAddress, isTrail, allowedLimit, isActive})
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage })
          }else{
            res.status(201);
            res.json({status:"Success",id: result._id, details:{
                first_name: result.firstName,
                last_name: result.lastName,
                company_name: result.companyName,
                email: result.email,
                api_key: result.apikey,
                is_active: result.isActive,
                is_trail: result.isTrail,
                used_credits:result.requestedCount,
                allowed_credits:result.allowedLimit
              } });
          }
        });
    }

  });

/* GET api/user/:userid details. */
router.get('/user',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  function(req, res, next) {
    var key = req.query.key;
    var val = req.query.val;
    if(key == 'email' && val){
      key = 'email'
    }else if(key == 'api_key' && val){
      key = 'apikey'
    }else if(key == 'id' && val){
      key = '_id'
    }else{
      res.status(401);
      res.json({status:"error",message: "UnAuthorized"});
    }

    if(req.user.permissionLevel == 100){
      res.status(401);
      res.json({status:"error",message: "UnAuthorized"});
    }else{

      UserModel.getUserDetailsBy(key, val)
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage })
          }else{
            res.status(201);
            res.json({status:"Success",id: result._id, details:{
                first_name: result.firstName,
                last_name: result.lastName,
                company_name: result.companyName,
                email: result.email,
                api_key: result.apikey,
                allowed_ips:result.allowIpAddress,
                is_active: result.isActive,
                is_trail: result.isTrail,
                used_credits:result.requestedCount,
                allowed_credits:result.allowedLimit
              } });
          }
        });
    }

  });

/* POST api/user/:userid page. */
router.patch('/user/:user_id/update_ips',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  function(req, res, next) {

    let allowIpAddress = req.body.allowed_ips || "*";
    let userId = req.params.user_id;
    if(req.user.permissionLevel == 100){
      res.status(401);
      res.json({status:"error",message: "UnAuthorized"});
    }else{

      UserModel.updateUserIps({allowIpAddress}, userId)
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage })
          }else{
            res.status(201);
            res.json({status:"Success",id: result._id, details:{
                first_name: result.firstName,
                last_name: result.lastName,
                company_name: result.companyName,
                email: result.email,
                api_key: result.apikey,
                allowed_ips:result.allowIpAddress,
                is_active: result.isActive,
                is_trail: result.isTrail,
                used_credits:result.requestedCount,
                allowed_credits:result.allowedLimit
              } });
          }
        });
    }

  });

/* POST api/user/:userid/update_credits page. */
router.patch('/user/:user_id/update_credits',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  function(req, res, next) {

    let obj = {};
    if(!_.isUndefined(req.body.allowed_credits)){
      obj.allowedLimit = +req.body.allowed_credits;
    }

    if(!_.isUndefined(req.body.is_trail)){
      obj.isTrail = !!req.body.is_trail;
    }

    if(!_.isUndefined(req.body.is_active)){
      obj.isActive = !!req.body.is_active;
    }

    let userId = req.params.user_id;
    if(req.user.permissionLevel == 100){
      res.status(401);
      res.json({status:"error",message: "UnAuthorized"});
    } else if(_.keys(obj).length == 0){
      res.status(422);
      res.json({status:"error",message: "Invalid request"});
    }else{

      UserModel.updateAllowedLimit(obj, userId)
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage })
          }else{
            res.status(201);
            res.json({status:"Success",id: result._id, details:{
                first_name: result.firstName,
                last_name: result.lastName,
                company_name: result.companyName,
                email: result.email,
                api_key: result.apikey,
                allowed_ips:result.allowIpAddress,
                is_active: result.isActive,
                is_trail: result.isTrail,
                used_credits:result.requestedCount,
                allowed_credits:result.allowedLimit
              } });
          }
        });
    }

  });

/* POST api/user/:userid page. */
router.patch('/user/:user_id/reset_api_key',
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  function(req, res, next) {

    let userId = req.params.user_id;
    if(req.user.permissionLevel == 100){
      res.status(401);
      res.json({status:"error",message: "UnAuthorized"});
    }else{
      let apikey = uuidAPIKey.create().apiKey;
      UserModel.updateApiKey({apikey}, userId)
        .then((result) => {
          if(result.errorMessage){
            res.status(result.statusCode)
            res.json({ error: result.errorMessage })
          }else{
            res.status(201);
            res.json({status:"Success",id: result._id, details:{
                first_name: result.firstName,
                last_name: result.lastName,
                company_name: result.companyName,
                email: result.email,
                api_key: result.apikey,
                allowed_ips:result.allowIpAddress,
                is_active: result.isActive,
                is_trail: result.isTrail,
                used_credits:result.requestedCount,
                allowed_credits:result.allowedLimit
              } });
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
