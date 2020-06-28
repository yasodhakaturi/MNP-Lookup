const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;
const RequestQueue = require('./processed_data_model')

const mnpRequestsSchema = new Schema({
  req_ids: {
    type: [mongoose.Schema.Types.ObjectId],
    ref:'RequestQueues',
    default: undefined
  },
  receive_batch_ids: {
    type: [mongoose.Schema.Types.ObjectId],
    ref:'Requests',
    default: undefined
  },
  req_payload:{
    type:Array
  },
  bulk_id:{
    type: String
  },
  response:{
    status: Number,
    response:String,
    received_on:Date,
    bulk_id:String
  },

  status: {
    type: String,
    enum: ['new','requested', 'received','available', 'inprogress', 'failed'],
    default:'new'
  },
  submitted_date: {
    type: Date
  }
});

const MNPRequestData = mongoose.model('MnpRequests', mnpRequestsSchema);

exports.model = MNPRequestData;

exports.getBatchStatusDetails = (batch) => {
  return new Promise((resolve, reject) => {
    resolve([])
    // MNPRequestData.find({receive_batch_ids: batch._id}, function (err, result) {
    //   if (err) reject(err);
    //   //result = result.toJSON();
    //   //delete result._id;
    //   //delete result.__v;
    //   resolve(_.map(result, 'response'));
    // });
    //
  })
}
exports.findByStatus = (status, limit) => {
  return new Promise((resolve, reject) => {
    MNPRequestData.find({status:status}).limit(parseInt(limit)).exec( function (err, results) {
      if (err) reject(err);
      resolve(results);
    });
  })
}
