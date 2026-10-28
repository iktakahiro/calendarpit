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
  const revoke = connection.getByRole('button', {
    name: "Revoke Sam Rivera's connection to sample-app",
  });
  await revoke.click();
  const dialog = page.getByRole('alertdialog', {
    name: "Revoke Sam Rivera's connection to sample-app?",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(connection.getByText('Active')).toBeVisible();

  await revoke.click();
  await dialog.getByRole('button', { name: 'Revoke connection' }).click();
  await expect(
    toast(
      page,
      'Connection revoked. Its tokens no longer work; authorize again from your app.',
    ),
  ).toBeVisible();
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
