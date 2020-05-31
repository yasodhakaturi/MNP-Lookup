const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

const requesteddataSchema = new Schema({
  Requesteddata: {
    type: String,
    required: [true, 'RequestedDate can not be null!']
},
    RequestedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'users'
 },
  Status:{
        type:string,
    enum:['newrequest','inprogress','completed','submitted'],
    required: function() {
        return this.bacon > 5
    }
    }
});
