import { describe, expect, test } from 'bun:test';
import {
  ariaKeyShortcuts,
  matchesShortcut,
  shortcutKeys,
  type KeyPress,
} from './shortcut';

const press = (key: string, modifiers: Partial<KeyPress> = {}): KeyPress => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  ...modifiers,
});

describe('matchesShortcut', () => {
  test('matches Mod with either Command or Control', () => {
    expect(matchesShortcut(press('k', { metaKey: true }), 'Mod+K')).toBe(true);
    expect(matchesShortcut(press('k', { ctrlKey: true }), 'Mod+K')).toBe(true);
    expect(matchesShortcut(press(',', { metaKey: true }), 'Mod+,')).toBe(true);
  });

  test('rejects Mod shortcuts without exactly one modifier or with Shift', () => {
    expect(matchesShortcut(press('k'), 'Mod+K')).toBe(false);
    expect(
      matchesShortcut(press('k', { metaKey: true, ctrlKey: true }), 'Mod+K'),
    ).toBe(false);
    expect(
      matchesShortcut(press('K', { metaKey: true, shiftKey: true }), 'Mod+K'),
    ).toBe(false);
  });

  test('matches a single key only without Command or Control', () => {
    expect(matchesShortcut(press('c'), 'c')).toBe(true);
    expect(matchesShortcut(press('c', { metaKey: true }), 'c')).toBe(false);
    expect(matchesShortcut(press('c', { ctrlKey: true }), 'c')).toBe(false);
  });

  test('matches the produced character, so Shift counts only when needed', () => {
    expect(matchesShortcut(press('C', { shiftKey: true }), 'c')).toBe(false);
    expect(matchesShortcut(press('?', { shiftKey: true }), '?')).toBe(true);
  });

  test('ignores composition, repeats, Alt, and handled presses', () => {
    expect(matchesShortcut(press('c', { isComposing: true }), 'c')).toBe(false);
    expect(matchesShortcut(press('c', { repeat: true }), 'c')).toBe(false);
    expect(matchesShortcut(press('c', { altKey: true }), 'c')).toBe(false);
    expect(matchesShortcut(press('c', { defaultPrevented: true }), 'c')).toBe(
      false,
    );
  });
});

describe('shortcutKeys', () => {
  test('shows Command on macOS and Ctrl elsewhere', () => {
    expect(shortcutKeys('Mod+K', true)).toEqual(['⌘', 'K']);
    expect(shortcutKeys('Mod+K', false)).toEqual(['Ctrl', 'K']);
  });

  test('shows a single key in upper case', () => {
    expect(shortcutKeys('c', true)).toEqual(['C']);
    expect(shortcutKeys('?', false)).toEqual(['?']);
  });
});

test('ariaKeyShortcuts lists both modifiers for Mod shortcuts', () => {
  expect(ariaKeyShortcuts('Mod+K')).toBe('Meta+K Control+K');
  expect(ariaKeyShortcuts('c')).toBe('c');
});
