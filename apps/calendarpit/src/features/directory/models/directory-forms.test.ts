import { expect, test } from 'bun:test';
import { messages } from '../../../lib/messages';
import { validateCalendarForm, validateUserForm } from './directory-forms';

test.each([
  [{ name: 'Kim', email: 'kim@example.test' }, undefined],
  [{ name: ' ', email: 'kim@example.test' }, { name: 'Enter a name.' }],
  [{ name: 'Kim', email: 'kim' }, { email: 'Enter an email address.' }],
])('validateUserForm(%p)', (values, expected) => {
  expect(validateUserForm(values, messages.en)).toEqual(expected);
});

test.each([
  [{ summary: 'Work', timeZone: 'Asia/Tokyo', primary: false }, undefined],
  [
    { summary: '', timeZone: 'Asia/Tokyo', primary: false },
    { summary: 'Enter a calendar name.' },
  ],
  [
    { summary: 'Work', timeZone: 'Mars/Base', primary: true },
    { timeZone: 'Enter an IANA time zone, such as Asia/Tokyo.' },
  ],
])('validateCalendarForm(%p)', (values, expected) => {
  expect(validateCalendarForm(values, messages.en)).toEqual(expected);
});

test('validation errors follow the given language', () => {
  expect(
    validateCalendarForm(
      { summary: '', timeZone: 'Asia/Tokyo', primary: false },
      messages.ja,
    ),
  ).toEqual({ summary: 'カレンダー名を入力してください。' });
});
