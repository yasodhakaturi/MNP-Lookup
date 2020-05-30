var express = require('express');
var router = express.Router();

/* GET api page. */
router.get('/', function(req, res, next) {
  res.send('respond with a api');
});

/* GET api page. */
router.get('/mnp-lookup', function(req, res, next) {
  res.send('respond with a api');
});

module.exports = router;
