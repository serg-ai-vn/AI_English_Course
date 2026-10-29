const fs = require('fs'),
  path = require('path'),
  vm = require('vm');
const root = path.join(__dirname, '..');
function walk(d) {
  return fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      ['node_modules', '.git', 'data'].includes(e.name)
        ? []
        : e.isDirectory()
          ? walk(path.join(d, e.name))
          : [path.join(d, e.name)],
    );
}
let n = 0;
for (const f of walk(root)) {
  const s = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.js')) new vm.Script(s, { filename: f });
  if (f.endsWith('.json')) JSON.parse(s);
  if (f.endsWith('.html'))
    for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/src=/.test(m[1])) new vm.Script(m[2], { filename: f });
    }
  n++;
}
const ids = new Set();
for (const k of [2, 3, 4, 5]) {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'platform/config/lesson-' + k + '.json')));
  for (const f of c.fields) {
    if (ids.has(f.id)) throw new Error('Duplicate field ' + f.id);
    ids.add(f.id);
    if (
      ![
        'direct',
        'checklist',
        'ai-text-3step',
        'ai-cycle-bonus',
        'ai-image-cycle',
        'ai-image-rapid',
        'theme-picker',
      ].includes(f.input)
    )
      throw new Error('Unsupported input ' + f.input);
  }
}
console.log('Syntax, JSON and field contracts passed:', n, 'files');
