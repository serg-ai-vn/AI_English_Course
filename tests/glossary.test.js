const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('every lesson glossary term, including L4 design-bank words, has an explanation and Vietnamese translation', () => {
  const browser = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../platform/public/workspace-ui.js'), 'utf8'), browser);
  for (const lesson of [2, 3, 4, 5]) {
    const cfg = require('../platform/config/lesson-' + lesson + '.json');
    const original = JSON.stringify(cfg);
    const words = browser.glossaryWords(cfg);
    assert.equal(new Set(words).size, words.length);
    for (const word of words) {
      const help = browser.workspaceWordHelp[word.toLowerCase()];
      assert(help && help[0].trim() && help[1].trim(), 'Missing glossary entry: ' + lesson + ' ' + word);
    }
    if (lesson === 3) assert.equal(words.length, 10);
    if (lesson === 4) for (const word of ['theme', 'palette', 'font', 'contrast', 'avatar']) assert(words.includes(word));
    assert.equal(JSON.stringify(cfg), original, 'Display helper must not mutate lesson config');
  }
});
