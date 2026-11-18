'use strict';
// Synthetic fixtures only. Owns and stops its temporary server; never uses port 3000.
const { chromium } = require('@playwright/test');
const { startServer } = require('../tests/helpers/server');
const path = require('path');
const fs = require('fs');
(async () => {
  const stage = process.argv[2] || 'after';
  const output = path.resolve('docs/ui-themes', stage);
  fs.mkdirSync(output, { recursive: true });
  const server = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    if (stage === 'before') {
      const css = require('child_process').execFileSync('git', ['show', 'cae6c35:platform/public/platform.css'], { encoding: 'utf8' });
      await page.route('**/platform.css', route => route.fulfill({ contentType: 'text/css', body: css }));
    }
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const theme of stage === 'before' ? ['night-lab'] : ['night-lab', 'classroom-light']) {
      await page.goto(server.base + '/login.html');
      if (stage !== 'before') await page.evaluate(t => window.PlatformTheme.setTheme(t), theme);
      await page.waitForTimeout(350);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(output, theme + '-login.png') });
      await page.getByRole('tab', { name: 'Teacher', exact: true }).click();
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(output, theme + '-login-teacher.png') });
      const auth = await (await page.request.post(server.base + '/api/login', {
        data: { role: 'student', classCode: 'DEMO', name: 'Lumi', pin: '1111' },
      })).json();
      await page.evaluate(t => localStorage.setItem('token', t), auth.token);
      const teacherAuth = await (await page.request.post(server.base + '/api/login', {
        data: { role: 'teacher', classCode: 'DEMO', pin: '0000' },
      })).json();
      const unlock = await (await page.request.post(server.base + '/api/teacher/unlock-lesson', {
        data: { studentId: 'lumi', lesson: 5 }, headers: { Authorization: 'Bearer ' + teacherAuth.token },
      })).json();
      if (!unlock.ok) throw new Error('Cannot unlock synthetic L5');
      for (const lesson of [2, 3, 4, 5]) {
        const switched = await (await page.request.post(server.base + '/api/lesson-switch', { data: { lesson }, headers: { Authorization: 'Bearer ' + auth.token } })).json();
        if (!switched.ok) throw new Error('Cannot switch to L' + lesson);
        await page.goto(server.base + '/workspace.html');
        await page.locator('.field-card').first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(output, theme + '-L' + lesson + '.png'), fullPage: true });
      }
      const teacher = await (await page.request.post(server.base + '/api/login', {
        data: { role: 'teacher', classCode: 'DEMO', pin: '0000' },
      })).json();
      await page.evaluate(t => localStorage.setItem('token', t), teacher.token);
      await page.goto(server.base + '/teacher.html');
      await page.locator('.student-table').waitFor();
      // Volatile wall clock is excluded from comparison.
      await page.locator('#last-refresh').evaluate(e => e.textContent = 'synthetic fixture');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(output, theme + '-teacher.png'), fullPage: true });
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Chrome 1280x900; isolated demo fixtures; screenshots:', output);
  } finally {
    if (browser) await browser.close();
    await server.stop();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
