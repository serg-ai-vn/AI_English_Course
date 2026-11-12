const { test, expect } = require('@playwright/test');

test('L3–L5 browser workflow: images, choices, unlock, build, preview, publish, download and correction revocation', async ({ page, browser }, info) => {
  test.setTimeout(180000);
  const theme = info.project.metadata.theme;
  await page.addInitScript(t => localStorage.setItem('aiEnglishCourse.uiTheme.v1', t), theme);
  async function login(p, teacher) {
    await p.goto('/login.html');
    if (teacher) await p.getByRole('tab', { name: 'Teacher', exact: true }).click();
    await p.getByLabel('Class code').fill('DEMO');
    if (!teacher) await p.getByLabel('Your name').fill('Nia');
    await p.locator('#pin').fill(teacher ? '0000' : '5555');
    await p.getByRole('button', { name: 'Enter', exact: true }).click();
    await expect(p).toHaveURL(teacher ? /teacher.html/ : /workspace.html/);
  }
  await login(page, false);
  const context = await browser.newContext({ baseURL: info.project.use.baseURL });
  await context.addInitScript(t => localStorage.setItem('aiEnglishCourse.uiTheme.v1', t), theme);
  const teacher = await context.newPage();
  teacher.on('dialog', d => d.accept());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  teacher.on('pageerror', e => errors.push(e.message));
  try {
    await login(teacher, true);
    const row = teacher.locator('tr').filter({ has: teacher.locator('.stu-name').getByText('Nia', { exact: true }) });
    const imagePrompt = (field, n) => `Subject: a fictional ${field}. Style: concept art. Framing: close-up. Lighting: soft light number ${n}.`;
    for (const field of ['avatar', 'background']) {
      const card = page.locator('#card-' + field);
      for (const n of [1, 2, 3]) {
        await card.locator('.prompt-area').fill(imagePrompt(field, n));
        await card.getByRole('button', { name: /^Generate (another )?image/i }).click();
        await card.getByPlaceholder('What is good about this image?').fill('I like the style');
        await card.getByPlaceholder('What needs to change?').fill('I want softer light');
        await card.getByRole('button', { name: /Save iteration/ }).click();
      }
      await card.getByRole('button', { name: 'Pick as best', exact: true }).nth(0).click();
      await card.getByPlaceholder('I like this one because...').fill('clear best result');
      await card.getByRole('button', { name: /Confirm best/ }).click();
      await expect(card.locator('.img-btn.selected.best')).toBeVisible();
      await card.getByRole('button', { name: 'Pick as worst', exact: true }).nth(1).click();
      await card.getByPlaceholder('This one is weak because...').fill('less suitable light');
      await card.getByRole('button', { name: /Confirm worst/ }).click();
      await card.getByRole('button', { name: /Accept this image/ }).click();
      await expect(card.locator('.status')).toHaveText('Accepted');
    }
    await teacher.getByRole('button', { name: 'Refresh', exact: true }).click();
    await row.getByRole('button', { name: 'Unlock Lesson 4', exact: true }).click();
    await page.reload();
    await expect(page.locator('#lesson-tag')).toContainText('Lesson 4');
    for (const i of [1, 2, 3]) {
      const card = page.locator('#card-hobby-image-' + i);
      await card.locator('.prompt-area').fill(imagePrompt('hobby-image-' + i, 1));
      await card.getByRole('button', { name: /^Generate Image/ }).click();
      await card.getByRole('button', { name: /Edit & Regenerate/ }).click();
      await card.locator('.improve-block input').fill('I want softer light');
      await card.locator('.improve-block textarea').fill(imagePrompt('hobby-image-' + i, 2));
      await card.getByRole('button', { name: /Regenerate Image/ }).click();
      await expect(card.locator('.step-badge').last()).toContainText('Version V2');
      await card.locator('select').selectOption('1');
      await card.getByRole('button', { name: /Publish to Website/ }).click();
      await expect(card.locator('.status')).toHaveText('Published');
    }
    const themeCard = page.locator('#card-theme');
    const prompt = word => `Role: designer Context: My site shows hobbies Task: suggest theme Format: ${word}`;
    await themeCard.locator('.prompt-area').fill(prompt('natural'));
    await themeCard.getByRole('button', { name: /^Generate Theme/ }).click();
    await expect(themeCard.getByRole('button', { name: /^Generate Option 2/ })).toBeVisible();
    await themeCard.locator('.prompt-area').fill(prompt('mysterious'));
    await themeCard.getByRole('button', { name: /^Generate Option 2/ }).click();
    await expect(themeCard.locator('.theme-option')).toHaveCount(2);
    await page.screenshot({ path: info.outputPath('L4-live-comparison.png'), fullPage: true });
    await themeCard.getByRole('button', { name: /^Choose Theme 1/ }).click();
    await themeCard.locator('.prompt-area').fill('This theme is calmer than the other theme.');
    await themeCard.getByRole('button', { name: /^Publish my theme/ }).click();
    await expect(themeCard.locator('.status')).toHaveText('Selected');
    await teacher.getByRole('button', { name: 'Refresh', exact: true }).click();
    await row.getByRole('button', { name: 'Build site', exact: true }).click();
    const preview = row.getByRole('link', { name: /^open dist/ });
    await expect(preview).toBeVisible();
    const previewURL = await preview.getAttribute('href');
    const popupPromise = teacher.waitForEvent('popup');
    await preview.click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await expect(popup.locator('body')).toContainText('Lumi'); // supplied synthetic L2 content
    await popup.close();
    await row.getByRole('button', { name: 'Unlock Lesson 5', exact: true }).click();
    await page.reload();
    const audit = page.locator('#card-audit');
    await audit.getByRole('checkbox').nth(0).check();
    await audit.getByRole('checkbox').nth(1).check();
    await audit.getByRole('button', { name: 'Confirm audit', exact: true }).click();
    await expect(audit.locator('.status')).toHaveText('Complete');
    for (const i of [1, 2, 3, 4, 5, 6]) {
      const card = page.locator('#card-reflection-' + i);
      await card.locator('textarea').fill('I will publish my creative website after I check every detail and explain the changes to my friends.');
      await card.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(card.locator('.status')).toHaveText('Saved');
    }
    await expect(page.locator('#complete-banner')).toBeVisible();
    await teacher.getByRole('button', { name: 'Refresh', exact: true }).click();
    await row.getByRole('button', { name: 'Publish site', exact: true }).click();
    const published = row.getByRole('link', { name: 'open published site', exact: true });
    await expect(published).toBeVisible();
    const publishedURL = await published.getAttribute('href');
    const downloadPromise = teacher.waitForEvent('download');
    await row.getByRole('link', { name: 'download file', exact: true }).click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    await teacher.screenshot({ path: info.outputPath('teacher-published.png'), fullPage: true });
    await row.getByRole('button', { name: 'Allow correction', exact: true }).click();
    const form = teacher.getByRole('form', { name: 'Allow correction for Nia', exact: true });
    await form.getByLabel('Completed field').selectOption('site-title');
    await form.getByLabel('Reason for reopening').fill('Please improve the title.');
    await form.getByRole('button', { name: 'Grant correction', exact: true }).click();
    await page.getByRole('button', { name: 'Lesson 2', exact: true }).click();
    const titleCard = page.locator('#card-site-title');
    await titleCard.getByRole('button', { name: 'Correct this field', exact: true }).click();
    const correction = titleCard.getByRole('form');
    await correction.getByLabel('Corrected Site title').fill('Nia Creative World');
    await correction.getByLabel('Reason for correction').fill('This title matches my project.');
    await correction.getByRole('button', { name: 'Save correction', exact: true }).click();
    await expect(correction).toBeHidden();
    expect((await teacher.request.get(previewURL)).status()).toBe(403);
    expect((await teacher.request.get(publishedURL)).status()).toBe(404);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
