/** Formats a timestamp in English with a 24-hour clock. */
export const formatTimestamp = (value: string | number) =>
  new Date(value).toLocaleString('en', { hour12: false });
