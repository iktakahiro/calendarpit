import { fail, fields, object, string } from './model';

export type Person = { email: string; displayName?: string; self?: boolean };
export type Attendee = Person & {
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  organizer?: boolean;
  optional?: boolean;
  resource?: boolean;
  comment?: string;
  additionalGuests?: number;
};
export type Reminders = {
  useDefault: boolean;
  overrides?: { method: 'email' | 'popup'; minutes: number }[];
};
export type Conference = {
  createRequest?: {
    requestId: string;
    conferenceSolutionKey?: { type: 'hangoutsMeet' };
    status?: { statusCode: 'success' };
  };
  conferenceId?: string;
  conferenceSolution?: {
    key: { type: 'hangoutsMeet' };
    name: string;
  };
  entryPoints?: { entryPointType: 'video'; uri: string; label?: string }[];
};
export function person(value: unknown): Person {
  const data = object(value);
  fields(data, ['email', 'displayName', 'self', 'id']);
  const email = string(data.email, 'email');
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail('Invalid attendee email.');
  if (data.self !== undefined && typeof data.self !== 'boolean')
    fail('Invalid self.');
  return {
    email,
    ...(data.displayName != null
      ? { displayName: string(data.displayName, 'displayName') }
      : {}),
    ...(data.self !== undefined ? { self: data.self } : {}),
  };
}
export function attendees(value: unknown): Attendee[] {
  if (!Array.isArray(value) || value.length > 200)
    fail('attendees must be an array of at most 200 entries.');
  const result = value.map((entry): Attendee => {
    const d = object(entry);
    fields(d, [
      'email',
      'displayName',
      'self',
      'organizer',
      'responseStatus',
      'optional',
      'resource',
      'comment',
      'additionalGuests',
    ]);
    const p = person({
      email: d.email,
      displayName: d.displayName,
      self: d.self,
    });
    const responseStatus = d.responseStatus ?? 'needsAction';
    if (
      !['needsAction', 'declined', 'tentative', 'accepted'].includes(
        String(responseStatus),
      )
    )
      fail('Invalid attendee responseStatus.');
    const result: Attendee = {
      ...p,
      responseStatus: responseStatus as Attendee['responseStatus'],
    };
    for (const key of ['organizer', 'optional', 'resource'] as const) {
      if (d[key] !== undefined) {
        if (typeof d[key] !== 'boolean') fail(`Invalid attendee ${key}.`);
        result[key] = d[key];
      }
    }
    if (d.comment != null) result.comment = string(d.comment, 'comment');
    if (d.additionalGuests !== undefined) {
      if (
        !Number.isInteger(d.additionalGuests) ||
        Number(d.additionalGuests) < 0
      )
        fail('Invalid additionalGuests.');
      result.additionalGuests = Number(d.additionalGuests);
    }
    return result;
  });
  if (new Set(result.map((p) => p.email.toLowerCase())).size !== result.length)
    fail('Duplicate attendee email.');
  return result;
}
export function reminders(value: unknown): Reminders {
  const d = object(value);
  fields(d, ['useDefault', 'overrides']);
  if (typeof d.useDefault !== 'boolean')
    fail('reminders.useDefault must be boolean.');
  if (
    d.overrides !== undefined &&
    (!Array.isArray(d.overrides) || d.overrides.length > 5)
  )
    fail('At most five reminder overrides are supported.');
  if (d.useDefault && Array.isArray(d.overrides) && d.overrides.length)
    fail('Default reminders cannot have overrides.');
  const overrides = (d.overrides as unknown[] | undefined)?.map((v) => {
    const r = object(v);
    fields(r, ['method', 'minutes']);
    if (
      !['email', 'popup'].includes(String(r.method)) ||
      !Number.isInteger(r.minutes) ||
      Number(r.minutes) < 0 ||
      Number(r.minutes) > 40320
    )
      fail('Invalid reminder override.');
    return {
      method: r.method as 'email' | 'popup',
      minutes: Number(r.minutes),
    };
  });
  return { useDefault: d.useDefault, ...(overrides ? { overrides } : {}) };
}
export function conference(value: unknown): Conference {
  const d = object(value);
  fields(d, [
    'createRequest',
    'conferenceId',
    'conferenceSolution',
    'entryPoints',
  ]);
  const result: Conference = {};
  if (d.createRequest != null) {
    const c = object(d.createRequest);
    fields(c, ['requestId', 'conferenceSolutionKey', 'status']);
    if (c.conferenceSolutionKey != null) {
      const key = object(c.conferenceSolutionKey);
      fields(key, ['type']);
      if (key.type !== 'hangoutsMeet')
        fail(
          'Only synthetic hangoutsMeet conferences are supported.',
          400,
          'unsupportedFeature',
        );
    }
    result.createRequest = {
      requestId: string(c.requestId, 'requestId'),
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    };
    if (c.status != null) {
      const status = object(c.status);
      fields(status, ['statusCode']);
      if (status.statusCode !== 'success') fail('Invalid conference status.');
      result.createRequest.status = { statusCode: 'success' };
    }
  }
  if (d.conferenceId != null)
    result.conferenceId = string(d.conferenceId, 'conferenceId');
  if (d.conferenceSolution != null) {
    const s = object(d.conferenceSolution);
    fields(s, ['key', 'name']);
    const key = object(s.key);
    fields(key, ['type']);
    if (key.type !== 'hangoutsMeet')
      fail('Unsupported conference solution.', 400, 'unsupportedFeature');
    result.conferenceSolution = {
      key: { type: 'hangoutsMeet' },
      name: string(s.name, 'conference name'),
    };
  }
  if (d.entryPoints != null) {
    if (!Array.isArray(d.entryPoints)) fail('entryPoints must be an array.');
    result.entryPoints = d.entryPoints.map((v) => {
      const p = object(v);
      fields(p, ['entryPointType', 'uri', 'label']);
      if (p.entryPointType !== 'video')
        fail(
          'Only video entry points are supported.',
          400,
          'unsupportedFeature',
        );
      const uri = string(p.uri, 'uri');
      if (
        !URL.canParse(uri) ||
        !['http:', 'https:'].includes(new URL(uri).protocol)
      )
        fail('Invalid conference URI.');
      return {
        entryPointType: 'video',
        uri,
        ...(p.label ? { label: string(p.label, 'label') } : {}),
      };
    });
  }
  if (!result.createRequest && !result.entryPoints?.length)
    fail('Conference requires a createRequest or entryPoints.');
  return result;
}
