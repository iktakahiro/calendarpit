import { expect, sectionLink, test, toast } from './support/fixtures';

test('creates a user after fixing validation errors, then adds a calendar', async ({
  page,
}) => {
  await page.goto('/users');
  await page.getByRole('button', { name: 'New user' }).click();
  const form = page.getByRole('region', { name: 'New user' });
  await form.getByRole('button', { name: 'Save user' }).click();
  await expect(form.getByRole('alert')).toHaveText([
    'Enter a name.',
    'Enter an email address.',
  ]);

  await form.getByLabel('Name', { exact: true }).fill('Kim Lee');
  await form.getByLabel('Email', { exact: true }).fill('kim@example.test');
  await form.getByRole('button', { name: 'Save user' }).click();
  await expect(toast(page)).toHaveText('User saved.');
  await expect(page.getByLabel('Test user')).toHaveValue(/.+/);
  await expect(page.getByText('kim@example.test').first()).toBeVisible();

  await sectionLink(page, 'Calendars').click();
  await expect(page).toHaveURL(/\/calendars\?user=/);
  const calendar = page.getByRole('region', { name: 'New calendar' });
  await calendar.getByLabel('Calendar name', { exact: true }).fill('Kim work');
  await calendar.getByLabel('Time zone', { exact: true }).fill('Europe/Berlin');
  await calendar.getByRole('button', { name: 'Save calendar' }).click();
  await expect(toast(page)).toHaveText('Calendar saved.');
  // The new user's only calendar becomes primary and appears in the sidebar.
  await expect(
    page
      .getByRole('list', { name: 'Calendars' })
      .getByRole('button', { name: /Kim work/ }),
  ).toContainText('Primary');
});
