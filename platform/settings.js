'use strict';
const fs = require('fs'),
  path = require('path');
const file = path.join(__dirname, '../.env');
if (fs.existsSync(file))
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
if (!['demo', 'pilot'].includes(process.env.APP_MODE || 'demo'))
  throw new Error('Invalid APP_MODE');
if (!['mock', 'openai'].includes(process.env.AI_PROVIDER || 'mock'))
  throw new Error('Invalid AI_PROVIDER');
if (process.env.AI_PROVIDER === 'openai' && !process.env.OPENAI_API_KEY)
  throw new Error('OPENAI_API_KEY required in live mode');
