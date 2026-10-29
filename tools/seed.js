require('../platform/settings');
const path = require('path');
require('../platform/storage').initialize(
  path.resolve(process.env.DATA_DIR || path.join(__dirname, '../platform/data')),
);
console.log('Data initialized; existing files preserved.');
