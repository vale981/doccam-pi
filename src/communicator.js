///////////////////////////////////////////////////////////////////////////////
//     A socket.js wrapper to abstract the communication with the server.    //
///////////////////////////////////////////////////////////////////////////////
/**
 * @module Communicator
 * @description Abstracts the communication with the master server.
 */

// TODO: Filter the state props...

const socketio = require('socket.io-client');
const logger = require('./logger.js');
const sshMan = require('./ssh.js');

/*const { HYDRATE } = require('./actions').actions[C]*/

// Action Creators
const {
    setConnected,
    setDisconnected,
    updateConfig
} = require('./actions').creators;

// Actions
const {
    UPDATE_CONFIG,
    REQUEST_START,
    SET_STARTED,
    REQUEST_STOP,
    SET_STOPPED,
    REQUEST_RESTART,
    SET_ERROR,
    TRY_RECONNECT,
    HYDRATE,
    SET_CONNECTED,
    SET_DISCONNECTED,
    SET_SSH_CONNECTED
} = require('./actions').actions;

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// TODO: CD
// TODO: Update // OLD
// Commands
const commands = {
    START_STOP: 'startStop',
    SNAPSHOT: 'snap',
    UPDATE_CONFIG: 'changeSettings',
    RESTART: 'restart',
    RESTART_SSH: 'restartSSH',
    GET_LOGS: 'getLogs'
};

// Object oriented `this`.
let self = false;

/**
 * The socket.io client connection.
 */
let socket;

// Get the current application state.
let getState;

// Get the current config.
let getConfig;

// Dispatch function to alter the state.
let dispatch;

// SSH Management Abstraction.
let SSHMan;

// The FFMPEG commander.
let commander;

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

class Communicator {
    constructor(_getState, _getConfig, _dispatch, _commander) {
        // singleton
        if (self)
            return self;

        if (!_getState) {
            throw new Error('Invalid getState() function.');
        }

        if ((typeof _getConfig) !== 'function' || typeof _getConfig() !== 'object')
            throw new Error('Invalid getConfig funtion!'); // TODO: Lookup if implemented everywhere

        if (!_dispatch) {
            throw new Error('Invalid dispatch() function.');
        }

        if (typeof _commander !== 'object')
            throw new Error('Invalid Commander Instance!');

        self = this;

        // define the locals
        getState = _getState;
        dispatch = _dispatch;
        getConfig = _getConfig;
        commander = _commander;

        SSHMan = new sshMan(getState, getConfig, dispatch, this.getPorts);
        initSocket();
        return this;
    }

    /**
     * Connection status getter. Forwards the socket-io status.
     * @returns { Bool } Connection status.
     */
    get connected() {
        return socket.connected;
    }
};

/**
 * Relay an action to the server.
 * @param {Object} action The action object.
 */
Communicator.prototype.sendAction = function(action) {
    if (!this.connected || !action.type)
        return;

    // TODO: Filter
    /*
      socket.emit('action', action);
      [C]*/

    let type, change, state = getState();

    // All Legacy Stuff
    switch (action.type) {
    case SET_STARTED:
    case SET_STOPPED:
        type = 'startStop';
        change = {
            running: state.stream.running == 'RUNNING' ? 0 : 1, // TODO: CD
            error: state.stream.error || -1
        };
        break;

    case SET_ERROR:
        type = 'error';
        change = {
            running: 2,
            error: state.stream.error
        };
        break;

    case UPDATE_CONFIG:
        type = 'settings';

        change = {
            config: Object.assign({}, state.config, {name: action.data.name}) //TODO: LEGACY
        };
        break;

    case SET_SSH_CONNECTED:
        change = {
            port: state.ssh.sshForwardPort,
            camForwardPort: state.ssh.camForwardPort
        };
        break;

    case HYDRATE:
        socket.emit('meta', {
            running: state.stream.running == 'RUNNING' ? 0 : 1,
            error: state.stream.error || -1,
            name: state.name,
            config: state.config,
            haveSettings: true // LEGACY
        });
        return;

    default:
        return;
    }

    socket.emit('change', {
        type,
        change
    });
};

/**
 * Send some data up the wire.
 * @param {Object} data
 * @param {String} type The type of the data. (Check server code.)
 * @param {String} to Socket ID of the receipient.
 */
Communicator.prototype.sendData = function(type, data, to){
    socket.emit('data', {data, type}, to);
};

/**
 * Sends a message to a command issuer on the web-interface.
 * @param {String} title Title of the message.
 * @param {String} type Type of the message.
 * @param {String} text The message text.
 * @param {String} to Recepient (socket id).
 */
Communicator.prototype.sendMessage = function(title, type, text, to) {
    if (!this.connected)
        return;

    /*socket.emit('message', {
      title,
      type,
      text
      }, to);[C]*/

    self.sendData('message', {
        title: title,
        type: type,
        text: text
    }, to);
};


/**
 * Send a message of `type` `to` a socket.
 * @param {String} to Recepient (socket id).
 * @param {String} type Type of the message.
 * @returns {function} A function with the paremers `to` and `type` frozen. @see sendMessage
 */
Communicator.prototype.sendMessageTo = function(type, to) {
    return (title, text) => self.sendMessage(title, type, text, to);
};

/**
 * Sends a snapshot to a command issuer on the web-interface.
 * @param {Object} snapshot Snapshot to send.
 * @param {String} to Recepient (socket id).
 */
Communicator.prototype.sendSnapshot = function(snapshot, to) {
    if (!this.connected)
        return;

    socket.emit('data', {
        type: 'snap', //TODO New with new software, more General way...
        data: snapshot
    }, to);
};

/**
 * Finds two open ports at the master server.
 * @returns {Promise} Resolves with the ports.
 */
Communicator.prototype.getPorts = function() {
    return new Promise((resolve, reject) => {
        // TODO: More Elegant, use what's there
        let timedout = false,
            timeout;
        socket.emit('getSSHPorts', ports => {
            if (timedout)
                return;

            resolve(ports);
            clearTimeout(timeout);
        });

        timeout = setTimeout(() => {
            timedout = true;
            reject("Cannot get remote ports: Timeout! No answer from the Master Server!");
        }, 2000); // TODO: CD
    });
};

module.exports = Communicator;

/**
 * Utilities
 */

/**
 * Initialize the socket connection and register the events.
 */
function initSocket() {
    // Savety it will be called only once anyway.

    socket = socketio(getConfig().master + '/pi', {
        query: getConfig().unconfigured ? "unconfigured=true" : undefined
    });

    socket.on('connect', socketConnected);
    socket.on('command', handleCommand);
    socket.on('disconnect', socketDisconnected);
}

/**
 * Event Handlers
 */

/**
 * Handle an established connection.
 */
function socketConnected() {
    dispatch(setConnected());

    dispatch(SSHMan.connect()).catch(() => {
        // TODO: Better Hanling
        // For now we do nothing, as it will reconnect itself!
    });

    // Handle SSH Connection //TODO Implement - Action to set SSH. Auto Retry // TODO: CD

    self.sendAction({
        type: HYDRATE,
        data: getState()
    });
}

/**
 * Handle a disconnection.
 */
function socketDisconnected() {
    socket.disconnect();

    dispatch(setDisconnected());

    initSocket();
}

/**
 * Handle Commands
 */
function handleCommand(command, callback) {
    // Well, this can be done nicer, lots of code dupes. // TODO: NICER, URGENT
    // TODO: The same in callbacks...

    let answerSuccess = self.sendMessageTo('success', command.sender),
        answerError = self.sendMessageTo('error', command.sender);

    switch (command.command) {
    case commands.START_STOP: // OLD // TODO: renew
        if (getState().stream.running === 'RUNNING')
            dispatch(commander.stop()).then(msg => answerSuccess(msg)).catch(error => answerError(error));
        else
            dispatch(commander.start()).then(msg => answerSuccess(msg)).catch(error => answerError(error));
        break;
    case commands.RESTART:
        dispatch(commander.restart()).then(msg => answerSuccess(msg)).catch(error => answerError(error));
        break;
    case commands.UPDATE_CONFIG:
        dispatch(updateConfig(command.data)).then(msg => answerSuccess(msg)).catch(err => answerError(err));
        break;
    case commands.RESTART_SSH:
        dispatch(SSHMan.restartTunnels()).then(msg => answerSuccess(msg)).catch(err => answerError(err));
        break;
    case commands.SNAPSHOT:
        dispatch(commander.takeSnapshot()).then(snap => self.sendSnapshot(snap))
            .catch(error => self.sendMessage('Snapshot Failed', 'error', error, command.sender));
        break;
    case commands.GET_LOGS:
        logger.getLogs().then(logs => self.sendData('logs', logs, command.sender)).catch(() => answerError('Can\'t get logs.')); //TODO: CD
        break;
    }
}

/**
 * Redux Middleware
 */

Communicator.middleware = store => next => action => {
    let result = next(action);

    if (self && self.connected) {
        self.sendAction(action); //TODO: Filter
    }

    return result;
};
