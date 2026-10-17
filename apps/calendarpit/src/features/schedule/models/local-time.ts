/**
 * Returns a timestamp's wall-clock time in `timeZone` as `YYYY-MM-DDTHH:mm`,
 * the format of `datetime-local` inputs. A value without an offset is already
 * local and is only truncated to minutes.
 */
export function localTime(value: string, timeZone: string) {
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
