const { test, expect } = require('@playwright/test');
test('teacher awards a class, revokes one award and learner earns title points', async ({
  page,
}, info) => {
  await page.context().addInitScript(theme => localStorage.setItem('aiEnglishCourse.uiTheme.v1',theme),info.project.metadata.theme);
  const teacher = await page.context().newPage();
  const login = async (tab, teacherMode) => {
    await tab.goto('/login.html');
    if (teacherMode) await tab.getByRole('tab', { name: 'Teacher', exact: true }).click();
    else await tab.getByLabel('Your name').fill('Rex');
    await tab.getByLabel('Class code').fill('DEMO');
    await tab.locator('#pin').fill(teacherMode ? '0000' : '6666');
    await tab.getByRole('button', { name: 'Enter', exact: true }).click();
    await expect(tab.locator('html')).toHaveAttribute('data-ui-theme',info.project.metadata.theme);
    await expect(tab).toHaveURL(teacherMode ? /teacher.html/ : /workspace.html/);
  };
  await login(teacher, true);
  const awards = teacher
    .locator('tr')
    .filter({ has: teacher.locator('.stu-name', { hasText: 'Rex' }) })
    .locator('.award-controls');
  await awards.locator('summary').click();
  await awards.getByLabel('Award lesson').selectOption('1');
  await awards.getByLabel('Give to').selectOption('all');
  await awards.getByLabel('Award', { exact: true }).selectOption('activity');
  await awards.getByRole('button', { name: 'Give points' }).click();
  await expect(awards.getByRole('status')).toContainText('Rex · Awarded');
  await expect(awards.locator('summary')).toContainText('3 points');
  await awards.getByLabel(/Reason/).fill('Wrong group for this activity');
  await awards.getByRole('button', { name: 'Revoke' }).click();
  await expect(awards.getByRole('status')).toContainText('Revoked');
  await expect(awards.locator('summary')).toContainText('0 points');
  await teacher.close();
  await login(page, false);
  await page.setViewportSize({ width: 320, height: 844 });
  const title = page.locator('#card-site-title');
  await title.locator('input').fill('My creative site');
  await title.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('#award-notice')).toHaveText('+2 · Site title saved');
  await expect(page.locator('#personal-points')).toHaveText('2 points');
  await expect(page.locator('#class-total')).toContainText('/ 840');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('student-points-320.png') });
  await expect(title.locator('.field-award')).toHaveText('+2 · Site title saved');
  await page.reload();
  await expect(page.locator('#personal-points')).toHaveText('2 points');
  await expect(page.locator('#award-notice')).toBeEmpty();
});
