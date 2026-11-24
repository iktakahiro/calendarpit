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

test('edits a user and a calendar in place', async ({ page }) => {
  await page.goto('/users?user=sam');
  const user = page.getByRole('region', { name: 'Edit user' });
  await expect(user.getByText('sam', { exact: true })).toBeVisible();
  await user.getByLabel('Name', { exact: true }).fill('Sam Rivera-Lee');
  await user.getByRole('button', { name: 'Save user' }).click();
  await expect(toast(page, 'User saved.')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'User directory' })
      .getByRole('button', { name: /Sam Rivera-Lee/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Test user' })).toContainText(
    'Sam Rivera-Lee',
  );

  await sectionLink(page, 'Calendars').click();
  await expect(page).toHaveURL(/\/calendars\?user=sam/);
  const calendar = page.getByRole('region', { name: 'Edit calendar' });
  await expect(calendar.getByText('sam-work', { exact: true })).toBeVisible();
  await calendar.getByLabel('Calendar name', { exact: true }).fill('Sam main');
  await calendar.getByLabel('Time zone', { exact: true }).fill('Europe/London');
  await calendar.getByRole('button', { name: 'Save calendar' }).click();
  await expect(toast(page, 'Calendar saved.')).toBeVisible();
  const row = page
    .getByRole('region', { name: 'Calendar directory' })
    .getByRole('button', { name: /Sam main/ });
  await expect(row).toContainText('Europe/London');
  await expect(row).toContainText('Primary');
});

test('deletes a calendar only after confirmation', async ({ page }) => {
  await page.goto('/calendars?user=alex&calendar=alex-personal');
  const editor = page.getByRole('region', { name: 'Edit calendar' });
  const list = page.getByRole('region', { name: 'Calendar directory' });
  const dialog = page.getByRole('alertdialog', {
    name: 'Delete this calendar?',
  });
  await expect(
    editor.getByText('alex-personal', { exact: true }),
  ).toBeVisible();

  await editor.getByRole('button', { name: 'Delete' }).click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(list.getByRole('button', { name: /Personal/ })).toBeVisible();

  await editor.getByRole('button', { name: 'Delete' }).click();
  await dialog.getByRole('button', { name: 'Delete calendar' }).click();
  await expect(toast(page, 'Calendar deleted.')).toBeVisible();
  await expect(list.getByRole('button', { name: /Personal/ })).toHaveCount(0);
  await expect(list).toContainText('1 calendar for this user');
  // The selection falls back to the user's primary calendar.
  await expect(editor.getByText('alex-work', { exact: true })).toBeVisible();
});

test('deletes a user with their calendars', async ({ page }) => {
  await page.goto('/users?user=alex');
  const editor = page.getByRole('region', { name: 'Edit user' });
  const list = page.getByRole('region', { name: 'User directory' });
  await editor.getByRole('button', { name: 'Delete' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete this user?' })
    .getByRole('button', { name: 'Delete user' })
    .click();
  await expect(toast(page, 'User and owned data deleted.')).toBeVisible();
  await expect(list.getByRole('button', { name: /Alex Morgan/ })).toHaveCount(
    0,
  );
  await expect(list).toContainText('1 user in this workspace');
  // The selection falls back to the remaining user.
  await expect(page.getByRole('combobox', { name: 'Test user' })).toContainText(
    'Sam Rivera',
  );

  await sectionLink(page, 'Calendars').click();
  const calendars = page.getByRole('region', { name: 'Calendar directory' });
  await expect(calendars).toContainText("Sam Rivera's calendars");
  await expect(calendars.getByRole('button')).toHaveCount(1);
  await expect(calendars).toContainText('America/New_York');
});
