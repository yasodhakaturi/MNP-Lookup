const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;
const providerRequestor =  require('../common/provider.requests');

const requesteddataSchema = new Schema({
  requested_data: {
    type: String,
    required: [true, 'Requested Date can not be null!']
  },
  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users'
  },
  requested_ip:{
    type: String,
  },
  hook_url: {
    type: String
  },
  ignore_web_hook: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['new_request', 'inprogress', 'partial', 'completed', 'error']
  },
  dispatched_count:Number,
  received_count:Number,
  type: {
    type: String,
    enum: ['sync', 'async'],
    default: 'sync'
  },
  provider_request:{
    type:Boolean,
    default: false
  },
  provider_response:{
    type:String
  },
  requested_on: {
    type: Date,
    default: function() {
      return Date.now();
    }
  },
});

const RequestData = mongoose.model('Requests', requesteddataSchema);
const mnp_response_model = require('../models/response_data_model');

const _ = require('lodash');

exports.model = RequestData;

exports.createSyncRequest = (req) => {
  return new Promise((resolve, reject) => {
    let reqData = {
      requested_data:req.params.mobile_number,
      received_count:1,
      dispatched_count:0,
      requested_by: req.user,
      requested_ip: req.clientIp,
      type:'sync',
      status: 'inprogress'
    }
    const requestedData = new RequestData(reqData);

    const err = requestedData.validateSync();
    if(err){
      console.log("Error at createSyncRequest",err)
    }
    if(requestedData){
      requestedData.save().then((err, u) => {

        //TODO: look if the response available for this mobile number in last 28 days.
        // if found send the same response if not fetch from provider.

        mnp_response_model.getMNPBYMobileNumber(req.params.mobile_number).then((mnpData)=>{
          if(mnpData.length > 0){
            console.log('found in DB', req.params.mobile_number);
            requestedData.provider_request = false;
            requestedData.dispatched_count = 1;
            requestedData.status = 'completed';
            requestedData.save();
            resolve(_.castArray(mnpData));
          }else{
            console.log('fetching from provider', req.params.mobile_number);
            providerRequestor.doSyncMnpRequest(req.params.mobile_number).then((resp)=>{
              requestedData.dispatched_count = 1;
              requestedData.provider_request = true;
              requestedData.provider_response = JSON.stringify({raw: resp.response});
              requestedData.status = 'completed';
              requestedData.save();
              resolve(resp.mappedRows);
            }).catch((err)=>{
              requestedData.provider_request = true;
              requestedData.status = 'error';
              requestedData.provider_response = err.message;
              requestedData.save();
              err.statusCode = 500
              err.errorMessage = err.message;
              resolve(err);
            })
          }
        }, (err)=>{
          console.log("Error at mnp data frm DB for mobile number: " + req.params.mobile_number ,err)

          console.log('fetching from provider', req.params.mobile_number)
          providerRequestor.doSyncMnpRequest(req.params.mobile_number).then((resp)=>{
            requestedData.dispatched_count = 1;
            requestedData.provider_request = true;
            requestedData.provider_response = JSON.stringify({raw: resp.response});
            requestedData.status = 'completed';
            requestedData.save();
            resolve(resp.mappedRows);
          }).catch((err2)=>{
            requestedData.provider_request = true;
            requestedData.status = 'error';
            requestedData.provider_response = err.message;
            requestedData.save();
            err2.statusCode = 500
            err2.errorMessage = err.message;
            resolve(err2);
          })
        })

      }).catch((err)=>{
        console.log("Error at createSyncRequest requested data",err)

        err.statusCode = 500
        err.errorMessage = err.message;

        resolve(err);
      });
    }

  });
};

exports.createAsyncRequest = (req) => {
  return new Promise((resolve, reject) => {
    let validNumbers = _.uniq(req.processedData.valid || [])
    let reqData = {
      requested_data:validNumbers.join(','),
      received_count:validNumbers.length,
      requested_by: req.user,
      requested_ip: req.clientIp,
      dispatched_count:0,
      type:'async',
      hook_url: req.body.hook_url || "",
      ignore_web_hook: !!req.body.ignore_web_hook,
      status: 'new_request'
    }
    const requestedData = new RequestData(reqData);
    let err = requestedData.validateSync();
    if(err){
      console.log("Error at createSyncRequest",err)
    }
    if(requestedData){
      requestedData.save((err, u) => {
        // if (err) return handleError(err);
        if (err) {
          console.log("Error at createASyncRequest requestedData",err)
          err.statusCode = 500
          err.errorMessage = err.errmsg;
          resolve(err);
        } else {
          resolve(u);
        }
      });
    }

  });
  // const user = new User(userData);
  // return user.save();
};

exports.findByStatus = (statusmode) => {
  return new Promise((resolve, reject) => {
    RequestData.find({ status: statusmode }, function (err, result) {
      if (err) reject(err);
      //result = result.toJSON();
      //delete result._id;
      //delete result.__v;
      resolve(result);
    });
  })
};

exports.findByBatchStatus= (batch_id, statusmode) => {
  return new Promise((resolve, reject) => {
    statusmode = statusmode.split('|')
    if(statusmode.length > 1){
      RequestData.findOne({$or: [
            { status: statusmode[0], '_id': batch_id },
            { status: statusmode[1], '_id': batch_id }
          ]}, function (err, result) {
        if (err) reject(err);
        //result = result.toJSON();
        //delete result._id;
        //delete result.__v;
        resolve(result);
      });
    }else{
      RequestData.findOne({ status: statusmode[0], '_id': batch_id }, function (err, result) {
        if (err) reject(err);
        //result = result.toJSON();
        //delete result._id;
        //delete result.__v;
        resolve(result);
      });
    }

  })
};
