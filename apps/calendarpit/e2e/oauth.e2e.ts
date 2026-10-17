import {
  expect,
  redirectAfter,
  sampleClient,
  test,
  toast,
} from './support/fixtures';

test('consent creates a connection that the admin UI can revoke', async ({
  page,
}) => {
  const params = new URLSearchParams({
    client_id: sampleClient.id,
    redirect_uri: sampleClient.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    state: 'e2e-state',
  });
  await page.goto(`/oauth/authorize?${params}`);
  await expect(
    page.getByRole('heading', { name: 'Connect your calendar.' }),
  ).toBeVisible();
  await page.getByLabel('Test user').selectOption('sam');
  const callback = await redirectAfter(page, () =>
    page.getByRole('button', { name: 'Approve' }).click(),
  );
  expect(callback.searchParams.get('state')).toBe('e2e-state');
  expect(callback.searchParams.get('code')).toBeTruthy();

  await page.goto('/connections');
  const connection = page
    .getByRole('listitem')
    .filter({ hasText: 'Sam Rivera' });
  await expect(connection.getByText('calendar.readonly')).toBeVisible();
  await expect(connection.getByText('Active')).toBeVisible();
  await connection.getByRole('button', { name: 'Revoke' }).click();
  await expect(toast(page)).toHaveText(
    'Connection revoked. Reconnect from your app.',
  );
  await expect(connection.getByText('Revoked')).toBeVisible();
});

test('denial returns access_denied to the client', async ({ page }) => {
  const params = new URLSearchParams({
    client_id: sampleClient.id,
    redirect_uri: sampleClient.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
  });
  await page.goto(`/oauth/authorize?${params}`);
  const callback = await redirectAfter(page, () =>
    page.getByRole('button', { name: 'Deny' }).click(),
  );
  expect(callback.searchParams.get('error')).toBe('access_denied');
});
