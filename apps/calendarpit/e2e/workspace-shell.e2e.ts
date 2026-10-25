import { expect, test } from './support/fixtures';

test('retries loading the workspace after the initial request fails', async ({
  page,
}) => {
  await page.route('**/__calendarpit/state', (route) =>
    route.fulfill({ status: 500, json: { error: { message: 'Unavailable' } } }),
  );
  await page.goto('/');

  const main = page.getByRole('main');
  const error = main.getByRole('alert');
  await expect(error).toHaveCount(1);
  await expect(
    error.getByRole('heading', { name: 'Could not load workspace' }),
  ).toBeVisible();
  await expect(error).toContainText(
    'Check that the local Calendarpit server is running.',
  );
  await expect(main.getByText('Loading your workspace…')).toHaveCount(0);
  await expect(page.getByText('Disconnected', { exact: true })).toBeVisible();

  await page.unroute('**/__calendarpit/state');
  const retryResponse = Promise.withResolvers<void>();
  await page.route('**/__calendarpit/state', async (route) => {
    await retryResponse.promise;
    await route.continue();
  });
  const retry = error.getByRole('button', { name: 'Try again' });
  try {
    await retry.click();
    await expect(retry).toBeDisabled();
    await expect(error).toBeVisible();
  } finally {
    retryResponse.resolve();
  }

  await expect(error).toHaveCount(0);
  await expect(
    main.getByRole('heading', { name: 'Work calendar' }),
  ).toBeVisible();
  await expect(
    main.getByRole('button', { name: 'New event' }).first(),
  ).toBeVisible();
});

test('keeps the loaded workspace visible when a refresh fails', async ({
  page,
}) => {
  await page.goto('/');
  const main = page.getByRole('main');
  const newEvent = main.getByRole('button', { name: 'New event' }).first();
  await expect(newEvent).toBeVisible();

  await page.route('**/__calendarpit/state', (route) =>
    route.fulfill({ status: 500, json: { error: { message: 'Unavailable' } } }),
  );
  await main.getByRole('button', { name: 'Refresh', exact: true }).click();

  await expect(page.getByText('Disconnected', { exact: true })).toBeVisible();
  await expect(newEvent).toBeVisible();
  await expect(main.getByRole('alert')).toHaveCount(0);
  await expect(main.getByText('Loading your workspace…')).toHaveCount(0);
});

test('keeps the load error while a background refetch is pending', async ({
  page,
}) => {
  await page.clock.install();
  await page.route('**/__calendarpit/state', (route) =>
    route.fulfill({ status: 500, json: { error: { message: 'Unavailable' } } }),
  );
  await page.goto('/');
  const error = page.getByRole('main').getByRole('alert');
  await expect(error).toHaveCount(1);

  await page.unroute('**/__calendarpit/state');
  const polled = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route('**/__calendarpit/state', async (route) => {
    polled.resolve();
    await release.promise;
    await route.fulfill({
      status: 500,
      json: { error: { message: 'Unavailable' } },
    });
  });
  try {
    // The workspace query polls every 30 seconds, even after an error.
    await page.clock.runFor(31_000);
    await polled.promise;
    await expect(error).toBeVisible();
    await expect(
      page.getByRole('main').getByText('Loading your workspace…'),
    ).toHaveCount(0);
  } finally {
    release.resolve();
  }
});

test('returns focus to the retry button when a retry fails', async ({
  page,
}) => {
  await page.route('**/__calendarpit/state', (route) =>
    route.fulfill({ status: 500, json: { error: { message: 'Unavailable' } } }),
  );
  await page.goto('/');
  const retry = page
    .getByRole('main')
    .getByRole('alert')
    .getByRole('button', { name: 'Try again' });
  await expect(retry).toBeEnabled();
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(retry).toBeDisabled();
  await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();
});
