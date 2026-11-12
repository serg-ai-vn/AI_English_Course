const { test, expect } = require('@playwright/test');
const key = 'aiEnglishCourse.uiTheme.v1';
async function fillPrompt(card, text) {
  for (const label of ['Role', 'Context', 'Task', 'Format']) {
    const match = new RegExp(label + ':\\s*([\\s\\S]*?)(?=\\s*(?:Role|Context|Task|Format):|$)', 'i').exec(text);
    await card.getByRole('textbox', { name: label, exact: true }).fill(match ? match[1].trim() : '');
  }
  return card.locator('textarea.prompt-area').inputValue();
}

test('L2 browser workflow: validation, provider failure, loading, generation, review, edit and completion', async ({ page }, info) => {
  await page.addInitScript(t => localStorage.setItem('aiEnglishCourse.uiTheme.v1', t), info.project.metadata.theme);
  await page.goto('/login.html');
  await page.getByLabel('Class code').fill('DEMO');
  await page.getByLabel('Your name').fill('Neo');
  await page.locator('#pin').fill('3333');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect(page).toHaveURL(/workspace.html/);
  const card = page.locator('#card-about-me');
  await expect(page.locator('.helper-panel')).toHaveCount(3);
  await expect(page.locator('.helper-panel[open]')).toHaveCount(0);
  const wordHelp = page.locator('.helper-panel').nth(1);
  await wordHelp.locator(':scope > summary').press('Enter');
  await wordHelp.locator('.word-help').first().locator('summary').click();
  await expect(wordHelp.locator('[lang="vi"]').first()).toBeVisible();
  await wordHelp.locator(':scope > summary').click();
  await card.getByRole('button', { name: /Generate Text/ }).click();
  await expect(card.locator('.error-box')).toContainText('Write a prompt first');
  const prompt = await fillPrompt(card, 'Role: a creative student. Context: I have played football for three years. Task: Write an energetic introduction. Format: one paragraph.');
  await expect(card.locator('.gate-chip.met')).toHaveCount(4);
  await expect(card.locator('.word-used')).not.toHaveCount(0);
  if (info.project.metadata.theme === 'classroom-light') {
    expect(await card.locator('.word-used').first().evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(234, 250, 240)');
    expect(await card.locator('.prompt-builder .struct-label').first().evaluate(e => getComputedStyle(e).color)).toBe('rgb(20, 20, 20)');
  }
  const before = await (await page.request.get('/api/me')).json();
  await page.route('**/api/prompt', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, errors: [{ hint: 'Provider timed out. Retry your request.' }] }) }), { times: 1 });
  await card.getByRole('button', { name: /Generate Text/ }).click();
  await expect(card.locator('.error-box')).toContainText('Provider timed out');
  await expect(card.locator('.prompt-area')).toHaveValue(prompt);
  expect(await (await page.request.get('/api/me')).json()).toEqual(before);
  await card.screenshot({ path: info.outputPath('L2-provider-error.png') });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await card.screenshot({ path: info.outputPath('L2-builder-320.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/prompt', async r => { await gate; await r.continue(); }, { times: 1 });
  await card.getByRole('button', { name: /Generate Text/ }).click();
  await expect(card.getByRole('button', { name: /Generate Text/ })).toBeDisabled();
  await card.screenshot({ path: info.outputPath('L2-loading.png') });
  release();
  for (const step of [1, 2]) {
    await expect(card.locator('.ai-draft-box').last()).toBeVisible();
    await card.getByPlaceholder('What is good about this text?').fill('Clear useful words');
    await card.getByPlaceholder('What needs to change?').fill('More personal style');
    await card.screenshot({ path: info.outputPath('L2-eval-' + step + '.png') });
    await card.getByRole('button', { name: new RegExp('Save Step ' + step) }).click();
    if (step === 1) {
      await expect(card.locator('.iteration-panel')).toHaveCount(1);
      await expect(card.locator('.iteration-panel')).not.toHaveAttribute('open', '');
      await fillPrompt(card, prompt + ' Keep the language clear.');
      const format = card.getByRole('textbox', { name: 'Format', exact: true });
      const value = await format.inputValue();
      await format.focus();
      const saved = await (await page.request.get('/api/me')).json();
      await card.locator('.iteration-panel').evaluate(d => { d.open = true; });
      await expect(format).toBeFocused();
      await expect(format).toHaveValue(value);
      await expect(card.locator('.iteration-panel .ai-draft-box')).toBeVisible();
      await card.locator('.iteration-panel').evaluate(d => { d.open = false; });
      expect(await (await page.request.get('/api/me')).json()).toEqual(saved);
      await card.getByRole('button', { name: /Regenerate Text/ }).click();
    }
  }
  await expect(card.locator('.operator-edit')).toBeVisible();
  await expect(card.getByRole('button', { name: /Publish to Website/ })).toBeDisabled();
  await card.locator('.operator-edit').fill(await card.locator('.operator-edit').inputValue() + ' Hello!');
  await card.getByRole('button', { name: /Publish to Website/ }).click();
  await expect(card.locator('.status')).toHaveText('Done');
  await expect(card.locator('.published-text')).toBeVisible();
  await expect(card.locator('.iteration-panel')).toHaveCount(2);
  const panels = card.locator('.iteration-panel');
  await panels.nth(0).locator('summary').click();
  await panels.nth(1).locator('summary').click();
  await expect(panels.nth(0)).toHaveAttribute('open', '');
  await expect(panels.nth(1)).toHaveAttribute('open', '');
  await panels.nth(0).locator('summary').click();
  await expect(panels.nth(0)).not.toHaveAttribute('open', '');
  await expect(panels.nth(1)).toHaveAttribute('open', '');
  await expect(card.locator('.done-detail')).toBeVisible();
  const snapshot = await (await page.request.get('/api/me')).json();
  await page.evaluate(() => window.PlatformTheme.setTheme('night-lab'));
  await page.evaluate(() => window.PlatformTheme.setTheme('classroom-light'));
  await expect(card.locator('.done-detail')).toBeVisible();
  expect(await (await page.request.get('/api/me')).json()).toEqual(snapshot);
  await page.evaluate(t => window.PlatformTheme.setTheme(t), info.project.metadata.theme);
  await card.screenshot({ path: info.outputPath('L2-completed-journal.png') });
});

test('preference: defaults, invalid values, persistence, storage exceptions and keyboard', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/login.html');
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'classroom-light');
  await page.evaluate(k => {
    localStorage.setItem(k, 'unknown');
    localStorage.setItem('studentName', 'Synthetic learner');
  }, key);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'classroom-light');
  await page.evaluate(() => window.PlatformTheme.setTheme('night-lab'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'night-lab');
  await page.getByLabel('Class code').fill('DEMO');
  await page.getByLabel('Your name').fill('Ziggy');
  await page.locator('#pin').fill('2222');
  await page.locator('#pin').press('Enter');
  await expect(page).toHaveURL(/workspace.html/);
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'night-lab');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/login.html/);
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'night-lab');
  await page.evaluate(() => window.PlatformTheme.setTheme('classroom-light'));
  await page.getByLabel('Class code').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Your name')).toBeFocused();
  expect(await page.getByLabel('Your name').evaluate(e => getComputedStyle(e).outlineStyle)).toBe('solid');
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('read blocked'); };
    Storage.prototype.setItem = () => { throw new Error('write blocked'); };
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'classroom-light');
  await page.evaluate(() => window.PlatformTheme.setTheme('night-lab'));
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'night-lab');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ui-theme', 'classroom-light');
});

test('responsive shells L2–L5, teacher, font fallback and hidden gates', async ({ page }, info) => {
  const theme = info.project.metadata.theme;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() === 404 && new URL(r.url()).origin === new URL(page.url()).origin) errors.push(r.url()); });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  await page.addInitScript(t => localStorage.setItem('aiEnglishCourse.uiTheme.v1', t), theme);
  await page.goto('/login.html');
  const sizes = [[1280, 900], [1366, 768], [768, 1024], [390, 844], [320, 844]];
  async function check(label) {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' ' + width).toBeTruthy();
      const capture = label === 'L4-comparison' ? page.locator('.dual-preview') : page;
      await capture.screenshot({ path: info.outputPath(label + '-' + width + '.png') });
    }
  }
  await check('login');
  const student = await (await page.request.post('/api/login', { data: { classCode: 'DEMO', name: 'Lumi', pin: '1111' } })).json();
  const teacher = await (await page.request.post('/api/login', { data: { classCode: 'DEMO', role: 'teacher', pin: '0000' } })).json();
  // Existing pilot-1 profile; unlock through the normal teacher endpoint.
  const unlock = await (await page.request.post('/api/teacher/unlock-lesson', { data: { studentId: 'lumi', lesson: 5 }, headers: { Authorization: 'Bearer ' + teacher.token } })).json();
  expect(unlock.ok).toBeTruthy();
  await page.evaluate(t => localStorage.setItem('token', t), student.token);
  for (const lesson of [2, 3, 4, 5]) {
    const switched = await (await page.request.post('/api/lesson-switch', { data: { lesson }, headers: { Authorization: 'Bearer ' + student.token } })).json();
    expect(switched.ok).toBeTruthy();
    await page.goto('/workspace.html');
    await expect(page.locator('#lesson-tag')).toContainText('Lesson ' + lesson);
    await page.locator('.field-card').first().waitFor();
    await expect(page.locator('#reset-all-btn')).toBeHidden();
    await check('L' + lesson);
    if (lesson === 4) {
      // A read-only presentation fixture exercises the active comparison stage.
      // It does not change the saved profile or bypass a gate on the server.
      await page.route('**/api/me', async route => {
        const response = await route.fetch();
        const me = await response.json();
        me.progress.fields.theme.status = 'working';
        me.progress.fields.theme.nextStep = 'compare';
        await route.fulfill({ response, json: me });
      });
      await page.reload();
      await expect(page.locator('.theme-option')).toHaveCount(2);
      const samples = () => page.locator('.swatch, .theme-sample').evaluateAll(nodes => nodes.map(n => ({
        fill: n.classList.contains('swatch') ? getComputedStyle(n).backgroundColor : null,
        font: n.classList.contains('theme-sample') ? getComputedStyle(n).fontFamily : null,
        style: n.getAttribute('style'),
      })));
      await page.evaluate(() => window.PlatformTheme.setTheme('night-lab'));
      const before = await samples();
      await page.evaluate(() => window.PlatformTheme.setTheme('classroom-light'));
      expect(await samples()).toEqual(before);
      expect(before).toHaveLength(10);
      await page.evaluate(t => window.PlatformTheme.setTheme(t), theme);
      await check('L4-comparison');
      await page.unroute('**/api/me');
    }
  }
  await page.evaluate(t => localStorage.setItem('token', t), teacher.token);
  await page.goto('/teacher.html');
  await page.locator('.student-table').waitFor();
  await check('teacher');
  // Chromium CSS zoom exercises reflow at the equivalent of 200% on desktop.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => document.documentElement.style.zoom = '2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: info.outputPath('teacher-200-percent.png') });
  expect(errors).toEqual([]);
});
