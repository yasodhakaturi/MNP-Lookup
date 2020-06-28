const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;
const _ = require('lodash');
const logSchema = new Schema({
  log: {
    type: String
  },
  type: {
    type: String
  },
  category: {
    type: String
  },
  logged_on: {
    type: Date,
    default: function() {
      return Date.now();
    }
  }
});

const Logs = mongoose.model('Logs', logSchema);

exports.model = Logs;

exports.log = (msg, type, category) => {

  let message = ""
  try{
    if(_.isString(msg)){
      message = msg.toString();
    }else{
      message = JSON.stringify({'msg': msg})
    }
  }catch(e){
    message = "failed to parse msg";
    console.log("failed to parse msg", msg, type, category)
  }

  return new Promise((resolve, reject) => {
    const log = new Logs({log: message, type:type, category:category});
    const err = log.validateSync();
    if(log){
      log.save().then((u) => {
        resolve(u);
      }).catch((e)=>{
        resolve(e);
      });
    }
  });
};

