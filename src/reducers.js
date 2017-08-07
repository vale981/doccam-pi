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
    TAKE_SNAPSHOT,
    SET_SNAPSHOT_FAILED,
    SET_SNAPSHOT_TAKEN,
    SET_ERROR,
    TRY_RECONNECT,
    STOP_ERROR_HANDLING,
    SET_CONNECTED,
    SET_DISCONNECTED,

    // SSH
    SET_SSH_REMOTE_PORTS,
    SET_SSH_CONNECTING,
    SET_SSH_CONNECTED,
    SET_SSH_DISCONNECTING,
    SET_SSH_DISCONNECTED,
    SET_SSH_WILL_RECONNECT,
    SET_SSH_ERROR
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
        case SET_STOPPED:
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
 * Set the snapshot flag.
 */
function snapshot(state = false, action) {
    switch (action.type) {
        case TAKE_SNAPSHOT:
            return {
                taking: true,
                failed: false
            };
        case SET_SNAPSHOT_TAKEN:
            return Object.assign({}, state, {
                taking: false
            });
        case SET_SNAPSHOT_FAILED:
            return {
                taking: false,
                failed: action.data
            };
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
        restarting: restarting(state.restarting, action),
        snapshot: snapshot(state.takingSnapshot, action)
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

reducers.ssh = function(state = {
    enabled: false
}, action) {
    switch (action.type) {
        case SET_SSH_REMOTE_PORTS:
            return Object.assign({}, state, {
                camForwardPort: action.camForwardPort,
                sshForwardport: action.sshForwardPort
            });
        case SET_SSH_CONNECTING:
            return Object.assign({}, state, {
                status: 'CONNECTING',
                error: false,
                willReconnect: false
            });
        case SET_SSH_CONNECTED:
            return Object.assign({}, state, {
                status: 'CONNECTED',
                willReconnect: false
            });
        case SET_SSH_DISCONNECTED:
            return Object.assign({}, state, {
                status: 'DISCONNECTED',
                willReconnect: false
            });
        case SET_SSH_DISCONNECTING:
            return Object.assign({}, state, {
                status: 'DISCONNECTING',
                willReconnect: false
            });
        case SET_SSH_ERROR:
            return Object.assign({}, state, {
                status: 'DISCONNECTED',
                error: action.data // TODO: Checks
            });
        case SET_SSH_WILL_RECONNECT:
            return Object.assign({}, state, {
                status: 'DISCONNECTED',
                willReconnect: true
            });
        default:
            return state;
    };
};

module.exports = redux.combineReducers(reducers);
