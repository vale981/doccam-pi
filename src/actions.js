/** Outsourced definition of the actions and simple action creators for trivial actions.
 * @module Actions
 * @todo allowed values
 */

const Promise = require('promise');
const writeConfig = require('./utility/config.js').write;
const readConfig =  require('./utility/config.js').read;
/**
 * Actions
 * The action definitions.
 */
let actions = {
    UPDATE_CONFIG: 'UPDATE_CONFIG',
    REQUEST_START: 'REQUEST_START',
    SET_STARTED: 'SET_STATED',
    REQUEST_STOP: 'REQUEST_STOP',
    SET_STOPPED: 'SET_STOPPED',
    REQUEST_RESTART: 'REQUEST_RESTART',
    SET_ERROR: 'SET_ERROR',
    TRY_RECONECT: 'TRY_RECONNECT',
    SET_NAME: 'SET_NAME',

    // Master Server Related
    HYDRATE: 'HYDRATE'
};

/**
 * Trivial Action Creators
 */
let creators = {};

/**
 * Updates or initializes the configuration state. Updating and initializing are sync actions. The disk write happens asynchronously. Also sets the name if it is mentioned in the update.
 * @param { Object } update The new (partial) config. If it is undefined, then the configuration will be read from disk.
 * @returns { Function } A thunk for redux-thunk.
 * @throws { Error } In case the Config can't be read.
 */
creators.updateConfig = function(update) {
    return (dispatch, getState) => {
	let init = false;
	
	if(!update) {
	    init = true;
	    
	    update = readConfig();

	    // TODO: Proper handling.
	    if(!update)
		throw new Error('Could not load config.');
	}
	
        dispatch({
            type: actions.UPDATE_CONFIG,
            data: update
        });

	if(update.name)
	    dispatch(creators.setName(update.name));

        return init ? Promise.resolve() : writeConfig(getState);
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

creators.setError = function(error) {
    return {
        type: actions.SET_ERROR,
        data: error
    };
};

creators.tryReconnect = function() {
    return {
	type: actions.TRY_RECONECT
    };
};

creators.setName = function(name) {
    return {
	type: actions.SET_NAME,
	data: name
    };
};

module.exports = {
    actions,
    creators
};
