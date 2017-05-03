/** Outsourced definition of the Reducers for redux.
 * @see {@link http://redux.js.org/docs/basics/Reducers.html}
 * @module Reducers
 */

const redux = require('redux');
const {
    UPDATE_CONFIG,
    REQUEST_START,
    SET_STARTED,
    REQUEST_STOP,
    SET_STOPPED,
    REQUEST_RESTART,
    SET_ERROR,
    TRY_RECONNECT,
    STOP_ERROR_HANDLING,
    SET_NAME,
    SET_CONNECTED,
    SET_DISCONNECTED
} = require('./actions').actions;

let reducers = {};

/**
 * Set the error code. @see ffmpegCommand.js for the error code descriptions.
 */
function error(state = false, action) {
    switch (action.type) {
        case SET_ERROR:
            return action.data;
        case SET_STARTED:
            return false;
        default:
            return state;
    }
};

// TODO: Add central definition
/**
 * Set the error handling procedure.
 */
function handleError(state = false, action) {
    switch (action.type) {
        case SET_STARTED:
        case STOP_ERROR_HANDLING:
            return false;
        case TRY_RECONNECT:
            return TRY_RECONNECT;
        default:
            return state;
    }
}



/**
 * Set the running flag.
 * It can either be RUNNING, STARTING, STOPPING or STOPPED
 */
function running(state = 'STOPPED', action) {
    switch (action.type) {
        case REQUEST_START:
            return 'STARTING';
        case SET_STARTED:
            return 'RUNNING';
        case REQUEST_STOP:
            return 'STOPPING';
        case SET_STOPPED:
        case SET_ERROR:
            return 'STOPPED';
        default:
            return state;
    }
}

/**
 * Set the restarting flag.
 */
function restarting(state = false, action) {
    switch (action.type) {
        case REQUEST_RESTART:
            return true;
        default:
            return state;
    }
}

/**
 * @function stream
 * @description Stream Root Reducer.
 */
reducers.stream = function(state = {}, action) {
    return {
        running: running(state.running, action),
        error: error(state.error, action),
        handleError: handleError(state.handleError, action),
        restarting: restarting(state.restarting, action)
    };
};

/**
 * @function config
 * @description Updates the config state.
 */
reducers.config = function(state = false, action) {
    switch (action.type) {
        case UPDATE_CONFIG:
            return Object.assign({}, state, action.data);
        default:
            return state;
    }
};

/**
 * @function name
 * @description Set the name state.
 */
reducers.name = function(state = 'Unnamed', action) {
    switch (action.type) {
        case SET_NAME:
            return action.data;
        default:
            return state;
    }
};

reducers.connected = function(state = false, action) {
    switch (action.type) {
        case SET_CONNECTED:
            return true;
        case SET_DISCONNECTED:
            return false;
        default:
            return state;
    };
};

module.exports = redux.combineReducers(reducers);
