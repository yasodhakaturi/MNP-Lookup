const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;
const _ = require('lodash');
const userSchema = new Schema({
  firstName: {
    type: String,
    required: [true, 'First Name is Required!']
  },
  lastName: {
    type: String
  },
  email: {
    type: String,
    required: [true, 'Email is Required!'],
    unique: true
  },
  password: {
    type: String,
    required: [true, 'Password is Required!']
  },
  companyName: {
    type: String
  },
  isActive:{
    type: Boolean,
    default:false,
  },
  isTrail:{
    type: Boolean,
    default:true,
  },
  requestedCount:{
    type: Number,
    default:0
  },
  allowedLimit:{
    type: Number,
    default:0
  },
  permissionLevel: {
    type: Number,
    required: true
  },
  apikey:{
    type: String,
    required: [true, 'API Key is Required!']
  },
  allowIpAddress:{
    type: String,
    default: '*'
  },
  created_on: {
    type: Date,
    default: function() {
      return Date.now();
    }
  }
});

userSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are serialised.
userSchema.set('toJSON', {
  virtuals: true
});

const User = mongoose.model('Users', userSchema);

exports.model = User;

exports.findByApiKey = (id) => {
  return new Promise((resolve, reject) => {
    User.findOne({ apikey: id }, function (err, result) {
      if (err) reject(err);
      result = result.toJSON();
      delete result._id;
      delete result.__v;
      resolve(result);
    });
    // User.find({apiKey: id}, (err, result) => {
    //   if (err) reject(err);
    //     result = result.toJSON();
    //     delete result._id;
    //     delete result.__v;
    //       resolve(result);
    //   });
    })
};

exports.createUser = (userData) => {
  return new Promise((resolve, reject) => {
    const user = new User(userData);
    const err = user.validateSync();
    if(user){
      user.save().then((u) => {
        resolve(u);
      }).catch((e)=>{
        console.log("failed to create user", e)
        if(e.code == 11000){
          e.statusCode = 422
          e.errorMessage = "User Already Exists!"
        }else{
          e.statusCode = 500
          e.errorMessage = err.errmsg || "failed to create user"
        }
        resolve(e);
      });
    }

  });
  // const user = new User(userData);
  // return user.save();
};

exports.updateUserIps = (ips, id) => {
  return new Promise((resolve, reject) => {
    User.findById(id, function (err, user) {
      if (err) reject(err);
      user.allowIpAddress = ips.allowIpAddress;
      user.save(function (err, updatedUser) {
        if (err) return reject(err);
        resolve(updatedUser);
      });
    });
  })
};
exports.updateAllowedLimit = (obj, id) => {
  return new Promise((resolve, reject) => {
    User.findById(id, function (err, user) {
      if (err) reject(err);

      if(!_.isUndefined(obj.allowedLimit)){
        user.allowedLimit = obj.allowedLimit;
      }

      if(!_.isUndefined(obj.isTrail)){
        user.isTrail = obj.isTrail;
      }

      if(!_.isUndefined(obj.isActive)){
        user.isActive = obj.isActive;
      }

      user.save(function (err, updatedUser) {
        if (err) return reject(err);
        resolve(updatedUser);
      });
    });
  })
};

exports.updateApiKey = (key, id) => {
  return new Promise((resolve, reject) => {
    User.findById(id, function (err, user) {
      if (err) reject(err);
      user.apikey = key.apikey;
      user.save(function (err, updatedUser) {
        if (err) return reject(err);
        resolve(updatedUser);
      });
    });
  })
};

exports.getUserDetailsBy = (key, val) => {
  return new Promise((resolve, reject) => {
    let q = {}
    q[key] = val;
    User.findOne(q, function (err, user) {
      if (err) reject(err);
      resolve(user || []);
    });
  })
};


exports.removeById = (userId) => {
  return new Promise((resolve, reject) => {
    User.remove({_id: userId}, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(err);
      }
    });
  });
};

exports.patchUser = (id, userData) => {
  return new Promise((resolve, reject) => {
    User.findById(id, function (err, user) {
      if (err) reject(err);
      for (let i in userData) {
        user[i] = userData[i];
      }
      user.save(function (err, updatedUser) {
        if (err) return reject(err);
        resolve(updatedUser);
      });
    });
  })

};

