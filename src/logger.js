///////////////////////////////////////////////////////////////////////////////
//          Winston Logger Wrapper with Custom Colors and Transports         //
///////////////////////////////////////////////////////////////////////////////

let winston = require('winston');

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// Custom log levels.
const customLevels = {
    levels: {
	action: 5,
        normal: 4,
        info: 3,
        success: 2,
        warning: 1,
        danger: 0
    },
    colors: {
	action: 'grey',
        normal: 'white',
        info: 'blue',
        warning: 'yellow',
        danger: 'red',
        success: 'green'
    }
};

// Error Messages
const errors = ['Camera Disconnected', 'YoutTube Disconnected', 'Wrong ffmpeg executable.', 'Unknown error.'];

const {
    UPDATE_CONFIG,
    REQUEST_START,
    SET_STARTED,
    REQUEST_STOP,
    SET_STOPPED,
    REQUEST_RESTART,
    SET_ERROR,
    TRY_RECONNECT,
    SET_CONNECTED,
    SET_DISCONNECTED
} = require('./actions').actions;

/**
 * Maps actions to log messages. // TODO: CD
 * @description Right hand is either a string or a function that accepts an action.
 */
const actionMessageMap = {
    UPDATE_CONFIG: ['info', 'Config Updated'],
    REQUEST_START: ['info', 'Starting'],
    SET_STARTED: ['success', 'Started'],
    REQUEST_STOP: ['info', 'Sopping'],
    SET_STOPPED: ['success', 'Stopped'],
    REQUEST_RESTART: ['info', 'Restarting'],
    SET_ERROR: action => ['danger', `An error has occured: ${errors[action.data]}\n${action.stderr ? 'STDERR: ' + action.stderr + '\n' : ''}${action.stdout ? 'STDOUT: ' + action.stdout + '\n' : ''}`],
    TRY_RECONNECT: action => ['warning', `Trying to reconnect to: ${action.to[0]} on port ${action.to[1]}.`],
    SET_CONNECTED: ['success', 'Connected to the Master-Server.'],
    SET_DISCONNECTED: ['warning', 'Disconnected from the Master-Server.']
};

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Calls the logging function with arguments, if the node enviroment isn't in production mode.
 */

// Set the Colors
winston.addColors(customLevels.colors);

let logger = new(winston.Logger)({
    levels: customLevels.levels,
    transports: [
        new(winston.transports.Console)({
            level: 'normal',
            prettyPrint: true,
            colorize: true,
            silent: false,
            timestamp: true
        }),
        new(winston.transports.File)({
            filename: __dirname + '/process.log',
            prettyPrint: true,
            colorize: true,
            timestamp: true,
            level: 'danger',
            json: true,
            maxsize: 500000,
            maxFiles: 10
        })
    ]
});

// TODO: Find out if needet
logger.importance = ['normal', 'info', 'warning', 'danger', 'success'];

/**
 * Redux logging middleware.
 */
logger.middleware = store => next => action => {
    logger.log('action', action);
    
    if (!actionMessageMap[action.type])
        return next(action);

    let [level, message] = typeof actionMessageMap[action.type] == 'function' ? actionMessageMap[action.type](action) : actionMessageMap[action.type];

    logger.log(level, message);

    return next(action);
};

// Export the Logger
module.exports = logger;
