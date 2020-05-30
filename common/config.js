// config.js
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  endpoint: process.env.API_URL || 'localhost',
  port: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development'
};
