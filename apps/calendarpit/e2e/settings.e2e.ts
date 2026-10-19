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

test('an OAuth client callback can change without reloading the fixture', async ({
  page,
}) => {
  const moved = 'http://127.0.0.1:3000/auth/google/callback';
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'OAuth clients' }).click();
  await page.getByRole('button', { name: 'Edit sample-app' }).click();
  const editor = page.getByRole('form', { name: 'Edit sample-app' });
  await editor.getByLabel('Redirect URIs').fill(`${moved}\nnot a url`);
  await editor.getByRole('button', { name: 'Save client' }).click();
  await expect(
    editor.getByText(
      'Use absolute http or https URLs without a fragment or credentials.',
    ),
  ).toBeVisible();
  await editor.getByLabel('Redirect URIs').fill(moved);
  await editor.getByRole('button', { name: 'Save client' }).click();
  await expect(toast(page, 'OAuth client saved.')).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Redirect URIs' }).getByText(moved),
  ).toBeVisible();

  const params = new URLSearchParams({
    client_id: 'sample-app',
    redirect_uri: moved,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
  });
  await page.goto(`/oauth/authorize?${params}`);
  await expect(
    page.getByRole('heading', { name: 'Connect your calendar.' }),
  ).toBeVisible();

  await page.goto('/');
  await expect(page.getByText('Weekly planning')).toBeVisible();
});

test('the interface language can switch to Japanese and back', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page
    .getByRole('group', { name: 'Language' })
    .getByRole('button', { name: '日本語' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(
    page
      .getByRole('navigation', { name: 'ワークスペースのセクション' })
      .getByRole('button', { name: '設定' }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'テストデータ' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(
    page.getByRole('heading', { level: 1, name: '設定' }),
  ).toBeVisible();

  await page
    .getByRole('group', { name: '言語' })
    .getByRole('button', { name: 'English' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sectionLink(page, 'Settings')).toBeVisible();
});

test.describe('with a Japanese browser', () => {
  test.use({ locale: 'ja-JP' });

  test('the system language renders Japanese from the server', async ({
    page,
  }) => {
    const response = await page.goto('/history');
    expect(await response?.text()).toContain('<html lang="ja"');
    await expect(
      page.getByRole('heading', { level: 1, name: 'API 履歴' }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('group', { name: 'リクエストのステータス' })
        .getByRole('button', { name: /すべて/ }),
    ).toBeVisible();
  });
});
