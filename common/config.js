// config.js
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  endpoint: process.env.API_URL || 'localhost',
  port: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  INFOBIP_API_ASYNC_URL: process.env.INFOBIP_API_ASYNC_URL || '',
  INFOBIP_API_SYNC_URL: process.env.INFOBIP_API_SYNC_URL || '',
  INFOBIP_API_KEY: process.env.INFOBIP_API_KEY || '',
  WEB_HOOK_PATH: process.env.OUR_WEB_HOOK_PATH || '',
  FETCH_SIZE : process.env.FETCH_SIZE || 10,
  DB_PATH: process.env.DB_PATH,
  SSL_PRIVATE_KEY: process.env.SSL_PRIVATE_KEY || '',
  SSL_PRIVATE_CRT: process.env.SSL_PRIVATE_CRT || '',
  SSL_INTERMEDIATE_CRT: process.env.SSL_INTERMEDIATE_CRT || '',
};
