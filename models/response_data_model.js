const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;
const _ = require('lodash');
var ENV = require('../common/config');

const responseDataSchema = new Schema({
  mobile_number: {
    type: String,
    required: [true, 'mobile number can not be empty!'],
    index: true
  },
  mnp_data: {
    type: mongoose.Schema.Types.Mixed
  },
  job_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requests',
    required: false
  },

  status: {
    type: String,
    enum: ['new', 'processed', 'submitted']
  },
  received_date: {
    type: Date,
    default: function() {
      return Date.now();
    }
  }
});

const ResponseData = mongoose.model('Responses', responseDataSchema);

exports.model = ResponseData;

exports.getMNPBYMobileNumber = (mobilenumber, days = ENV.AGE_SPAN) => {
  return new Promise((resolve, reject) => {
    if(_.isArray(mobilenumber)){
      ResponseData.find({
        "mobile_number":
          {
            $in: mobilenumber
          },
        "received_date":
          {
            $gte: new Date((new Date().getTime() - (days * 24 * 60 * 60 * 1000)))
          }
      }).sort({"received_date": -1}).exec(function (err, results) {
        if (err) reject(err);
        if (results.length > 0) {
          let rows = [];
          _.each(results, (result) => {
            result = result.toJSON();
            delete result._id;
            delete result.__v;
            rows.push(result);
          });
          rows = _.uniqBy(rows, (r)=>{return r.mobile_number;});
          resolve(rows);
        } else {
          resolve([]);
        }
      });
    }else {
      ResponseData.findOne({
        "mobile_number": mobilenumber, "received_date":
          {
            $gte: new Date((new Date().getTime() - (days * 24 * 60 * 60 * 1000)))
          }
      }).sort({"received_date": -1}).exec(function (err, result) {
        if (err) reject(err);
        if (result) {
          result = result.toJSON();
          delete result._id;
          delete result.__v;
          resolve(_.castArray(result));
        } else {
          resolve([]);
        }
      });
    }
  })
};
