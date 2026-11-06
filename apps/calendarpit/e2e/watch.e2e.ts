import { expect, redirectAfter, sampleClient, test } from './support/fixtures';

test('shows empty channel and delivery states', async ({ page }) => {
  await page.goto('/watch');
  const channels = page.getByRole('region', { name: 'Watch channels' });
  const deliveries = page.getByRole('region', { name: 'Delivery log' });
  await expect(channels.getByText('0 active channels')).toBeVisible();
  await expect(channels.getByText('No active channels')).toBeVisible();
  await expect(deliveries.getByText('No deliveries yet')).toBeVisible();
});

test('shows a channel and the reason its initial delivery failed', async ({
  page,
  request,
}) => {
  const params = new URLSearchParams({
    client_id: sampleClient.id,
    redirect_uri: sampleClient.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
  });
  await page.goto(`/oauth/authorize?${params}`);
  const callback = await redirectAfter(page, () =>
    page.getByRole('button', { name: 'Approve' }).click(),
  );
  const code = callback.searchParams.get('code');
  expect(code).toBeTruthy();
  const tokenResponse = await request.post('/oauth/token', {
    form: {
      grant_type: 'authorization_code',
      client_id: sampleClient.id,
      client_secret: 'local-sample-secret',
      redirect_uri: sampleClient.redirectUri,
      code: code!,
    },
  });
  expect(tokenResponse.ok()).toBe(true);
  const { access_token } = (await tokenResponse.json()) as {
    access_token: string;
  };

  await page.goto('/watch');
  const channels = page.getByRole('region', { name: 'Watch channels' });
  const deliveries = page.getByRole('region', { name: 'Delivery log' });
  await expect(channels.getByText('No active channels')).toBeVisible();
  await expect(deliveries.getByText('No deliveries yet')).toBeVisible();

  // An unused loopback port makes the callback fail without a webhook server.
  const address = 'http://127.0.0.1:1/hook';
  const response = await request.post(
    '/calendar/v3/calendars/primary/events/watch',
    {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { id: 'watch-e2e', type: 'web_hook', address },
    },
  );
  expect(response.status()).toBe(200);

  const channel = channels
    .getByRole('listitem')
    .filter({ hasText: 'watch-e2e' });
  await expect(
    channels.getByText('1 active channel', { exact: true }),
  ).toBeVisible();
  await expect(channel.getByText('alex-work', { exact: true })).toBeVisible();
  await expect(channel.getByText(address, { exact: true })).toBeVisible();
  await expect(channel.getByText('Watching', { exact: true })).toBeVisible();

  const delivery = deliveries
    .getByRole('row')
    .filter({ hasText: 'watch-e2e / #1' });
  await expect(delivery.getByText('sync', { exact: true })).toBeVisible();
  await expect(delivery.getByText('3 attempts', { exact: true })).toBeVisible();
  await expect(
    delivery.getByText('Failed · Connection error', { exact: true }),
  ).toBeVisible();
});
