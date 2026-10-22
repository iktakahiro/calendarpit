import { expect, sectionLink, test, toast } from './support/fixtures';

test('Settings tabs preserve workspace selection, reload, and browser history', async ({
  page,
}) => {
  await page.goto('/settings?user=sam&calendar=sam-work');
  await expect(page.getByRole('tab', { name: 'Appearance' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  for (const [name, tab] of [
    ['Developer', 'developer'],
    ['Test data', 'data'],
    ['OAuth clients', 'clients'],
  ]) {
    await page.getByRole('tab', { name }).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('tab'))
      .toBe(tab);
    expect(new URL(page.url()).searchParams.get('user')).toBe('sam');
    expect(new URL(page.url()).searchParams.get('calendar')).toBe('sam-work');
  }
  await page.reload();
  await expect(
    page.getByRole('tab', { name: 'OAuth clients' }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Test data' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.goForward();
  await expect(
    page.getByRole('tab', { name: 'OAuth clients' }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Appearance' }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.has('tab'))
    .toBe(false);
  expect(new URL(page.url()).searchParams.get('user')).toBe('sam');
  expect(new URL(page.url()).searchParams.get('calendar')).toBe('sam-work');
});

test('Settings links open the requested tab and unknown tabs fall back', async ({
  page,
}) => {
  for (const [tab, name] of [
    ['developer', 'Developer'],
    ['data', 'Test data'],
    ['clients', 'OAuth clients'],
    ['unknown', 'Appearance'],
  ]) {
    await page.goto(`/settings?tab=${tab}`);
    await expect(page.getByRole('tab', { name })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }
});

test('fixture errors appear by the field before confirmation and after server rejection', async ({
  page,
}) => {
  let requests = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/__calendarpit/fixtures'
    )
      requests++;
  });
  await page.goto('/settings?tab=data');
  const fixture = page.getByRole('textbox', { name: 'Fixture JSON' });
  const error = page.locator('#fixture-error');
  await fixture.fill('{"users": [}');
  await page.getByRole('button', { name: 'Load fixture', exact: true }).click();
  await expect(error.getByRole('alert')).toHaveText('Enter valid JSON.');
  await expect(fixture).toHaveAttribute('aria-invalid', 'true');
  await expect(fixture).toHaveAttribute('aria-describedby', 'fixture-error');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(requests).toBe(0);
  await fixture.fill('{"users": "invalid"}');
  await expect(error).toBeEmpty();
  await expect(fixture).toHaveAttribute('aria-invalid', 'false');
  await expect(fixture).not.toHaveAttribute('aria-describedby');
  await page.getByRole('button', { name: 'Load fixture', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Load fixture' })
    .click();
  await expect(error.getByRole('alert')).toHaveText('users must be an array.');
  expect(requests).toBe(1);
  await expect(fixture).toHaveAttribute('aria-invalid', 'true');
  await fixture.fill(
    '{"users": [], "calendars": [], "events": [], "clients": []}',
  );
  await expect(error).toBeEmpty();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Load fixture', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Load fixture' })
    .click();
  await expect(toast(page, 'Fixture loaded.')).toBeVisible();
  await expect(error).toBeEmpty();
});

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
  await expect(page).toHaveTitle('Calendarpit · ローカルカレンダーラボ');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    '開発とテストで使う、Google Calendar API 互換のローカルサーバー。',
  );
  await expect(
    page
      .getByRole('navigation', { name: 'ワークスペースのセクション' })
      .getByRole('button', { name: '設定' }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'テストデータ' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '開発者' })).toBeVisible();

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
  await expect(page).toHaveTitle('Calendarpit · Local calendar lab');
  await expect(sectionLink(page, 'Settings')).toBeVisible();
});

test('the Calendar API rate limit mode is saved from Settings', async ({
  page,
}) => {
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'Developer' }).click();
  await expect(page.getByText('No simulated rate limiting.')).toBeVisible();
  await expect(
    page.getByText(
      "Limits roughly match Google's published quotas (approximate, not identical): 600 requests per minute per user, 10,000 per minute per project, and an estimated 60 writes per minute per calendar (not published by Google).",
    ),
  ).toBeVisible();
  const mode = page.getByRole('combobox', { name: 'Mode' });
  await mode.click();
  await expect(page.getByRole('option')).toHaveText([
    'Off',
    'Production',
    'Error testing',
  ]);
  await page.getByRole('option', { name: 'Error testing' }).click();
  await expect(toast(page, 'Rate limit mode saved.')).toBeVisible();
  await expect(mode).toContainText('Error testing');

  await page.reload();
  await page.getByRole('tab', { name: 'Developer' }).click();
  await expect(page.getByRole('combobox', { name: 'Mode' })).toContainText(
    'Error testing',
  );
  await expect(
    page.getByText(
      'Very low limits that trigger 403 and 429 errors quickly to test retry and backoff handling: 4 requests per minute per user, 12 per minute per project, 2 writes per minute per calendar, and 20 requests per day per user.',
    ),
  ).toBeVisible();
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

  test('the rate limit modes use Japanese labels', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: '開発者' }).click();
    for (const label of ['オフ：', '本番相当：', 'エラー確認用：'])
      await expect(page.getByText(label, { exact: true })).toBeVisible();
  });

  test('fixture syntax errors use Japanese beside the field', async ({
    page,
  }) => {
    await page.goto('/settings?tab=data');
    await page.getByRole('textbox', { name: 'Fixture JSON' }).fill('{');
    await page
      .getByRole('button', { name: 'Fixture を読み込む', exact: true })
      .click();
    await expect(page.locator('#fixture-error').getByRole('alert')).toHaveText(
      '有効な JSON を入力してください。',
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
});
