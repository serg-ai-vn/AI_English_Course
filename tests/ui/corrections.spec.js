const { test, expect } = require('@playwright/test');
async function login(page, teacher = false) {
  await page.goto('/login.html');
  await page.getByRole('tab', { name: teacher ? 'Teacher' : 'Student', exact: true }).click();
  await page.getByLabel('Class code').fill('DEMO');
  if (!teacher) await page.getByLabel('Your name').fill('Lumi');
  await page.locator('#pin').fill(teacher ? '0000' : '1111');
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
  await expect(page).toHaveURL(teacher ? /teacher.html/ : /workspace.html/);
}
async function grant(teacher, field) {
  const row = teacher
    .locator('tr')
    .filter({ has: teacher.locator('.stu-name').getByText('Lumi', { exact: true }) });
  await row.getByRole('button', { name: 'Allow correction', exact: true }).click();
  const form = teacher.getByRole('form', { name: 'Allow correction for Lumi', exact: true });
  await form.getByLabel('Completed field').selectOption(field);
  await form.getByLabel('Reason for reopening').fill('Please improve this completed field.');
  await form.getByRole('button', { name: 'Grant correction', exact: true }).click();
  await expect(form).toBeHidden();
}
test('teacher/student UI: login, L1 mark, named fields, retained drafts, invalid/save/reload, image and theme selectors', async ({
  page,
  browser,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  const tctx = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const teacher = await tctx.newPage();
  teacher.on('pageerror', (e) => errors.push(e.message));
  try {
    await login(teacher, true);
    const row = teacher
      .locator('tr')
      .filter({ has: teacher.locator('.stu-name').getByText('Lumi', { exact: true }) });
    await row.getByRole('button', { name: 'Allow correction', exact: true }).click();
    let form = teacher.getByRole('form', { name: 'Allow correction for Lumi', exact: true });
    await form.getByLabel('Completed field').selectOption('site-title');
    await form.getByLabel('Reason for reopening').fill('Preserve this teacher draft');
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(form).toBeHidden();
    await row.getByRole('button', { name: 'Allow correction', exact: true }).click();
    await expect(form.getByLabel('Reason for reopening')).toHaveValue(
      'Preserve this teacher draft',
    );
    await teacher.locator('#auto-toggle').check();
    await teacher.waitForTimeout(5200);
    await expect(form.getByLabel('Reason for reopening')).toHaveValue(
      'Preserve this teacher draft',
    );
    await form.getByRole('button', { name: 'Grant correction', exact: true }).click();
    await expect(form).toBeHidden();
    await row.getByRole('button', { name: 'Allow correction', exact: true }).click();
    await expect(form.getByText(/^Granted /)).toBeVisible();
    await teacher.evaluate(() => window.scrollTo(0, 0));
    await teacher.screenshot({ path: testInfo.outputPath('teacher-grant-form.png') });
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await row.getByLabel('L1 paper work checked for Lumi').check();
    await expect(row.getByLabel('L1 paper work checked for Lumi')).toBeEnabled();
    await page.request.post('/api/lesson-switch', { data: { lesson: 2 } });
    await page.reload();
    const card = page.locator('#card-site-title');
    await card.getByRole('button', { name: 'Correct this field', exact: true }).click();
    form = card.getByRole('form', { name: 'Correct Site title', exact: true });
    const text = form.getByLabel('Corrected Site title'),
      reason = form.getByLabel('Reason for correction');
    await text.fill('x'.repeat(100));
    await reason.fill('Keep this correction draft');
    await form.getByRole('button', { name: 'Save correction', exact: true }).click();
    await expect(form.locator('.error-box')).toBeVisible();
    await expect(text).toHaveValue('x'.repeat(100));
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
    await card.getByRole('button', { name: 'Correct this field', exact: true }).click();
    await expect(text).toHaveValue('x'.repeat(100));
    await expect(reason).toHaveValue('Keep this correction draft');
    await text.fill('Lumi Creative Space');
    await page.screenshot({ path: testInfo.outputPath('student-correction.png') });
    await form.getByRole('button', { name: 'Save correction', exact: true }).click();
    await expect(card.getByRole('form')).toBeHidden();
    await page.reload();
    const me = await (await page.request.get('/api/me')).json();
    expect(me.progress.fields['site-title'].value).toBe('Lumi Creative Space');
    expect(me.progress.fields['site-title'].corrections).toHaveLength(1);
    expect(me.progress.fields['site-title'].status).toBe('done');
    expect(me.progress.l1Ready).toBeTruthy();
    await grant(teacher, 'avatar');
    await page.request.post('/api/lesson-switch', { data: { lesson: 3 } });
    await page.reload();
    const avatar = page.locator('#card-avatar');
    await avatar.getByRole('button', { name: 'Correct this field', exact: true }).click();
    const imageForm = avatar.getByRole('form');
    await expect(imageForm.locator('select option')).toHaveCount(3);
    await imageForm.locator('select').selectOption('2');
    await expect(imageForm.getByAltText('Selected correction version')).toBeVisible();
    await imageForm.getByLabel('Reason for correction').fill('The second version is clearer.');
    await imageForm.getByRole('button', { name: 'Save correction', exact: true }).click();
    await expect(avatar.getByRole('form')).toBeHidden();
    await grant(teacher, 'theme');
    await page.request.post('/api/lesson-switch', { data: { lesson: 4 } });
    await page.reload();
    const theme = page.locator('#card-theme');
    await theme.getByRole('button', { name: 'Correct this field', exact: true }).click();
    const themeForm = theme.getByRole('form');
    await themeForm.locator('select').selectOption('1');
    await themeForm
      .getByLabel('Reason for correction')
      .fill('This theme is calmer and softer than the second theme.');
    await themeForm.getByRole('button', { name: 'Save correction', exact: true }).click();
    await expect(theme.getByRole('form')).toBeHidden();
    const updated = await (await page.request.get('/api/me')).json();
    expect(updated.progress.fields.theme.choice).toBe(1);
    expect(updated.progress.theme).toBe(updated.progress.fields.theme.option1.preset);
    await teacher.screenshot({ path: testInfo.outputPath('teacher-corrections.png') });
    expect(errors).toEqual([]);
  } finally {
    await tctx.close();
  }
});
