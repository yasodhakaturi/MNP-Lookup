const mongoose = require('../common/services/mongoose.service').mongoose;
const Schema = mongoose.Schema;

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
  companyNmae: {
    type: String
  },
  permissionLevel: {
    type: Number,
    required: true
  },
  apikey:{
    type: String,
    required: [true, 'API Key is Required!']
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
    console.log(err, user)
    if(user){
      user.save((err, u) => {
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

