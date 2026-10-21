import type { APIRequestContext, Page } from '@playwright/test';
import { expect, sampleClient, test, toast } from './support/fixtures';

/** Records two failed Calendar requests and one successful OAuth request. */
async function recordTraffic(request: APIRequestContext) {
  const headers = { Authorization: 'Bearer not-a-real-token' };
  for (const path of [
    '/calendar/v3/users/me/calendarList',
    '/calendar/v3/calendars/primary/events',
  ]) {
    expect((await request.get(path, { headers })).status()).toBe(401);
  }
  const params = new URLSearchParams({
    client_id: sampleClient.id,
    redirect_uri: sampleClient.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  });
  expect((await request.get(`/oauth/authorize?${params}`)).status()).toBe(200);
}

const statusFilter = (page: Page, name: string) =>
  page
    .getByRole('group', { name: 'Request status' })
    .getByRole('button', { name, exact: true });
const rows = (page: Page) =>
  page.getByRole('region', { name: 'API requests' }).getByRole('listitem');

test('history filters count matching requests and can be cleared', async ({
  page,
  request,
}) => {
  await recordTraffic(request);
  await page.goto('/history');
  await expect(rows(page)).toHaveCount(3);
  await expect(statusFilter(page, 'All 3')).toBeVisible();
  await expect(statusFilter(page, 'Errors 2')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Filter requests' }).fill('oauth');
  await expect(rows(page)).toHaveCount(1);
  await expect(statusFilter(page, 'All 1')).toBeVisible();
  await expect(statusFilter(page, 'Errors 0')).toBeVisible();
  await expect(page.getByText('Showing 1 of 3 requests.')).toBeVisible();

  await statusFilter(page, 'Errors 0').click();
  await expect(page.getByText('No matching requests')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(
    page.getByRole('searchbox', { name: 'Filter requests' }),
  ).toHaveValue('');
  await expect(statusFilter(page, 'All 3')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(rows(page)).toHaveCount(3);
});

test('clearing history asks first and is unavailable when empty', async ({
  page,
  request,
}) => {
  await recordTraffic(request);
  await page.goto('/history');
  const clear = page.getByRole('button', { name: 'Clear history' });
  const dialog = page.getByRole('alertdialog', {
    name: 'Clear the API history?',
  });

  await clear.click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(rows(page)).toHaveCount(3);

  await clear.click();
  await dialog.getByRole('button', { name: 'Clear history' }).click();
  await expect(dialog).toBeHidden();
  await expect(toast(page, 'History cleared.')).toBeVisible();
  await expect(page.getByText('Waiting for your app.')).toBeVisible();
  await expect(clear).toBeDisabled();
});
