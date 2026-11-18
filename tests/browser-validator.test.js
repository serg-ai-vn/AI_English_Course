'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const server = require('../platform/validate');
test('browser prompt indicators use the server validator for grammar, vocabulary, length and structure', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../platform/validate.js'), 'utf8'), sandbox);
  const browser = sandbox.window.PlatformValidation;
  const cfg = require('../platform/config/lesson-2.json');
  const prompts = ['', 'Role: Context: Task: Format:',
    'Role: creative student Context: I have played football Task: Write an energetic paragraph Format: one paragraph',
    "Role: student Context: I've never been swimming Task: Write my experience Format: an interesting paragraph",
    'Role: student Context: I have a red bed Task: energetic paragraph Format: paragraph',
    'Role: student Context: I have been playing football Task: training match Format: one paragraph'];
  const json = value => JSON.parse(JSON.stringify(value));
  for (const id of ['about-me', 'hobby-text-1']) {
    const def = cfg.fields.find(f => f.id === id);
    for (const prompt of prompts) {
      for (const previous of [[], [prompts[2]]]) {
        assert.deepEqual(json(browser.checkPrompt(prompt, previous, cfg, def)), server.checkPrompt(prompt, previous, cfg, def));
      }
    }
  }
  assert.equal(browser.hasPresentPerfect('I have a red bed'), false);
  assert.equal(browser.hasPresentPerfect('I have been swimming', cfg.rules.v3verbs), true);
});
