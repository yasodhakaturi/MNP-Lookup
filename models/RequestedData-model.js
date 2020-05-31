const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const requesteddataSchema = new Schema({
  requested_data: {
    type: String,
    required: [true, 'Requested Date can not be null!']
  },
  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users'
  },
  status: {
    type: string,
    enum: ['new_request', 'inprogress', 'completed', 'submitted']

  }
});

const RequestData = mongoose.model('RequestData', requesteddataSchema);

exports.model = RequestData;
