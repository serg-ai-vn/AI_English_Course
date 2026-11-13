const { test, expect } = require('@playwright/test');
const sharp = require('sharp');

async function capture(page, locator, destination) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const b = await locator.boundingBox();
  const shot = await page.screenshot({ fullPage: true });
  await sharp(shot).extract({ left: Math.floor(b.x), top: Math.floor(b.y), width: Math.ceil(b.width), height: Math.ceil(b.height) }).toFile(destination);
}

test('learning support: independent glossary cards, useful language, image feedback and theme history', async ({ page }, info) => {
  await page.addInitScript(t => localStorage.setItem('aiEnglishCourse.uiTheme.v1', t), info.project.metadata.theme);
  await page.goto('/login.html');
  const auth = await (await page.request.post('/api/login', { data: { classCode: 'DEMO', name: 'Lumi', pin: '1111' } })).json();
  const headers = { Authorization: 'Bearer ' + auth.token };
  await page.evaluate(t => localStorage.setItem('token', t), auth.token);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const lesson of [2, 3, 4]) {
    expect((await page.request.post('/api/lesson-switch', { data: { lesson }, headers })).ok()).toBe(true);
    const before = await (await page.request.get('/api/me', { headers })).json();
    await page.goto('/workspace.html');
    await expect(page.locator('#lesson-tag')).toContainText('Lesson ' + lesson);
    await expect(page.locator('#vocab-strip')).toBeHidden();
    await expect(page.locator('#vocab-strip > *')).toHaveCount(0);
    const panels = page.locator('.helper-panel');
    const words = panels.nth(1);
    await words.locator(':scope > summary').click();
    const cards = words.locator('.word-help');
    await expect(cards).toHaveCount(({ 2: 6, 3: 10, 4: 18 })[lesson]);
    for (const card of await cards.all()) {
      expect(await card.locator('.word-meaning p').textContent()).toBeTruthy();
      expect(await card.locator('p[lang="vi"]').textContent()).toBeTruthy();
    }
    await cards.nth(0).locator('summary').click();
    await cards.nth(1).locator('summary').click();
    await expect(cards.nth(0).locator('p[lang="vi"]')).toBeVisible();
    await expect(cards.nth(1).locator('p[lang="vi"]')).toBeVisible();
    await cards.nth(0).locator('summary').click();
    await expect(cards.nth(0).locator('p[lang="vi"]')).toBeHidden();
    await expect(cards.nth(1).locator('p[lang="vi"]')).toBeVisible();
    await cards.nth(0).locator('summary').click();
    await capture(page, words, info.outputPath('L' + lesson + '-glossary.png'));
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture(page, words, info.outputPath('L' + lesson + '-glossary-320.png'));
    await page.setViewportSize({ width: 1280, height: 900 });
    await words.locator(':scope > summary').click();
    const support = panels.nth(2);
    await support.locator(':scope > summary').click();
    await expect(support.locator('.language-card')).toHaveCount(3);
    await expect(support.locator(':scope > summary')).not.toContainText('Language tips');
    if (lesson === 2) {
      for (const clue of ['for = how long', 'since = when it started', 'ever', 'never', 'already', 'yet', 'yesterday']) await expect(support).toContainText(clue);
    } else {
      await expect(support.locator('.sentence-frame')).toHaveCount(3);
      await expect(support).toContainText('because');
    }
    await capture(page, support, info.outputPath('L' + lesson + '-language.png'));
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await support.locator(':scope > summary').click();
    const goals = panels.first();
    await goals.locator(':scope > summary').click();
    await goals.locator('.all-requirements > summary').click();
    if (lesson === 2) {
      await expect(goals.locator('.requirement-grid > li').first().locator('.requirement-line')).toHaveCount(3);
      await expect(goals).toContainText('include at least 2 different words from today’s vocabulary');
    }
    await capture(page, goals, info.outputPath('L' + lesson + '-requirements.png'));
    await goals.locator(':scope > summary').click();

    if (lesson === 3) {
      const card = page.locator('#card-avatar');
      const first = card.locator('.iteration-panel').first();
      await first.locator('summary').click();
      const layout = first.locator('.image-review-layout');
      await expect(layout.getByRole('heading', { name: '✓ What I like', exact: true })).toBeVisible();
      await expect(layout.getByRole('heading', { name: '🔧 What needs to change', exact: true })).toBeVisible();
      await expect(layout.locator('.image-review-text').first()).toHaveText(before.progress.fields.avatar.iterations[0].pros);
      const image = await layout.locator('img').boundingBox();
      const feedback = await layout.locator('.image-feedback').boundingBox();
      expect(feedback.x).toBeGreaterThan(image.x + image.width);
      expect(Math.abs(feedback.y - image.y)).toBeLessThan(2);
      const titleColor = await first.locator('.iteration-title').evaluate(e => getComputedStyle(e).color);
      expect(titleColor).toBe(await first.locator('.iteration-state').evaluate(e => getComputedStyle(e).color));
      for (const summary of await card.locator('.iteration-summary').all()) {
        await expect(summary).not.toContainText(/Show|Hide/);
        expect(await summary.evaluate(e => getComputedStyle(e, '::after').content)).toMatch(/^(none|normal|"")$/);
      }
      await capture(page, card, info.outputPath('L3-image-feedback.png'));
      await page.setViewportSize({ width: 320, height: 844 });
      const mobileImage = await layout.locator('img').boundingBox();
      const mobileFeedback = await layout.locator('.image-feedback').boundingBox();
      expect(mobileFeedback.y).toBeGreaterThanOrEqual(mobileImage.y + mobileImage.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(page, first, info.outputPath('L3-image-feedback-320.png'));
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    if (lesson === 4) {
      const imageCard = page.locator('#card-hobby-image-1');
      await imageCard.locator('.iteration-panel').nth(1).locator('summary').click();
      await expect(imageCard.locator('.image-review-card.change')).toContainText('Why I changed it');
      await capture(page, imageCard, info.outputPath('L4-image-history.png'));
      const history = page.locator('#card-theme .theme-history');
      const options = history.locator('.iteration-panel');
      await expect(options).toHaveCount(2);
      const chosen = before.progress.fields.theme.choice;
      await expect(history.locator('.theme-choice-card .theme-option-head')).toContainText('Option ' + chosen);
      await expect(history.locator('.theme-justification')).toHaveText(before.progress.fields.theme.justification);
      await expect(options.nth(chosen - 1).locator('summary')).toContainText('Selected');
      await options.nth(0).locator('summary').click();
      await options.nth(1).locator('summary').click();
      await expect(options.nth(0).locator('.prompt-shown')).toBeVisible();
      await expect(options.nth(1).locator('.prompt-shown')).toBeVisible();
      await options.nth(0).locator('summary').click();
      await expect(options.nth(0).locator('.prompt-shown')).toBeHidden();
      await expect(options.nth(1).locator('.prompt-shown')).toBeVisible();
      await options.nth(0).locator('summary').click();
      const fills = await history.locator('.swatch, .theme-sample').evaluateAll(es => es.map(e => e.getAttribute('style')));
      await page.evaluate(t => window.PlatformTheme.setTheme(t), info.project.metadata.theme === 'night-lab' ? 'classroom-light' : 'night-lab');
      expect(await history.locator('.swatch, .theme-sample').evaluateAll(es => es.map(e => e.getAttribute('style')))).toEqual(fills);
      await page.evaluate(t => window.PlatformTheme.setTheme(t), info.project.metadata.theme);
      await capture(page, page.locator('#card-theme'), info.outputPath('L4-theme-history.png'));
      await page.setViewportSize({ width: 320, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(page, page.locator('#card-theme'), info.outputPath('L4-theme-history-320.png'));
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    const after = await (await page.request.get('/api/me', { headers })).json();
    expect(after.progress).toEqual(before.progress);
  }
  expect(errors).toEqual([]);
});
