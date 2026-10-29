function main() {
  'use strict';
  const fs = require('fs'),
    path = require('path'),
    crypto = require('crypto');

  const { readJson } = require('../platform/storage');
  const data = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../platform/data'));
  const mode = process.argv[2],
    target = process.argv[3] && path.resolve(process.argv[3]);
  if (!target || !['backup', 'restore'].includes(mode)) {
    console.error(
      'Usage: npm run backup|restore -- ABSOLUTE_SNAPSHOT_DIRECTORY. Stop the app first.',
    );
    process.exitCode = 1;
    return;
  }
  require('../platform/settings');
  if (target === data || target.startsWith(data + path.sep) || data.startsWith(target + path.sep))
    throw new Error('Snapshot and DATA_DIR must be separate');
  function files(d) {
    return fs
      .readdirSync(d, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]));
  }
  if (mode === 'backup') {
    if (fs.existsSync(target)) throw new Error('Snapshot already exists');
    fs.cpSync(data, target, {
      recursive: true,
      filter: (p) => !p.endsWith('sessions.json') && !p.endsWith('.tmp'),
    });
    const entries = files(target).map((f) => ({
      path: path.relative(target, f),
      sha256: crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),
    }));
    fs.writeFileSync(
      path.join(target, 'manifest.json'),
      JSON.stringify({ schema: 1, version: require('../package.json').version, entries }, null, 2),
    );
    console.log('Backup created:', entries.length, 'files');
  } else if (mode === 'restore') {
    if (fs.existsSync(data) && fs.readdirSync(data).length)
      throw new Error('Restore only into a NEW empty DATA_DIR');
    const m = readJson(path.join(target, 'manifest.json'));
    if (m.schema !== 1) throw new Error('Unknown backup schema');
    for (const entry of m.entries) {
      const f = path.resolve(target, entry.path),
        rel = path.relative(target, f);
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid manifest path');
      if (crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') !== entry.sha256)
        throw new Error('Checksum mismatch');
    }
    fs.cpSync(target, data, {
      recursive: true,
      filter: (p) => path.basename(p) !== 'manifest.json',
    });
    console.log('Restored; sessions invalidated.');
  } else throw new Error('Unknown mode');
}
try {
  main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
