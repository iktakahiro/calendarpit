/**
 * Google's classic calendar palette, the `calendar` map from `colors.get`.
 * Calendarpit does not serve that endpoint; calendar-list `colorId` values
 * `1`–`24` still resolve to these colors. Event colors are a different palette.
 */
export const calendarColors: Record<
  string,
  { background: string; foreground: string }
> = {
  '1': { background: '#ac725e', foreground: '#1d1d1d' },
  '2': { background: '#d06b64', foreground: '#1d1d1d' },
  '3': { background: '#f83a22', foreground: '#1d1d1d' },
  '4': { background: '#fa573c', foreground: '#1d1d1d' },
  '5': { background: '#ff7537', foreground: '#1d1d1d' },
  '6': { background: '#ffad46', foreground: '#1d1d1d' },
  '7': { background: '#42d692', foreground: '#1d1d1d' },
  '8': { background: '#16a765', foreground: '#1d1d1d' },
  '9': { background: '#7bd148', foreground: '#1d1d1d' },
  '10': { background: '#b3dc6c', foreground: '#1d1d1d' },
  '11': { background: '#fbe983', foreground: '#1d1d1d' },
  '12': { background: '#fad165', foreground: '#1d1d1d' },
  '13': { background: '#92e1c0', foreground: '#1d1d1d' },
  '14': { background: '#9fe1e7', foreground: '#1d1d1d' },
  '15': { background: '#9fc6e7', foreground: '#1d1d1d' },
  '16': { background: '#4986e7', foreground: '#1d1d1d' },
  '17': { background: '#9a9cff', foreground: '#1d1d1d' },
  '18': { background: '#b99aff', foreground: '#1d1d1d' },
  '19': { background: '#c2c2c2', foreground: '#1d1d1d' },
  '20': { background: '#cabdbf', foreground: '#1d1d1d' },
  '21': { background: '#cca6ac', foreground: '#1d1d1d' },
  '22': { background: '#f691b2', foreground: '#1d1d1d' },
  '23': { background: '#cd74e6', foreground: '#1d1d1d' },
  '24': { background: '#a47ae2', foreground: '#1d1d1d' },
};

/** Palette id used when an owned calendar has no stored list color. */
export const defaultCalendarColorId = '1';

/**
 * Palette entry for an id `1`–`24`.
 *
 * The lookup uses an own property, so inherited names such as `constructor`,
 * `toString`, and `__proto__` are not colors.
 */
export function calendarColor(id: string) {
  if (!Object.hasOwn(calendarColors, id)) return undefined;
  return calendarColors[id];
}

function channel(hex: string, offset: number) {
  return Number.parseInt(hex.slice(offset, offset + 2), 16);
}

/**
 * Palette id whose background is nearest to `background` in RGB distance.
 * Equal distances keep the lower id. `background` must be `#rrggbb`.
 */
export function nearestCalendarColorId(background: string): string {
  let best = defaultCalendarColorId;
  let bestDistance = Number.POSITIVE_INFINITY;
  const red = channel(background, 1);
  const green = channel(background, 3);
  const blue = channel(background, 5);
  for (const [id, color] of Object.entries(calendarColors)) {
    const distance =
      (red - channel(color.background, 1)) ** 2 +
      (green - channel(color.background, 3)) ** 2 +
      (blue - channel(color.background, 5)) ** 2;
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}
