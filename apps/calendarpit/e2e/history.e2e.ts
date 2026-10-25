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

test('shows loading history without the empty state and keeps the toolbar visible', async ({
  page,
}) => {
  const release = Promise.withResolvers<void>();
  await page.route('**/__calendarpit/history', async (route) => {
    await release.promise;
    await route.fulfill({ json: [] });
  });
  try {
    await page.goto('/history');
    await expect(
      page.getByRole('status').filter({ hasText: 'Loading API history…' }),
    ).toBeVisible();
    await expect(page.getByText('Waiting for your app.')).toHaveCount(0);
    await expect(
      page.getByRole('searchbox', { name: 'Filter requests' }),
    ).toBeEnabled();
    await expect(statusFilter(page, 'All 0')).toBeVisible();
    await expect(statusFilter(page, 'Errors 0')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Clear history' }),
    ).toBeDisabled();
  } finally {
    release.resolve();
  }
  await expect(page.getByText('Waiting for your app.')).toBeVisible();
  await expect(page.getByText('Loading API history…')).toHaveCount(0);
});

test('retries loading history after the initial read fails', async ({
  page,
}) => {
  await page.route('**/__calendarpit/history', (route) =>
    route.fulfill({ status: 500, json: { error: { message: 'Unavailable' } } }),
  );
  await page.goto('/history');

  const history = page.getByRole('region', { name: 'API requests' });
  const error = history.getByRole('alert');
  await expect(error).toHaveCount(1);
  await expect(
    error.getByRole('heading', { name: 'Could not load API history' }),
  ).toBeVisible();
  await expect(error).toContainText(
    'Check that the local Calendarpit server is running and try again.',
  );
  await expect(page.getByText('Waiting for your app.')).toHaveCount(0);
  await expect(history.getByText('Loading API history…')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Clear history' }),
  ).toBeDisabled();

  await page.unroute('**/__calendarpit/history');
  const release = Promise.withResolvers<void>();
  await page.route('**/__calendarpit/history', async (route) => {
    await release.promise;
    await route.continue();
  });
  const retry = error.getByRole('button', { name: 'Try again' });
  try {
    await retry.click();
    await expect(retry).toBeDisabled();
    await expect(error).toBeVisible();
    await expect(page.getByText('Waiting for your app.')).toHaveCount(0);
    await expect(history.getByText('Loading API history…')).toHaveCount(0);
  } finally {
    release.resolve();
  }

  await expect(error).toHaveCount(0);
  await expect(page.getByText('Waiting for your app.')).toBeVisible();
});

test('returns focus to the history retry button when a retry fails', async ({
  page,
}) => {
  await page.route('**/__calendarpit/history', (route) =>
    route.fulfill({ status: 500, json: { error: { message: 'Unavailable' } } }),
  );
  await page.goto('/history');
  const error = page
    .getByRole('region', { name: 'API requests' })
    .getByRole('alert');
  const retry = error.getByRole('button', { name: 'Try again' });
  await expect(retry).toBeEnabled();

  await page.unroute('**/__calendarpit/history');
  const release = Promise.withResolvers<void>();
  await page.route('**/__calendarpit/history', async (route) => {
    await release.promise;
    await route.fulfill({
      status: 500,
      json: { error: { message: 'Unavailable' } },
    });
  });
  try {
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(retry).toBeDisabled();
    await expect(error).toBeVisible();
  } finally {
    release.resolve();
  }
  await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();
  await expect(page.getByText('Waiting for your app.')).toHaveCount(0);
});

test('keeps loaded history rows visible when a refresh fails', async ({
  page,
  request,
}) => {
  await recordTraffic(request);
  await page.goto('/history');
  await expect(rows(page)).toHaveCount(3);

  await page.route('**/__calendarpit/history', (route) =>
    route.fulfill({ status: 500, json: { error: { message: 'Unavailable' } } }),
  );
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();

  await expect(toast(page, 'Unavailable')).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page)).toContainText([
    '/oauth/authorize',
    '/calendar/v3/calendars/primary/events',
    '/calendar/v3/users/me/calendarList',
  ]);
  const history = page.getByRole('region', { name: 'API requests' });
  await expect(history.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Waiting for your app.')).toHaveCount(0);
  await expect(history.getByText('Loading API history…')).toHaveCount(0);
});

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
  await expect(
    page.getByText('Showing 1 of 3 requests. Credentials are masked.'),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: /^1 matching request$/ }),
  ).toBeAttached();

  await statusFilter(page, 'Errors 0').click();
  await expect(page.getByText('No matching requests')).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
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
    name: 'Clear history?',
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
