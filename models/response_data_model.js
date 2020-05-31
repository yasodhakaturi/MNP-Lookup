const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const responsedataSchema = new Schema({
  mobile_number: {
    type: Number,
    required: [true, 'mobilenumber can not be empty!'],
  },
  response_data: {
    type: String,
    required: [true, 'response data cant be empty!']

  },
  batch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RequestData'
  },

  status: {
    type: String,
    enum: ['new_request', 'inprogress', 'completed', 'submitted']
  },
  submitte_date: {
    type: Date

  }
});

const ResponseData = mongoose.model('ResponseData', responsedataSchema);

exports.model = ResponseData;
