import { expect, sectionLink, test, toast } from './support/fixtures';

test('creates a user after fixing validation errors, then adds a calendar', async ({
  page,
}) => {
  await page.goto('/users');
  await page.getByRole('button', { name: 'New user' }).click();
  const form = page.getByRole('region', { name: 'New user' });
  const email = form.getByLabel('Email', { exact: true });
  await expect(email).not.toHaveAttribute('aria-invalid');
  await expect(email).not.toHaveAttribute('aria-describedby');
  await form.getByRole('button', { name: 'Save user' }).click();
  await expect(form.getByRole('alert')).toHaveText([
    'Enter a name.',
    'Enter an email address.',
  ]);

  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAttribute(
    'aria-describedby',
    (await form.getByRole('alert').nth(1).getAttribute('id'))!,
  );
  await expect(email).toHaveAccessibleDescription('Enter an email address.');
  await form.getByLabel('Name', { exact: true }).fill('Kim Lee');
  await email.fill('kim@example.test');
  await expect(email).not.toHaveAttribute('aria-invalid');
  await expect(email).not.toHaveAttribute('aria-describedby');
  await form.getByRole('button', { name: 'Save user' }).click();
  await expect(toast(page, 'User saved.')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Test user' })).toContainText(
    'Kim Lee',
  );
  await expect(page.getByText('kim@example.test').first()).toBeVisible();

  await sectionLink(page, 'Calendars').click();
  await expect(page).toHaveURL(/\/calendars\?user=/);
  const calendar = page.getByRole('region', { name: 'New calendar' });
  await calendar.getByLabel('Calendar name', { exact: true }).fill('Kim work');
  const timeZone = calendar.getByLabel('Time zone', { exact: true });
  await timeZone.fill('invalid');
  await calendar.getByRole('button', { name: 'Save calendar' }).click();
  await expect(timeZone).toHaveAttribute('aria-invalid', 'true');
  await expect(calendar.getByRole('alert')).toHaveText(
    'Enter an IANA time zone, such as Asia/Tokyo.',
  );
  await expect(timeZone).toHaveAttribute(
    'aria-describedby',
    (await calendar.getByRole('alert').getAttribute('id'))!,
  );
  await expect(timeZone).toHaveAccessibleDescription(
    'Enter an IANA time zone, such as Asia/Tokyo.',
  );
  await timeZone.fill('Europe/Berlin');
  await expect(timeZone).not.toHaveAttribute('aria-invalid');
  await expect(timeZone).not.toHaveAttribute('aria-describedby');
  await calendar.getByRole('button', { name: 'Save calendar' }).click();
  await expect(toast(page, 'Calendar saved.')).toBeVisible();
  // The new user's only calendar becomes primary and appears in the sidebar.
  await expect(
    page
      .getByRole('list', { name: 'Calendars' })
      .getByRole('button', { name: /Kim work/ }),
  ).toContainText('Primary');
});
