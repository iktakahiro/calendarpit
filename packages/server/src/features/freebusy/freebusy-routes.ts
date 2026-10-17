import { Temporal } from '@js-temporal/polyfill';
import { ApiError, fail } from '../../shared/errors';
import { fields, instant, object, string, zone } from '../../shared/validation';
import { checkQuery, parseJsonBody } from '../../http/requests';
import { json } from '../../http/responses';
import type { Route } from '../../http/router';
import { findCalendar } from '../calendars/calendar-operations';
import { authenticate } from '../oauth/oauth-operations';
import { readFreeBusy } from '../oauth/scopes';
import { busy } from './busy';

/** Google limits a free/busy query to 50 calendars. */
const maxItems = 50;

/**
 * Google `freebusy.query` for the caller's own calendars. Unknown or foreign
 * calendars get a per-calendar `notFound` error instead of failing the whole
 * request. Calendar groups are rejected.
 */
export const freeBusyGoogleRoutes: Route[] = [
  {
    pattern: /^\/calendar\/v3\/freeBusy$/,
    handle({ workspace, request, url, body }) {
      if (request.method !== 'POST') return;
      checkQuery(url, []);
      const grant = authenticate(
        workspace,
        request.headers.get('authorization'),
        readFreeBusy,
      );
      const d = parseJsonBody(body);
      fields(d, [
        'timeMin',
        'timeMax',
        'timeZone',
        'items',
        'calendarExpansionMax',
        'groupExpansionMax',
      ]);
      if (d.groupExpansionMax !== undefined)
        fail('Calendar groups are not supported.', 400, 'unsupportedFeature');
      const min = instant(d.timeMin),
        max = instant(d.timeMax);
      if (max <= min) fail('timeMax must be after timeMin.');
      const tz = zone(d.timeZone);
      if (!Array.isArray(d.items) || d.items.length > maxItems)
        fail('items must contain at most 50 calendars.');
      if (
        d.calendarExpansionMax !== undefined &&
        (!Number.isInteger(d.calendarExpansionMax) ||
          Number(d.calendarExpansionMax) < 1 ||
          Number(d.calendarExpansionMax) > maxItems)
      )
        fail('Invalid calendarExpansionMax.');
      if (
        d.calendarExpansionMax !== undefined &&
        d.items.length > Number(d.calendarExpansionMax)
      )
        fail('Too many calendars.');
      const calendars: Record<string, unknown> = Object.create(null);
      for (const item of d.items) {
        const data = object(item);
        fields(data, ['id']);
        const id = string(data.id, 'id');
        try {
          const c = findCalendar(workspace, id, grant.userId);
          calendars[id] = {
            busy: busy(workspace.data.events, c, min, max).map((r) =>
              Object.fromEntries(
                Object.entries(r).map(([k, v]) => [
                  k,
                  Temporal.Instant.from(v)
                    .toZonedDateTimeISO(tz)
                    .toString({ timeZoneName: 'never' }),
                ]),
              ),
            ),
          };
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 404) throw e;
          calendars[id] = {
            errors: [{ domain: 'global', reason: 'notFound' }],
            busy: [],
          };
        }
      }
      return json({
        kind: 'calendar#freeBusy',
        timeMin: d.timeMin,
        timeMax: d.timeMax,
        calendars,
      });
    },
  },
];
