const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const processeddataSchema = new Schema({
  batch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requests'
  },
  mobile_number: {
    type: String,
    required: [true, 'mobile number can not be empty!']
  },
  web_hook: {
    type: String
  },
  status: {
    type: String,
    enum: ['new_request', 'inprogress', 'completed', 'submitted']
  },
  job_id: {
    type: Number
  }
});

const RequestQueue = mongoose.model('RequestQueues', processeddataSchema);

exports.model = RequestQueue;
