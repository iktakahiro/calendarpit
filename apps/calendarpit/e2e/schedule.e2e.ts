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
    await editor.getByLabel('Start', { exact: true }).fill('2026-10-19T13:00');
    await editor.getByLabel('End', { exact: true }).fill('2026-10-19T14:30');
    await editor.getByRole('button', { name: 'Save event' }).click();

    await expect(toast(page)).toHaveText('Event saved.');
    const agenda = page.getByRole('list').filter({ hasText: 'Design review' });
    await expect(agenda.getByText('1h 30m')).toBeVisible();

    await page.getByRole('button', { name: /^Design review/ }).click();
    await expect(page).toHaveURL(/event=/);
    await editor
      .getByLabel('Summary', { exact: true })
      .fill('Design review (moved)');
    await editor.getByRole('button', { name: 'Save event' }).click();
    await expect(page.getByText('Design review (moved)')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept());
    await page
      .getByRole('button', { name: 'Delete Design review (moved)' })
      .click();
    await expect(toast(page)).toHaveText('Event deleted.');
    await expect(page.getByText('Design review (moved)')).toHaveCount(0);
  });

  test('validates the editor before saving', async ({ page }) => {
    await page.goto('/?event=new');
    const editor = page.getByRole('region', { name: 'Event editor' });
    await editor.getByLabel('End', { exact: true }).fill('2026-10-19T09:00');
    await editor.getByRole('button', { name: 'Save event' }).click();
    await expect(editor.getByRole('alert')).toHaveText(
      'End must be after start.',
    );
    await editor.getByLabel('End', { exact: true }).fill('2026-10-19T12:00');
    await expect(editor.getByRole('alert')).toHaveCount(0);
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
