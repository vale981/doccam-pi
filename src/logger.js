///////////////////////////////////////////////////////////////////////////////
//          Winston Logger Wrapper with Custom Colors and Transports         //
///////////////////////////////////////////////////////////////////////////////

let winston = require('winston');

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

// Set the Colors
winston.addColors(customLevels.colors);

let logger = new(winston.Logger)({
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

logger.importance = ['normal', 'info', 'warning', 'danger', 'success'];

// Export the Logger
module.exports = logger;

