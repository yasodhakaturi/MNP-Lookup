const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const responsedataSchema = new Schema({
    mobilenumber:{
        type:Number,
        required: [true, 'mobilenumber can not be empty!'],
    },
    responsedata:{
type:String,
required:[true,'response data cant be empty!']

    },
    batchid:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'requesteddata'
    },
    
    status:{
        type:String,
        enum:['newrequest','inprogress','completed','submitted']
    },
    submittedate:{
        type:Date
        
    }
    });