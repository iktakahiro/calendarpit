import { fail } from '../../shared/errors';
import { fields, id, object, string, zone } from '../../shared/validation';
import type { Calendar } from '../../model/directory';

/**
 * Parses a calendar for fixtures and the management API. A missing ID becomes
 * a UUID and a missing time zone becomes `UTC`.
 *
 * @throws {@link ApiError} 400 for unknown fields or invalid values.
 */
export function makeCalendar(value: unknown): Calendar {
  const d = object(value);
  fields(d, ['id', 'userId', 'summary', 'timeZone', 'primary']);
  if (d.primary !== undefined && typeof d.primary !== 'boolean')
    fail('primary must be boolean.');
  return {
    id: id(d.id),
    userId: string(d.userId, 'userId'),
    summary: string(d.summary, 'summary'),
    timeZone: zone(d.timeZone),
    primary: d.primary === true,
  };
}
