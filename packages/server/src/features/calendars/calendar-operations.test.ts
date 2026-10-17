import { describe, expect, test } from 'bun:test';
import { apiError } from '../../testing/api-error';
import { testWorkspace } from '../../testing/workspace';
import {
  deleteCalendar,
  findCalendar,
  saveCalendar,
} from './calendar-operations';

const primaryOf = (
  workspace: ReturnType<typeof testWorkspace>['workspace'],
  userId: string,
) => workspace.data.calendars.filter((c) => c.userId === userId && c.primary);

describe('findCalendar', () => {
  test('resolves primary only for the given owner', () => {
    const { workspace } = testWorkspace();
    expect(findCalendar(workspace, 'primary', 'alex').id).toBe('alex-work');
    expect(apiError(() => findCalendar(workspace, 'primary')).status).toBe(404);
  });

  test("hides another user's calendar as not found", () => {
    const { workspace } = testWorkspace();
    expect(
      apiError(() => findCalendar(workspace, 'sam-work', 'alex')).status,
    ).toBe(404);
  });
});

describe('saveCalendar', () => {
  test("makes a user's first calendar primary", () => {
    const { workspace } = testWorkspace();
    workspace.data.users.push({
      id: 'new',
      name: 'New',
      email: 'new@example.test',
    });
    const { calendar, created } = saveCalendar(workspace, {
      id: 'first',
      userId: 'new',
      summary: 'First',
    });
    expect(created).toBe(true);
    expect(calendar.primary).toBe(true);
  });

  test('a new primary calendar demotes the old one', () => {
    const { workspace } = testWorkspace();
    saveCalendar(workspace, {
      id: 'next',
      userId: 'alex',
      summary: 'Next',
      primary: true,
    });
    expect(primaryOf(workspace, 'alex').map((c) => c.id)).toEqual(['next']);
  });

  test('refuses to unset primary without a replacement', () => {
    const { workspace } = testWorkspace();
    const existing = findCalendar(workspace, 'alex-work');
    expect(() => saveCalendar(workspace, { primary: false }, existing)).toThrow(
      'Choose another calendar as primary first.',
    );
  });

  test.each([
    [{ id: 'renamed' }, 'Calendar ID and owner are immutable.'],
    [{ userId: 'sam' }, 'Calendar ID and owner are immutable.'],
  ])('rejects changing %p', (input, message) => {
    const { workspace } = testWorkspace();
    const existing = findCalendar(workspace, 'alex-personal');
    expect(() => saveCalendar(workspace, input, existing)).toThrow(message);
  });

  test('rejects duplicate IDs and unknown owners', () => {
    const { workspace } = testWorkspace();
    expect(
      apiError(() =>
        saveCalendar(workspace, {
          id: 'alex-work',
          userId: 'alex',
          summary: 'x',
        }),
      ).status,
    ).toBe(409);
    expect(() =>
      saveCalendar(workspace, { id: 'x', userId: 'nobody', summary: 'x' }),
    ).toThrow('Unknown owner.');
  });

  test('changes the revision so stale page tokens fail', () => {
    const { workspace } = testWorkspace();
    const before = workspace.revision;
    saveCalendar(
      workspace,
      { summary: 'Renamed' },
      findCalendar(workspace, 'alex-personal'),
    );
    expect(workspace.revision).not.toBe(before);
  });
});

test('deleting the primary calendar promotes the next and keeps a tombstone', () => {
  const { workspace } = testWorkspace();
  deleteCalendar(workspace, findCalendar(workspace, 'alex-work'));
  expect(primaryOf(workspace, 'alex').map((c) => c.id)).toEqual([
    'alex-personal',
  ]);
  expect(workspace.data.events.some((e) => e.calendarId === 'alex-work')).toBe(
    false,
  );
  expect(workspace.deletedCalendars.map((c) => c.id)).toEqual(['alex-work']);
});
