///////////////////////////////////////////////////////////////////////////////
//     A socket.js wrapper to abstract the communication with the server.    //
///////////////////////////////////////////////////////////////////////////////
/**
 * @module Communicator
 * @description Abstracts the communication with the master server.
 */

const socketio = require('socket.io-client');
const logger = require('./logger.js');
/*const { HYDRATE } = require('./actions').actions[C]*/

const { UPDATE_CONFIG,
	REQUEST_START,
	SET_STARTED,
	REQUEST_STOP,
	SET_STOPPED,
	REQUEST_RESTART,
	SET_ERROR,
	TRY_RECONECT,
	SET_NAME,
	HYDRATE}= require('./actions').actions;;

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

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

class Communicator {
    constructor(_getState) {
        // singleton
        if (self)
            return self;

        if (!_getState) {
            throw new Error('Invalid getState() function.');
        }

	if(!_getState().config)
	    throw new Error('Invalid Config. Initialize config first!'); // TODO: Lookup if implemented everywhere

	self = this;

        // define the locals
        getState = _getState;

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
Communicator.prototype.sendAction = function(action){
    if(!this.connected || !action.type)
	return;

    // TODO: Filter
    /*
    socket.emit('action', action);
    [C]*/
    
    let type, change, state = getState();
    
    switch (action.type) {
    case SET_STARTED:
    case SET_STOPPED:
	type = 'startStop',
	change = {
	    running: state.stream.runnning ? 1 : 0,
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
    default:
	return;
    }

    socket.emit('change', {type, change});
};

/**
 * Sends a message to a command issuer on the web-interface.
 * @param {String} title Title of the message.
 * @param {String} type Type of the message.
 * @param {String} text The message text.
 * @param {String} to Recepient (socket id).
 */
Communicator.prototype.sendMessage = function(title, type, text, to){
    if(!this.connected)
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
Communicator.prototype.sendSnapshot = function(snapshot, to){
    if(!this.connected)
	return;
    
    socket.emit('data', {
        type: 'snap', //TODO New with new software
        data: snapshot
    }, to);
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

    socket = socketio(getState().config.master + '/pi', {
	query: getState().config.unconfigured ? "unconfigured=true" : undefined
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
    logger.log(logger.importance[4], 'Connected to the master server.');

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
    let result =  next(action);

    if(self && self.connected){
	console.log("self");
	self.sendAction(action); //TODO: Filter
    }

    return result;
};
