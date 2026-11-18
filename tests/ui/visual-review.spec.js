const { test, expect } = require('@playwright/test');
const sharp = require('sharp');
async function captureCard(page, card, destination) {
  // Capture the real full page at its top, then crop the card. This keeps the
  // sticky navigation out of card evidence without changing product styles.
  await page.evaluate(() => window.scrollTo(0, 0));
  const bounds = await card.boundingBox();
  const full = await page.screenshot({ fullPage: true });
  await sharp(full).extract({ left: Math.floor(bounds.x), top: Math.floor(bounds.y), width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) }).toFile(destination);
}

test('review fixes: lesson landmarks, single-line helpers, one completion signal and unified hobbies', async ({ page }, info) => {
  await page.addInitScript(t => localStorage.setItem('aiEnglishCourse.uiTheme.v1', t), info.project.metadata.theme);
  await page.goto('/login.html');
  const auth = await (await page.request.post('/api/login', { data: { classCode: 'DEMO', name: 'Lumi', pin: '1111' } })).json();
  await page.evaluate(t => localStorage.setItem('token', t), auth.token);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const lesson of [2, 3, 4]) {
    const switched = await (await page.request.post('/api/lesson-switch', { data: { lesson }, headers: { Authorization: 'Bearer ' + auth.token } })).json();
    expect(switched.ok).toBe(true);
    await page.goto('/workspace.html');
    await expect(page.locator('#driving-question')).toBeVisible();
    await expect(page.locator('#driving-question')).toContainText('How can I critically partner');
    if (lesson === 3) {
      await page.route('**/api/me', async route => {
        const response = await route.fetch(); const me = await response.json();
        delete me.config.drivingQuestion;
        await route.fulfill({ response, json: me });
      });
      await page.reload();
      await expect(page.locator('#driving-question')).toBeVisible();
      await page.unroute('**/api/me');
    }
    const goal = page.locator('.helper-panel').first();
    await goal.locator(':scope > summary').click();
    await expect(goal.locator('.goal-card')).toHaveCount(3);
    await goal.locator('.all-requirements > summary').click();
    const requirements = goal.locator('.requirement-grid > li');
    expect(await requirements.count()).toBeGreaterThanOrEqual(5);
    expect(await goal.locator('.requirement-head').count()).toBe(await requirements.count());
    await page.screenshot({ path: info.outputPath('L' + lesson + '-goals-and-rules.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const summary of await page.locator('.helper-panel > summary').all()) {
      expect(await summary.evaluate(e => getComputedStyle(e).whiteSpace)).toBe('nowrap');
      expect(await summary.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('.step-stripe, .published-label')).toHaveCount(0);
    await expect(page.locator('.field-card.done > .task-stepper')).toHaveCount(0);
    if (lesson === 2) {
      await expect(page.locator('.hobby-group')).toHaveCount(3);
      await expect(page.locator('#hobby-group-1 #card-hobby-title-1')).toHaveCount(1);
      await expect(page.locator('#hobby-group-1 #card-hobby-text-1')).toHaveCount(1);
      await expect(page.locator('#hobby-group-1 > .field-head .status')).toHaveText('Published');
      await page.locator('#card-about-me .iteration-panel').first().locator('summary').click();
      await captureCard(page, page.locator('#card-about-me'), info.outputPath('L2-completed.png'));
    } else {
      const image = page.locator(lesson === 3 ? '#card-avatar' : '#card-hobby-image-1');
      await image.locator('.iteration-panel').first().locator('summary').click();
      await captureCard(page, image, info.outputPath('L' + lesson + '-completed.png'));
    }
  }
  // Fresh profile: saving the name in the unified card must retain a prompt draft.
  const fresh = await (await page.request.post('/api/login', { data: { classCode: 'DEMO', name: 'Khoa', pin: '4444' } })).json();
  await page.evaluate(t => localStorage.setItem('token', t), fresh.token);
  await page.goto('/workspace.html');
  const hobby = page.locator('#hobby-group-1');
  await hobby.getByRole('textbox', { name: 'Hobby name', exact: true }).fill('Skating');
  await hobby.getByRole('textbox', { name: 'Context', exact: true }).fill('I have skated for two years.');
  const otherName = page.locator('#hobby-group-2').getByRole('textbox', { name: 'Hobby name', exact: true });
  await otherName.fill('Drawing');
  await hobby.locator('#card-hobby-title-1').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(hobby.locator('#card-hobby-title-1 .final-text')).toHaveText('Skating');
  await expect(hobby.getByRole('textbox', { name: 'Context', exact: true })).toHaveValue('I have skated for two years.');
  await expect(otherName).toHaveValue('Drawing');
  await expect(hobby.locator('.gate-note')).not.toContainText('server');
  await expect(hobby.locator('.gate-state').first()).toHaveText('To do');
  await captureCard(page, hobby, info.outputPath('L2-unified-hobby.png'));
  expect(errors).toEqual([]);
});
