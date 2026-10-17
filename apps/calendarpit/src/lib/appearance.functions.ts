import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { parseAppearance } from './appearance';

export const getAppearance = createServerFn({ method: 'GET' }).handler(() =>
  parseAppearance(getRequestHeader('cookie')),
);
