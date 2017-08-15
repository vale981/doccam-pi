///////////////////////////////////////////////////////////////////////////////
//          Winston Logger Wrapper with Custom Colors and Transports         //
///////////////////////////////////////////////////////////////////////////////

const winston = require('winston');
const fs = require('fs');

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
const errors = ['Camera Disconnected', 'Stream-Server Disconnected', 'Wrong ffmpeg executable.', 'Unknown error.', 'Invalid Stream Key or the stream server doesn\'t accept connections.'];

const {
    UPDATE_CONFIG,
    REQUEST_START,
    SET_STARTED,
    REQUEST_STOP,
    SET_STOPPED,
    REQUEST_RESTART,
    SET_ERROR,
    SET_ERROR_RESOLVED,
    TRY_RECONNECT,
    SET_CONNECTED,
    SET_DISCONNECTED,

    // SSH
    SET_SSH_REMOTE_PORTS,
    SET_SSH_CONNECTING,
    SET_SSH_CONNECTED,
    SET_SSH_DISCONNECTED,
    SET_SSH_WILL_RECONNECT,
    SET_SSH_ERROR
} = require('./actions').actions;

/**
 * Maps actions to log messages. // TODO: CD
 * @description Right hand is either a string or a function that accepts an action.
 */
const actionMessageMap = {
    UPDATE_CONFIG: ['info', 'Config Updated'],
    REQUEST_START: ['info', 'Starting Stream'],
    SET_STARTED: ['success', 'Started Stream'],
    REQUEST_STOP: ['info', 'Stopping Stream'],
    SET_STOPPED: ['success', 'Stopped Stream'],
    REQUEST_RESTART: ['info', 'Restarting Stream'],
    TAKE_SNAPSHOT: ['info', 'Taking Snapshot.'],
    SET_SNAPSHOT_FAILED: action => ['danger', `Snapshot failed: ${action.data}`],
    SET_SNAPSHOT_TAKEN: ['success', 'Snapshot Taken'],
    SET_ERROR: action => ['danger', `An error has occured: ${errors[action.data]}\n${action.stderr ? 'STDERR: ' + action.stderr + '\n' : ''}${action.stdout ? 'STDOUT: ' + action.stdout + '\n' : ''}`], // TODO: FILTER STDERR... STDOUT...
    SET_ERROR_RESOLVED: ['success', 'The Problem was resolved.'],
    TRY_RECONNECT: action => ['warning', `Trying to reconnect to: ${action.to[0]} on port ${action.to[1]}.`],
    SET_CONNECTED: ['success', 'Connected to the Master-Server.'],
    SET_DISCONNECTED: ['warning', 'Disconnected from the Master-Server.'],
    SET_SSH_REMOTE_PORTS: action => ['info', `Setting SSH ports to ${action.data.sshForwardPort} and ${action.data.camForwardPort}`],
    SET_SSH_CONNECTING: ['info', 'Attempting to create the SSH tunnels.'],
    SET_SSH_CONNECTED: ['success', 'SSH tunnels are up and running.'],
    SET_SSH_DISCONNECTED: ['warning', 'SSH is disconnected'],
    SET_SSH_WILL_RECONNECT: ['warning', 'Although the times are hard, we will try to reconnect the SSH tunels once the connection to the SSH-Manager is regained!'],
    SET_SSH_ERROR: action => ['danger', `An (SSH) error has occured: ${action.data}`]
};

/**
 * Logfile Path
 */
const logdir = __dirname + '/../logs/';

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Calls the logging function with arguments, if the node enviroment isn't in production mode.
 */

// Create logs dir // TODO: Configurable
if (!fs.existsSync(logdir)) {
    fs.mkdirSync(logdir);
}


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
            filename: logdir + 'process.log',
            prettyPrint: true,
            colorize: true,
            timestamp: true,
            level: 'normal',
            json: true,
            maxsize: 500000,
            maxFiles: 10
        })
    ]
});


/**
 * A promise wrapper, to get the logs as a nice array.
 * @returns {Promise} The logs or an error.
 */
logger.getLogs = function() {
    return new Promise((resolve, reject) => {
        logger.query({
            limit: 100 //TODO: Dynamic setting...
        }, function(err, data) {
            logs = data.file;

            if (err) {
                reject(err);
                return;
            }

            if (logs.length === 0)
                logs = [];

            resolve(logs);
            return;
        });
    });
};

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
