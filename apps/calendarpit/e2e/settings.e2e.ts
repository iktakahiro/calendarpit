import { expect, sectionLink, test, toast } from './support/fixtures';

test('reset restores the startup fixture after changes', async ({
  page,
  request,
}) => {
  const deleted = await request.delete(
    '/__calendarpit/calendars/alex-work/events/planning',
    { data: {} },
  );
  expect(deleted.status()).toBe(204);
  await page.goto('/');
  await expect(page.getByText('Nothing scheduled')).toBeVisible();

  await sectionLink(page, 'Settings').click();
  await page.getByRole('tab', { name: 'Test data' }).click();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Reset workspace' }).click();
  await expect(toast(page)).toHaveText('Startup state restored.');

  await sectionLink(page, 'Schedule').click();
  await expect(page.getByText('Weekly planning')).toBeVisible();
});

test('protocol history records API calls with secrets masked', async ({
  page,
  request,
}) => {
  const response = await request.get('/calendar/v3/users/me/calendarList', {
    headers: { Authorization: 'Bearer not-a-real-token' },
  });
  expect(response.status()).toBe(401);
  await page.goto('/history');
  const entry = page.locator('details').filter({ hasText: 'calendarList' });
  await expect(entry.getByText('401')).toBeVisible();
  await entry.locator('summary').click();
  await expect(entry.getByText('[REDACTED]').first()).toBeVisible();
  await expect(entry.getByText('not-a-real-token')).toHaveCount(0);
});
