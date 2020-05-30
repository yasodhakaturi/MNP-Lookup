var express = require('express');
var router = express.Router();

/* GET /users listing. */
router.get('/user-details', function(req, res, next) {
  res.send('respond with a user resource with when properly authenticated');
});

// /* PUT /users/login listing. */
// router.get('/generate-api-key', function(req, res, next) {
//   res.send('respond with a user resource with when properly authenticated');
// });

module.exports = router;
