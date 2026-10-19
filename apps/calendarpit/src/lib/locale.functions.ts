import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { localeFromAcceptLanguage, parseLanguage } from './locale';

/**
 * Reads the stored language preference and the locale the browser asks for,
 * so the server renders the chosen language without a flash.
 */
export const getLanguage = createServerFn({ method: 'GET' }).handler(() => ({
  preference: parseLanguage(getRequestHeader('cookie')),
  systemLocale: localeFromAcceptLanguage(getRequestHeader('accept-language')),
}));
