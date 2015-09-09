
var util = require('util');

function SoapError() {
  var err = Error.apply(this, arguments);
  this.name = 'SoapError';
  this.message = err.message;
  this.stack = err.stack;
}
util.inherits(SoapError, Error);

module.exports = SoapError
