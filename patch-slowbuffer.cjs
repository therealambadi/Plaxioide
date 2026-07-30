// Node 25 removed SlowBuffer; polyfill it for buffer-equal-constant-time
const { Buffer } = require('buffer');
if (!require('buffer').SlowBuffer) {
  require('buffer').SlowBuffer = function SlowBuffer(size) {
    return Buffer.allocUnsafe(size);
  };
}
