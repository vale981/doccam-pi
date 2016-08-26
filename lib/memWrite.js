var stream = require('stream');
var Writable = stream.Writable ||
    require('readable-stream').Writable;
var util = require('util');

function WMStrm(options) {
    // allow use without new operator
    if (!(this instanceof WMStrm)) {
        return new WMStrm(options);
    }
    Writable.call(this, options); // init super
    this.memStore = new Buffer(''); // empty
}
util.inherits(WMStrm, Writable);

WMStrm.prototype._write = function (chunk, enc, cb) {
    // our memory store stores things in buffers
    var buffer = (Buffer.isBuffer(chunk)) ?
        chunk : // already is Buffer use it
        new Buffer(chunk, enc); // string, convert

    // concat to the buffer already there
    this.memStore = Buffer.concat([this.memStore, buffer]);
    cb();
};

module.exports = WMStrm;;
