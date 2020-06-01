// // log setup
// import winston from 'winston';
// const transports = {
//   console: new winston.transports.Console({ level: 'warn' }),
// };
//
// const logger = winston.createLogger({
//   transports: [transports.console, transports.file]
// });
//
// logger.info('This will not be logged in console transport because warn is set!');
//
// transports.console.level = 'info'; // changed the level
//
// logger.info('This will be logged in now!');
//
// export default {logger, transport}
