const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const responseDataSchema = new Schema({
  mobile_number: {
    type: String,
    required: [true, 'mobile number can not be empty!'],
  },
  mnp_data: {
    type: mongoose.Schema.Types.Mixed
  },
  job_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requests',
    default:undefined
  },

  status: {
    type: String,
    enum: ['new', 'processed', 'submitted']
  },
  received_date: {
    type: Date,
    default: Date.now()
  }
});

const ResponseData = mongoose.model('Responses', responseDataSchema);

exports.model = ResponseData;
