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

const {
    setConnected,
    setDisconnected
} = require('./actions').creators;

const {
    UPDATE_CONFIG,
    REQUEST_START,
    SET_STARTED,
    REQUEST_STOP,
    SET_STOPPED,
    REQUEST_RESTART,
    SET_ERROR,
    TRY_RECONNECT,
    SET_NAME,
    HYDRATE,
    SET_CONNECTED,
    SET_DISCONNECTED
} = require('./actions').actions;;

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

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

// SSH Management Abstraction
let SSHMan;

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

class Communicator {
    constructor(_getState, _getConfig, _dispatch) {
        // singleton
        if (self)
            return self;

        if (!_getState) {
            throw new Error('Invalid getState() function.');
        }

        if (!_dispatch) {
            throw new Error('Invalid dispatch() function.');
        }

	if ((typeof _getConfig) !== 'function' || !_getConfig()) 
            throw new Error('Invalid getConfig funtion!'); // TODO: Lookup if implemented everywhere

        self = this;

        // define the locals
        getState = _getState;
        dispatch = _dispatch;
	getConfig = _getConfig;

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
                config: state.config
            };
            break;

        case HYDRATE:
            socket.emit('meta', {
                running: state.stream.running == 'RUNNING' ? 0 : 1,
                error: state.stream.error || -1,
                name: state.name,
                config: state.config
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

    socket.emit('data', {
        type: 'message',
        data: {
            title: 'Error',
            type: 'error',
            text: 'Could not start SSH tunnels!'
        }
    }, to);
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
        type: 'snap', //TODO New with new software
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
	// Todo Better Hanling
	// For now we do nothing, as it will reconnect itself!
    });

    // Handle SSH Connection //TODO Implement - Action to set SSH. Auto Retry //TODO central DEFINITION 
    //ssh.connect();

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

    dispatch(setDisconnected);

    // And just reconnect.
    logger.log(logger.importance[2], 'Lost connection to the master server.');
    initSocket();
}

/**
 * Handle Commands //TODO Implement
 */
function handleCommand() {

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
