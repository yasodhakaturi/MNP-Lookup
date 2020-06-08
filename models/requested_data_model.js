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
  requested_on: {
    type: Date,
    default: function() {
      return Date.now();
    }
  },
});

const RequestData = mongoose.model('Requests', requesteddataSchema);


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
        providerRequestor.doSyncMnpRequest(req.params.mobile_number).then((mappedRows)=>{
          requestedData.dispatched_count = 1;
          requestedData.status = 'completed';
          requestedData.save();
          resolve(mappedRows);
        }).catch((err)=>{
          err.statusCode = 500
          err.errorMessage = err.message;
          resolve(err);
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
    let reqData = {
      requested_data:req.processedData.valid.join(','),
      received_count:req.processedData.valid.length,
      requested_by: req.user,
      requested_ip: req.clientIp,
      dispatched_count:0,
      type:'async',
      hook_url: req.body.hook_url || "",
      status: 'new_request'
    }
    const requestedData = new RequestData(reqData);
    const err = requestedData.validateSync();
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
