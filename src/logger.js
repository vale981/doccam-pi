///////////////////////////////////////////////////////////////////////////////
//          Winston Logger Wrapper with Custom Colors and Transports         //
///////////////////////////////////////////////////////////////////////////////

let winston = require('winston');

///////////////////////////////////////////////////////////////////////////////
//                                Declarations                               //
///////////////////////////////////////////////////////////////////////////////

// Object oriented `this`.
let self = false;

// Custom log levels.
const customLevels = {
    levels: {
        normal: 0,
        info: 1,
        warning: 2,
        danger: 3,
        success: 4
    },
    colors: {
        normal: 'white',
        info: 'blue',
        warning: 'orange',
        danger: 'red',
        success: 'green'
    }
};

///////////////////////////////////////////////////////////////////////////////
//                                    Code                                   //
///////////////////////////////////////////////////////////////////////////////

/**
 * Monkey Patching.
 */


/**
 * Calls the logging function with arguments, if the node enviroment isn't in production mode.
 */
winston.Logger.prototype.dbgmsg = function() {
    if (process.env.NODE_ENV !== 'production')
	this.log.apply(undefined, arguments);
};

// Set the Colors
winston.addColors(customLevels.colors);

let logger = (function() {
    if(!self)
	self = new(winston.Logger)({
	    levels: customLevels.levels,
	    transports: [
		new(winston.transports.Console)({
		    level: 'success'
		}),
		new(winston.transports.File)({
		    filename: __dirname + '/process.log',
		    colorize: true,
		    timestamp: true,
		    level: 'success',
		    json: true,
		    maxsize: 500000,
		    maxFiles: 10
		})
	    ]
	});

    return self;
})();

logger.importance = ['normal', 'info', 'warning', 'danger', 'success'];

// Export the Logger
module.exports = logger;

