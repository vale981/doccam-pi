///////////////////////////////////////////////////////////////////////////////
//   Redux wrapper to hold the status object and the master server about changes.  //
///////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// Reference to itself.
let self = false;

// The socket.io connection from the main-module.
let _socket;

// The Properties of the status.
let _properties;

// Allowed values for the properties.
let _allowed;

// Action names for the properties.
let _actions;

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Wrapper to hold the status object and the master server about changes.
 *
 * The state is a shallow object which contains non-object values.
 * @param { Object } socket Socket.io instance from the main module..
 * @param { Object } properties The state properties to be set and read.
 * @param { Array } properties.name.allowed Array of allowed values. The first value is the default value.
 * @param { String } properties.name.action Name of the action to send to the server.
 */
let state = function( socket, properties ){
    // singleton
    if(self)
	return self;
    
    self = this;
    _socket = socket;

    // Initialize the Properties
    for(let prop in properties){
	// When already there or invalid, skip.
	if(this[prop] || !(properties[prop] instanceof Array))
	    continue;

	// Set prop and allowed;  
	_properties[prop] = properties[prop][0];
	_allowed[prop] = Object.assign([], properties[prop]);
	

	// Getter function.
	(
	    function(prop){
		Object.defineProperty(self, prop, {
		    get: function(){
			return this.get(prop);
		    }
		});
	    }
	)(prop);
    }

    return this;
};

module.exports = state;

/**
 * Get a state value.
 * @param {String} prop Name of the state property.
 * @return { * } The properties value or false if it is not found.x
 */
state.prototype.get = function(prop){
    if(_properties[prop])
	return _properties[prop];
    else
	return false;
};

/**
 * Set a state value.
 * @param {String} prop Name of the state property.
 * @param { * } value Value to set the property to.
 * @return { * } The properties new value or false if not allowed or not found.
 *
 * /**
 * Set state values.
 * @param { Object } properties An object with the properties to be changed.
 * @return { * } The properties new value or false if not allowed or not found.
 */
state.prototype.set = function(prop, value){
    let change;
    
    if(!value){
	if(typeof prop !== 'object')
	    return false;
    } else {
	if(typeof value == 'Object')
    }

    if(!_properties[prop] || !_properties[prop].allowed[value])
	return false;

    // NOTE: Maybe unmutable!
    _properties[prop].value = value;
    return _properties[prop].value;
};

/**
 * Utilities
 */

