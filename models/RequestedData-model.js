const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const requesteddataSchema = new Schema({
  requesteddata: {
    type: String,
    required: [true, 'RequestedDate can not be null!']
},
    requestedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'users'
 },
  status:{
        type:string,
    enum:['newrequest','inprogress','completed','submitted']
   
    }
});
