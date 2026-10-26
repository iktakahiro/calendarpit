import { expect, test, toast } from './support/fixtures';

test.describe('schedule', () => {
  test('moves the week view by a week from the toolbar', async ({ page }) => {
    await page.goto('/?date=2026-10-22&view=week');
    const week = page.getByRole('region', { name: 'Weekly events' });
    await expect(
      week.getByRole('heading', { name: 'Oct 18 – Oct 24, 2026' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Next week', exact: true }).click();

    await expect(page).toHaveURL(/date=2026-10-29/);
    await expect(page).toHaveURL(/view=week/);
    await expect(
      page.getByRole('button', { name: 'Schedule date: 2026-10-29' }),
    ).toBeVisible();
    await expect(
      week.getByRole('heading', { name: 'Oct 25 – Oct 31, 2026' }),
    ).toBeVisible();
    await expect(
      week.getByRole('button', { name: 'Sun 25', exact: true }),
    ).toBeVisible();
    await expect(
      week.getByRole('button', { name: 'Sat 31', exact: true }),
    ).toBeVisible();
  });

  test('shows changes from another application without polling', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await expect(page.getByText('Weekly planning')).toBeVisible();
    await expect(page.getByText('Live', { exact: true })).toBeVisible();

    const deleted = await request.delete(
      '/__calendarpit/calendars/alex-work/events/planning',
      { data: {} },
    );
    expect(deleted.status()).toBe(204);
    // Far shorter than the fallback poll, so only the change stream passes.
    await expect(page.getByText('Weekly planning')).toHaveCount(0, {
      timeout: 2000,
    });
  });

  test('creates, edits, and deletes an event', async ({ page }) => {
    await page.goto('/?date=2026-10-19');
    await expect(
      page.getByRole('heading', { name: 'Work calendar' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'New event' }).first().click();
    const editor = page.getByRole('region', { name: 'Event editor' });
    await editor.getByLabel('Summary', { exact: true }).fill('Design review');
    await editor
      .getByRole('checkbox', { name: 'All-day event', exact: true })
      .check();
    await editor
      .getByRole('checkbox', { name: 'All-day event', exact: true })
      .uncheck();
    await expect(
      editor.getByRole('button', { name: 'End date: 2026-10-19' }),
    ).toBeVisible();
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

  test('asks before a save removes recurrence and attendees', async ({
    page,
    request,
  }) => {
    const created = await request.post(
      '/__calendarpit/calendars/alex-work/events',
      {
        data: {
          id: 'standup',
          summary: 'Standup',
          start: {
            dateTime: '2026-10-20T09:00:00+09:00',
            timeZone: 'Asia/Tokyo',
          },
          end: {
            dateTime: '2026-10-20T09:15:00+09:00',
            timeZone: 'Asia/Tokyo',
          },
          recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
          attendees: [{ email: 'sam@example.test' }],
        },
      },
    );
    expect(created.ok()).toBe(true);
    const stored = () =>
      request
        .get('/__calendarpit/calendars/alex-work/events/standup')
        .then((response) => response.json());

    await page.goto('/?date=2026-10-20&event=standup');
    const editor = page.getByRole('region', { name: 'Event editor' });
    await expect(
      editor.getByText(
        'Saving here removes API-only data (recurrence, attendees). Update this event through the API instead.',
      ),
    ).toBeVisible();

    await editor.getByLabel('Summary', { exact: true }).fill('Standup (new)');
    await editor.getByRole('button', { name: 'Save event' }).click();
    const dialog = page.getByRole('alertdialog', {
      name: 'Remove API-only data and save?',
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await stored()).toMatchObject({
      summary: 'Standup',
      recurrence: ['RRULE:FREQ=DAILY;COUNT=3'],
    });

    // Enter in a field asks the same question as a click on Save.
    await editor.getByLabel('Summary', { exact: true }).press('Enter');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await stored()).toMatchObject({ summary: 'Standup' });

    await editor.getByRole('button', { name: 'Save event' }).click();
    await dialog.getByRole('button', { name: 'Remove data and save' }).click();
    await expect(toast(page, 'Event saved.')).toBeVisible();
    const saved = await stored();
    expect(saved.summary).toBe('Standup (new)');
    expect(saved.recurrence).toBeUndefined();
    expect(saved.attendees).toBeUndefined();
  });

  test('shows field errors instead of the removal dialog when invalid', async ({
    page,
    request,
  }) => {
    await request.post('/__calendarpit/calendars/alex-work/events', {
      data: {
        id: 'colored',
        summary: 'Colored',
        start: {
          dateTime: '2026-10-20T09:00:00+09:00',
          timeZone: 'Asia/Tokyo',
        },
        end: { dateTime: '2026-10-20T10:00:00+09:00', timeZone: 'Asia/Tokyo' },
        colorId: '5',
      },
    });
    await page.goto('/?date=2026-10-20&event=colored');
    const editor = page.getByRole('region', { name: 'Event editor' });
    await editor.getByLabel('End time', { exact: true }).fill('08:00');
    await editor.getByRole('button', { name: 'Save event' }).click();
    await expect(editor.getByRole('alert')).toHaveText(
      'End must be after start.',
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    await editor.getByLabel('Summary', { exact: true }).press('Enter');
    await expect(editor.getByRole('alert')).toHaveText(
      'End must be after start.',
    );
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
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
