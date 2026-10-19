import {
  createContext,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';
import type { Command } from '../models/command';

/**
 * Commands registered by the mounted screens. It lives outside React state, so
 * a screen that re-registers on every render re-renders only the palette, not
 * itself.
 */
export type CommandStore = {
  /** Every registered command, in registration order. */
  commands: () => Command[];
  set: (owner: string, commands: Command[]) => void;
  remove: (owner: string) => void;
  subscribe: (listener: () => void) => () => void;
};

/** Creates an empty command store. */
export function createCommandStore(): CommandStore {
  const owners = new Map<string, Command[]>();
  const listeners = new Set<() => void>();
  let snapshot: Command[] = [];
  const changed = () => {
    snapshot = [...owners.values()].flat();
    for (const listener of listeners) listener();
  };
  return {
    commands: () => snapshot,
    set: (owner, commands) => {
      owners.set(owner, commands);
      changed();
    },
    remove: (owner) => {
      if (owners.delete(owner)) changed();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The command store and the palette controls that the provider shares. */
export type CommandContextValue = {
  store: CommandStore;
  /** Opens the palette, on the page of the command `pageOf` when given. */
  openPalette: (pageOf?: string) => void;
};

/** Context set by `CommandProvider`. */
export const CommandContext = createContext<CommandContextValue | null>(null);

function useCommandContext() {
  const context = use(CommandContext);
  if (!context) throw new Error('Commands require CommandProvider.');
  return context;
}

/**
 * Registers `commands` while the calling component is mounted. Pass the
 * commands built during render; the latest ones replace the previous ones in
 * the same commit as the screen they belong to, so a shortcut pressed right
 * after the screen changes never runs a stale handler.
 */
export function useRegisterCommands(commands: Command[]) {
  const { store } = useCommandContext();
  const owner = useId();
  useLayoutEffect(() => store.set(owner, commands));
  useEffect(() => () => store.remove(owner), [store, owner]);
}

/** Returns every registered command and re-renders when they change. */
export function useCommands() {
  const { store } = useCommandContext();
  return useSyncExternalStore(store.subscribe, store.commands, store.commands);
}

/** Returns the function that opens the command palette. */
export const useOpenPalette = () => useCommandContext().openPalette;

const subscribeNever = () => () => {};

/**
 * Whether the browser runs on an Apple platform, to show ⌘ instead of Ctrl.
 * The server render assumes it does not.
 */
export const useIsMac = () =>
  useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
