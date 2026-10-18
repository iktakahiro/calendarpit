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
  await page.getByRole('button', { name: 'Reset workspace' }).click();
  await page
    .getByRole('alertdialog', { name: 'Reset the workspace?' })
    .getByRole('button', { name: 'Reset workspace' })
    .click();
  await expect(toast(page, 'Startup state restored.')).toBeVisible();

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
  const entry = page
    .getByRole('button')
    .filter({ hasText: '/calendar/v3/users/me/calendarList' });
  await expect(entry).toContainText('401');
  await entry.click();
  await expect(page.getByText('[REDACTED]').first()).toBeVisible();
  await expect(page.getByText('not-a-real-token')).toHaveCount(0);
});
