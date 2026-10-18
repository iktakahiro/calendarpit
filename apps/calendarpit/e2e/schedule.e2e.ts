import { expect, test, toast } from './support/fixtures';

test.describe('schedule', () => {
  test('creates, edits, and deletes an event', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Work calendar' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'New event' }).first().click();
    const editor = page.getByRole('region', { name: 'Event editor' });
    await editor.getByLabel('Summary', { exact: true }).fill('Design review');
    // The editor opens on the shown date, so only the times need changing.
    await editor.getByLabel('Start time', { exact: true }).fill('13:00');
    await editor.getByLabel('End time', { exact: true }).fill('14:30');
    await editor.getByRole('button', { name: 'Save event' }).click();

    await expect(toast(page, 'Event saved.')).toBeVisible();
    await expect(editor).toHaveCount(0);
    const agenda = page.getByRole('list').filter({ hasText: 'Design review' });
    await expect(agenda.getByText('1h 30m')).toBeVisible();

    await page.getByRole('button', { name: /^Design review/ }).click();
    await expect(page).toHaveURL(/event=/);
    await editor
      .getByLabel('Summary', { exact: true })
      .fill('Design review (moved)');
    await editor.getByRole('button', { name: 'Save event' }).click();
    // Saving closes the editor, whose heading also shows the summary.
    await expect(editor).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^Design review \(moved\)/ }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: 'Delete Design review (moved)' })
      .click();
    await page
      .getByRole('alertdialog', { name: 'Delete this event?' })
      .getByRole('button', { name: 'Delete event' })
      .click();
    await expect(toast(page, 'Event deleted.')).toBeVisible();
    await expect(page.getByText('Design review (moved)')).toHaveCount(0);
  });

  test('validates the editor before saving', async ({ page }) => {
    await page.goto('/?event=new');
    const editor = page.getByRole('region', { name: 'Event editor' });
    await editor.getByLabel('End time', { exact: true }).fill('09:00');
    await editor.getByRole('button', { name: 'Save event' }).click();
    await expect(editor.getByRole('alert')).toHaveText(
      'End must be after start.',
    );
    await editor.getByLabel('End time', { exact: true }).fill('12:00');
    await expect(editor.getByRole('alert')).toHaveCount(0);
  });

  test('moves an event to another day from the editor calendar', async ({
    page,
  }) => {
    await page.goto('/?date=2026-10-19&event=planning');
    const editor = page.getByRole('region', { name: 'Event editor' });
    await editor
      .getByRole('button', { name: 'Start date: 2026-10-19' })
      .click();
    await page.getByRole('button', { name: 'Thursday, October 22' }).click();
    await expect(
      editor.getByRole('button', { name: 'Start date: 2026-10-22' }),
    ).toBeVisible();
    // The time the event already had survives the new date.
    await expect(editor.getByLabel('Start time', { exact: true })).toHaveValue(
      '10:00',
    );
  });

  test('restores the date, calendar, and open event from the URL', async ({
    page,
  }) => {
    await page.goto('/?date=2026-10-19&event=planning');
    const editor = page.getByRole('region', { name: 'Event editor' });
    await expect(editor.getByLabel('Summary', { exact: true })).toHaveValue(
      'Weekly planning',
    );

    await page.getByRole('button', { name: 'Next day' }).click();
    await expect(page).toHaveURL(/date=2026-10-20/);
    await expect(editor).toHaveCount(0);
    await expect(page.getByText('Nothing scheduled')).toBeVisible();

    await page.getByRole('button', { name: /Personal/ }).click();
    await expect(page).toHaveURL(/calendar=alex-personal/);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Personal' })).toBeVisible();
  });
});
