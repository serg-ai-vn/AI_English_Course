'use strict';
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw new Error(
      'Cannot read data file ' +
        path.basename(file) +
        '. Restore a verified backup; file was not overwritten.',
    );
  }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  let fd;
  try {
    fd = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(obj, null, 2));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
function initialize(data) {
  fs.mkdirSync(data, { recursive: true });
  for (const d of ['progress', 'sites', 'published', 'generated', 'particles'])
    fs.mkdirSync(path.join(data, d), { recursive: true });
  if (!fs.existsSync(path.join(data, 'classes.json'))) {
    if (process.env.APP_MODE === 'pilot')
      throw new Error('Provision non-demo classes.json before starting pilot');
    fs.cpSync(path.join(__dirname, '../fixtures'), data, {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  }
  const classes = readJson(path.join(data, 'classes.json'));
  const ids = new Set(), codes = new Set(), pinKeys = new Set();
  for (const c of classes.classes || []) {
    if (!/^[A-Za-z0-9_-]+$/.test(c.code)) throw new Error('Invalid class code');
    const code=c.code.toUpperCase(),pinKey='TEACHER_PIN_'+code.replace(/-/g,'_');
    if(codes.has(code))throw new Error('Class codes must be unique ignoring case');
    if(pinKeys.has(pinKey)&&process.env[pinKey])throw new Error('Ambiguous teacher PIN override; use distinct normalized class codes');
    codes.add(code);pinKeys.add(pinKey);
    if (
      process.env.APP_MODE === 'pilot' &&
      (c.code.toUpperCase() === 'DEMO' || String(c.teacherPin) === '0000')
    )
      throw new Error('Demo access is forbidden in pilot');
    for (const s of c.students || []) {
      if (!/^[a-z0-9_-]+$/.test(s.id) || ids.has(s.id))
        throw new Error('Student IDs must be unique safe slugs');
      ids.add(s.id);
    }
  }
}
module.exports = { readJson, writeJson, initialize };
