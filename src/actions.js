/** Outsourced definition of the actions and simple action creators for trivial actions.
 * @module Actions
 * @todo allowed values
 */

const Promise = require('promise');
const writeConfig = require('./utility/config.js').write;
const readConfig = require('./utility/config.js').read;

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

/**
 * Actions
 * The action definitions.
 */
let actions = {
    UPDATE_CONFIG: 'UPDATE_CONFIG',
    REQUEST_START: 'REQUEST_START',
    SET_STARTED: 'SET_STARTED',
    REQUEST_STOP: 'REQUEST_STOP',
    SET_STOPPED: 'SET_STOPPED',
    REQUEST_RESTART: 'REQUEST_RESTART',
    TAKE_SNAPSHOT: 'TAKE_SNAPSHOT',
    SET_SNAPSHOT_FAILED: 'SET_SNAPSHOT_FAILED',
    SET_SNAPSHOT_TAKEN: 'SET_SNAPSHOT_TAKEN',
    SET_ERROR: 'SET_ERROR',
    SET_ERROR_RESOLVED: 'SET_ERROR_RESOLVED',
    TRY_RECONNECT: 'TRY_RECONNECT',
    STOP_ERROR_HANDLING: 'STOP_ERROR_HANDLING',

    // Communicator
    SET_CONNECTED: 'SET_CONNECTED',
    SET_DISCONNECTED: 'SET_DISCONNECTED',

    // SSH
    SET_SSH_DISCONNECTED: 'SET_SSH_DISCONNECTED',
    SET_SSH_DISCONNECTING: 'SET_SSH_DISCONNECTING',
    SET_SSH_CONNECTING: 'SET_SSH_CONNECTING',
    SET_SSH_CONNECTED: 'SET_SSH_CONNECTED',
    SET_SSH_REMOTE_PORTS: 'SET_SSH_REMOTE_PORTS',
    SET_SSH_ERROR: 'SET_SSH_ERROR',
    SET_SSH_WILL_RECONNECT: 'SET_SSH_WILL_RECONNECT',

    // Master Server Related
    HYDRATE: 'HYDRATE'
};

/**
 * Trivial Action Creators
 */
let creators = {};

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Updates or initializes the configuration state. Updating and initializing are sync actions. The disk write happens asynchronously. Also sets the name if it is mentioned in the update.
 * @param { Object } update The new (partial) config. If it is undefined, then the configuration will be read from disk.
 * @returns { Function } A thunk for redux-thunk.
 * @throws { Error } In case the Config can't be read.
 */
creators.updateConfig = function(update) {
    return (dispatch, getState) => {
        let init = false;

        if (!update) {
            init = true;

            update = readConfig();

            // TODO: Proper handling.
            if (!update)
                throw new Error('Could not load config.');
        }

        dispatch({
            type: actions.UPDATE_CONFIG,
            data: update
        });

        // TODO: CD
        if (init)
            return Promise.resolve('Config Updated.');
        else
            return writeConfig(getState().config);
    };
};

creators.requestStart = function() {
    return {
        type: actions.REQUEST_START
    };
};

creators.requestStop = function() {
    return {
        type: actions.REQUEST_STOP
    };
};

creators.setStarted = function() {
    return {
        type: actions.SET_STARTED
    };
};

creators.setStopped = function() {
    return {
        type: actions.SET_STOPPED
    };
};

creators.requestRestart = function() {
    return {
        type: actions.REQUEST_RESTART
    };
};

creators.takeSnapshot = function() {
    return {
        type: actions.TAKE_SNAPSHOT
    };
};

creators.setSnapshotFailed = function(error) {
    return {
        type: actions.SET_SNAPSHOT_FAILED,
        data: error
    };
};

creators.setSnapshotTaken = function() {
    return {
        type: actions.SET_SNAPSHOT_TAKEN
    };
};

// Optional error Message for logging.
creators.setError = function(error, stdout, stderr) {
    return {
        type: actions.SET_ERROR,
        data: error,
        stdout,
        stderr
    };
};

creators.setErrorResolved = function() {
    return {
        type: actions.SET_ERROR_RESOLVED
    };
};

creators.setTryReconnect = function(to) {
    return {
        type: actions.TRY_RECONNECT,
        to
    };
};

creators.stopErrorHandling = function() {
    return {
        type: actions.STOP_ERROR_HANDLING
    };
};

creators.setConnected = function() {
    return {
        type: actions.SET_CONNECTED
    };
};

creators.setDisconnected = function() {
    return {
        type: actions.SET_DISCONNECTED
    };
};

creators.setSSHRemotePorts = function(ports) {
    return {
        type: actions.SET_SSH_REMOTE_PORTS,
        data: ports
    };
};

creators.setSSHConnecting = function() {
    return {
        type: actions.SET_SSH_CONNECTING
    };
};

creators.setSSHConnected = function() {
    return {
        type: actions.SET_SSH_CONNECTED
    };
};

creators.setSSHDisconnecting = function(error) {
    return {
        type: actions.SET_SSH_DISCONNECTING
    };
};

creators.setSSHDisconnected = function() {
    return {
        type: actions.SET_SSH_DISCONNECTED
    };
};

creators.setSSHError = function(error) {
    return {
        type: actions.SET_SSH_ERROR,
        data: error
    };
};

creators.setSSHWillReconnect = function(error) {
    return {
        type: actions.SET_SSH_WILL_RECONNECT
    };
};

module.exports = {
    actions,
    creators
};
