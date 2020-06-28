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
var morgan = require('morgan')

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

app.use(morgan('combined'));

app.use(require('express-status-monitor')(  {
    title: 'MNP Status',  // Default title
    theme: 'default.css',     // Default styles
    path: '/health-status',
    spans: [{
      interval: 1,            // Every second
      retention: 60           // Keep 60 datapoints in memory
    }, {
      interval: 5,            // Every 5 seconds
      retention: 60
    }, {
      interval: 15,           // Every 15 seconds
      retention: 60
    }],
    chartVisibility: {
      cpu: true,
      mem: true,
      load: true,
      eventLoop: true,
      heap: true,
      responseTime: true,
      rps: true,
      statusCodes: true
    },
    healthChecks: [],
    ignoreStartsWith: '/admin'
  }
))

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


let isMainCluster = parseInt(process.env.NODE_APP_INSTANCE) === 0;

if (isMainCluster || ENV.NODE_ENV === 'development') {

  console.log('Configured Jobs in Main Cluster', process.env.NODE_APP_INSTANCE)
// schedule tasks to be run on the server
  cron.schedule("* * * * *", function() {
    jobs.requestedDataToQueue('new_request').then((result) =>{
      if(result && result.length){
        console.log("processed queue:", _.map(result, 'mobile_number'))
      }
    }).catch((err)=>{
      console.log(err)
    });
  });


// schedule tasks to be run on the server
  cron.schedule("*/5 * * * * *", function() {
    setTimeout(function() {
      jobs.requestedQueueToFetcher('new_request', parseInt(ENV.FETCH_SIZE || 10)).then((result) =>{
        if(result && result.length){
          // console.log("fetch requested:", _.map(result, (r)=>{ return r.get('msisdn')}))
          console.log("fetch requested:", _.map(result, 'mobile_number'))
        }
      }).catch((err)=>{
        console.log(err)
      });
    }, 2500);
  });


// schedule tasks to be run on the server
  cron.schedule("* * * * *", function() {
    setTimeout(function() {
      console.log("triggered leftover jobs")
      jobs.doBatchRequestByStatus('new',2).then((result) =>{
          console.log("triggered leftover jobs")
      }).catch((err)=>{
        console.log(err)
      });
    }, 500);
  });


}


module.exports = app;
