const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const processeddataSchema = new Schema({
    batchid:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'requesteddata'
    },
    mobilenumber:{
        type:String,
        required: [true, 'mobilenumber can not be empty!']
    },
    webhook:{
        type:String
    },
    status:{
        type:String,
        enum:['newrequest','inprogress','completed','submitted']
    },
    jobid:{
    type:Number
}
});