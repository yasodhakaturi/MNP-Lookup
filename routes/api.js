var express = require('express');
var router = express.Router();
const crypto = require('crypto');
const uuidAPIKey = require('uuid-apikey');
const UserModel = require('../models/users_model');
let _ = require('lodash');

// var ValidationMiddleware = require('../middleware/verify.user.middleware');


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
      }else if(req.processedData.valid && req.processedData.valid.length > 1 && !req.body.hook_url){
        //when no web hook found in request
        req.processedData.error = {"statusCode": 422, error: "Wrong data: No hook URL found"}
      }
    }

    next()
  }
}

/* GET api page. */
router.get('/', function(req, res, next) {
  res.send('Your are accessing MNP-lookup services');
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
    console.log(req.processedData);
    if(req.processedData.error){
      res.status(req.processedData.error.statusCode);
      res.json({status:"error", message: req.processedData.error.error});
    }else {
      res.json({status:"Success", batch_id: 'Batch Id', valid_numbers: req.processedData.valid, invalid_numbers: req.processedData.invalid});
    }
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
