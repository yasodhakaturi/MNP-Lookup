var express = require('express');
var router = express.Router();

var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

/* GET api page. */
router.get('/', function(req, res, next) {
  res.send('Your are accessing MNP-lookup services');
});

/* GET api/authenticate page. */
router.get('/authenticate', function(req, res, next) {
  res.send('This service validates the api-key in the headers');
});

/* GET api/authenticate page. */
router.post('/MNP-Lookup', function(req, res, next) {
  passport.authenticate('headerapikey', { session: false, failureRedirect: '/api/unauthorized' }),
  res.send('This service validates the api-key in the headers and creates a MNP-lookup for a request.');
});

module.exports = router;
