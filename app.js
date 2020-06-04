var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var sassMiddleware = require('node-sass-middleware');
const _ = require('lodash')
var ENV = require('./common/config');
const cron = require("node-cron");
var forceSsl = require('express-force-ssl');
const requestIp = require('request-ip');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var apiRouter = require('./routes/api');
const jobs=require('./middleware/jobs/jobs');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));

// if(ENV.NODE_ENV === 'production') {
//   app.use(forceSsl);
// }

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sassMiddleware({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  indentedSyntax: true, // true = .sass and false = .scss
  sourceMap: true
}));

app.use(requestIp.mw())

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  res.header('Access-Control-Expose-Headers', 'Content-Length');
  res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
  if (req.method === 'OPTIONS') {
    return res.send(200);
  } else {
    return next();
  }
});

app.use(express.static(path.join(__dirname, 'public')));


app.use('/', indexRouter);
app.use('/api', apiRouter);
// app.use('/account', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = ENV.NODE_ENV === 'DEVELOPMENT' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



// schedule tasks to be run on the server
cron.schedule("* * * * *", function() {
  // console.log("---------------------");
  // console.log("Running Process Queue Cron Job");
  // fs.unlink("./error.log", err => {
  //   if (err) throw err;
  //   console.log("Error file succesfully deleted");
  // });
  jobs.requestedDataToQueue('new_request').then((result) =>{
    if(result && result.length){
      console.log("processed queue:", _.map(result, 'mobile_number'))
    }
  }).catch((err)=>{
    console.log(err)
  });
});


// schedule tasks to be run on the server
cron.schedule("* * * * *", function() {
  // console.log("---------------------");
  // console.log("Running Fetcher Cron Job");
  // fs.unlink("./error.log", err => {
  //   if (err) throw err;
  //   console.log("Error file succesfully deleted");
  // });


  setTimeout(function() {
    jobs.requestedQueueToFetcher('new_request', parseInt(ENV.FETCH_SIZE || 10)).then((result) =>{
      if(result && result.length){
        console.log("fetch requested:", _.map(result, 'mobile_number'))
      }
    }).catch((err)=>{
      console.log(err)
    });
  }, 10000);
});


module.exports = app;
