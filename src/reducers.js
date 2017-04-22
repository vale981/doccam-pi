///////////////////////////////////////////////////////////////////////////////
//                                  Reducers                                 //
///////////////////////////////////////////////////////////////////////////////

const redux = require('redux');
const actions = require('./actions');

let reducers = {};

/**
 * Set the streaming/error state.
 */
reducers.error = function(state = -1, action) {
    switch (action.type) {
    case actions.SET_ERROR:
	if((typeof action.data) == 'undefined') {
	    return action.data;
            break;
	}
    default:
        return state;
    }
};

/**
 * Set the streaming state.
 */

reducers.streaming = function(state = 'STOPPED', action) {
    switch (action.type) {
    case actions.START:
    case actions.STOP:
	return action.type == actions.START;
	break;
    default:
        return state;
    }
};

/**
 * Set the restart flag.
 *
 * The restart flag get's automaticly unset, as soon as the start action gets reduced.
 */

reducers.restart = function(state = false, action) {
    switch (action.type) {
    case actions.RESTART:
	return true;
    case actions.START:
	return false;
    default:
        return state;
    }
};


/**
 * Update the config.
 */
reducers.config = function(state = {}, action) {
    switch (action.type) {
        case actions.UPDATE_CONFIG:
            return Object.assign({}, state, action.data);
            break;
        default:
            return state;
    }
};

module.exports = redux.combineReducers(reducers);
