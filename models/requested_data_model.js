const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const requesteddataSchema = new Schema({
  requested_data: {
    type: String,
    required: [true, 'Requested Date can not be null!']
  },
  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users'
  },
  hook_url: {
    type: String
  },
  status: {
    type: String,
    enum: ['new_request', 'inprogress', 'completed', 'submitted']
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


exports.createRequest = (req) => {
  return new Promise((resolve, reject) => {
    let reqData = {
      requested_data:req.processedData.valid.join(','),
      requested_by: req.user,
      hook_url: req.body.hook_url || "",
      status: 'new_request'
    }
    const requestedData = new RequestData(reqData);
    const err = requestedData.validateSync();
    console.log(err, requestedData)
    if(requestedData){
      requestedData.save((err, u) => {
        // if (err) return handleError(err);
        if (err) {
          console.log(err)
          if(err.code == 11000){
            err.statusCode = 422
            err.errorMessage = "User Already Exists!"
          }else{
            err.statusCode = 500
            err.errorMessage = err.errmsg
          }
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
