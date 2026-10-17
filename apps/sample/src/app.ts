import { calendar } from '@googleapis/calendar';
import { OAuth2Client } from 'google-auth-library';

export type SampleConfig = {
  provider: string;
  origin: string;
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  calendarRootUrl?: string;
};
export function createSample(config: SampleConfig) {
  const requests: string[] = [];
  const guardedFetch = Object.assign(
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
        throw new Error(
          `The local sample blocked a non-loopback request to ${url.origin}.`,
        );
      requests.push(url.origin + url.pathname);
      return fetch(input, { ...init, redirect: 'error' });
    },
    { preconnect: fetch.preconnect },
  );
  const auth = new OAuth2Client({
    clientId: config.clientId ?? 'sample-app',
    clientSecret: config.clientSecret ?? 'local-sample-secret',
    redirectUri: `${config.origin}/callback`,
    eagerRefreshThresholdMillis: 0,
    transporterOptions: { fetchImplementation: guardedFetch, retry: false },
    endpoints: {
      oauth2AuthBaseUrl:
        config.authorizationUrl ?? `${config.provider}/oauth/authorize`,
      oauth2TokenUrl: config.tokenUrl ?? `${config.provider}/oauth/token`,
      oauth2RevokeUrl: `${config.provider}/oauth/revoke`,
      tokenInfoUrl: `${config.provider}/oauth/tokeninfo`,
      oauth2FederatedSignonPemCertsUrl: `${config.provider}/unsupported/certs`,
      oauth2FederatedSignonJwkCertsUrl: `${config.provider}/unsupported/jwks`,
      oauth2IapPublicKeyUrl: `${config.provider}/unsupported/iap`,
    },
  });
  const sdk = calendar({
    version: 'v3',
    auth,
    rootUrl: config.calendarRootUrl ?? config.provider,
    fetchImplementation: guardedFetch,
    retry: false,
  });
  const pending = new Map<string, number>();
  const notifications: Record<string, string>[] = [];
  let identity: unknown = null;
  let selected = 'primary';
  let lastEventId: string | undefined;
  let channel: { id?: string | null; resourceId?: string | null } | undefined;
  let lastResult: unknown = null;
  let status = 'Not connected.';
  const json = (data: unknown, status = 200) =>
    Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  const redirect = (url: string, cookie?: string) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: url,
        ...(cookie ? { 'Set-Cookie': cookie } : {}),
        'Cache-Control': 'no-store',
      },
    });
  return {
    auth,
    sdk,
    requests,
    notifications,
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      try {
        if (url.pathname === '/connect') {
          const state = crypto.randomUUID();
          for (const [key, expires] of pending)
            if (expires < Date.now()) pending.delete(key);
          pending.set(state, Date.now() + 300000);
          return redirect(
            auth.generateAuthUrl({
              access_type: 'offline',
              scope: [
                'https://www.googleapis.com/auth/calendar',
                'email',
                'profile',
              ],
              state,
              prompt: 'consent',
            }),
            `sample_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=300`,
          );
        }
        if (url.pathname === '/callback') {
          const state = url.searchParams.get('state') ?? '';
          const cookie = request.headers
            .get('cookie')
            ?.split(';')
            .map((s) => s.trim())
            .find((s) => s.startsWith('sample_state='))
            ?.slice(13);
          if (cookie !== state || (pending.get(state) ?? 0) <= Date.now())
            return json({ error: 'Invalid OAuth state.' }, 400);
          pending.delete(state);
          if (url.searchParams.has('error')) {
            status = `Authorization denied: ${url.searchParams.get('error')}`;
            return redirect('/', 'sample_state=; Path=/; Max-Age=0');
          }
          const code = url.searchParams.get('code');
          if (!code) return json({ error: 'Missing authorization code.' }, 400);
          const result = await auth.getToken(code);
          auth.setCredentials(result.tokens);
          identity = (
            await auth.request({
              url: config.userInfoUrl ?? `${config.provider}/userinfo`,
            })
          ).data;
          channel = undefined;
          lastEventId = undefined;
          lastResult = null;
          selected = 'primary';
          status = 'Connected.';
          return redirect('/', 'sample_state=; Path=/; Max-Age=0');
        }
        if (url.pathname === '/notifications' && request.method === 'POST') {
          notifications.push(
            Object.fromEntries(
              [...request.headers]
                .filter(([key]) => key.startsWith('x-goog-'))
                .map(([key, value]) => [
                  key,
                  key === 'x-goog-channel-token' ? '[REDACTED]' : value,
                ]),
            ),
          );
          if (notifications.length > 100) notifications.shift();
          return new Response(null, { status: 204 });
        }
        if (url.pathname.startsWith('/api/')) {
          if (
            request.headers.get('origin') &&
            request.headers.get('origin') !== url.origin
          )
            return json({ error: 'Cross-origin requests are forbidden.' }, 403);
          if (url.pathname === '/api/state' && request.method === 'GET') {
            let calendars: unknown = [];
            let events: unknown = [];
            let busy: unknown = null;
            if (auth.credentials.access_token) {
              try {
                calendars = (await sdk.calendarList.list()).data.items ?? [];
                events =
                  (
                    await sdk.events.list({
                      calendarId: selected,
                      orderBy: 'startTime',
                      singleEvents: true,
                    })
                  ).data.items ?? [];
                busy = (
                  await sdk.freebusy.query({
                    requestBody: {
                      timeMin: '2026-10-19T00:00:00Z',
                      timeMax: '2026-10-20T00:00:00Z',
                      items: [{ id: selected }],
                    },
                  })
                ).data;
              } catch {
                if (!status.startsWith('Authorization denied'))
                  status = 'Connection unavailable. Reconnect to continue.';
              }
            }
            return json({
              status,
              identity,
              calendars,
              events,
              busy,
              notifications,
              selected,
              lastEventId,
              lastResult,
              connected: !!auth.credentials.access_token,
            });
          }
          if (url.pathname === '/api/action' && request.method === 'POST') {
            if (
              !request.headers.get('content-type')?.includes('application/json')
            )
              return json({ error: 'Use JSON.' }, 415);
            const data = (await request.json()) as Record<string, string>;
            if (!auth.credentials.access_token)
              return json({ error: 'Connect a calendar first.' }, 401);
            if (data.action === 'select') {
              selected = data.calendarId ?? 'primary';
              lastEventId = undefined;
            } else if (data.action === 'create') {
              const result = await sdk.events.insert({
                calendarId: selected,
                requestBody: {
                  summary: data.summary ?? 'SDK sample event',
                  start: {
                    dateTime: data.start ?? '2026-10-19T12:00:00+09:00',
                  },
                  end: { dateTime: data.end ?? '2026-10-19T13:00:00+09:00' },
                  extendedProperties: {
                    private: { source: 'calendarpit-sample' },
                  },
                },
              });
              lastEventId = result.data.id ?? undefined;
              lastResult = result.data;
            } else if (data.action === 'update') {
              if (!lastEventId) throw new Error('Create an event first.');
              lastResult = (
                await sdk.events.patch({
                  calendarId: selected,
                  eventId: lastEventId,
                  requestBody: {
                    summary: data.summary ?? 'Updated from SDK sample',
                    ...(data.start && data.end
                      ? {
                          start: { dateTime: data.start },
                          end: { dateTime: data.end },
                        }
                      : {}),
                  },
                })
              ).data;
            } else if (data.action === 'delete') {
              if (!lastEventId) throw new Error('Create an event first.');
              await sdk.events.delete({
                calendarId: selected,
                eventId: lastEventId,
              });
              lastEventId = undefined;
              lastResult = 'Event deleted.';
            } else if (data.action === 'watch') {
              if (channel) throw new Error('Stop the current channel first.');
              channel = (
                await sdk.events.watch({
                  calendarId: selected,
                  requestBody: {
                    id: crypto.randomUUID(),
                    type: 'web_hook',
                    address: `${config.origin}/notifications`,
                    token: 'sample-channel-token',
                  },
                })
              ).data;
              lastResult = channel;
            } else if (data.action === 'stop') {
              if (channel)
                await sdk.channels.stop({
                  requestBody: {
                    id: channel.id,
                    resourceId: channel.resourceId,
                  },
                });
              channel = undefined;
              lastResult = 'Channel stopped.';
            } else if (data.action === 'refresh') {
              await auth.refreshAccessToken();
              lastResult = 'Token refreshed.';
            } else if (data.action === 'revoke') {
              await auth.revokeCredentials();
              identity = null;
              channel = undefined;
              status = 'Revoked. Reconnect to continue.';
            } else return json({ error: 'Unknown action.' }, 400);
            return json({ ok: true, lastEventId });
          }
          return json({ error: 'Not found.' }, 404);
        }
        if (url.pathname === '/')
          return new Response(page, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          });
        return new Response('Not found.', { status: 404 });
      } catch (error) {
        return json(
          {
            error:
              error instanceof Error
                ? error.message
                : 'Request failed. Reconnect if access was revoked.',
          },
          400,
        );
      }
    },
  };
}
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calendarpit SDK sample</title><style>body{font:15px system-ui;background:#f5f3ee;color:#292b27;max-width:1000px;margin:40px auto;padding:24px}h1{font-size:36px}button,a,select,input{padding:10px 14px;border:1px solid #ccc;border-radius:6px;font:inherit;background:#fffdf8;color:inherit}button,a{cursor:pointer}a{display:inline-block;background:#b9502d;color:white;text-decoration:none}section{margin:24px 0;padding:24px;background:#fffdf8;border:1px solid #dfdfd6;border-radius:8px}label{display:block;margin:14px 0}input{width:90%;display:block;margin-top:8px}.actions{display:flex;gap:10px;flex-wrap:wrap}pre{font:12px monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto}#error{color:#a33}</style></head><body><p>CALENDARPIT / GOOGLE SDK SAMPLE</p><h1>A real client. A local calendar.</h1><p>This separate Bun app uses the official Google SDK. All provider endpoints point to Calendarpit.</p><a href="/connect">Connect calendar</a> <button id="reload">Refresh state</button><p id="status">Loading…</p><p id="error" role="alert"></p><section><h2>Calendar workflow</h2><label>Calendar<select id="calendar" aria-label="Calendar"></select></label><label>Summary<input id="summary" value="SDK sample event"></label><label>Start (with offset)<input id="start" value="2026-10-19T12:00:00+09:00"></label><label>End (with offset)<input id="end" value="2026-10-19T13:00:00+09:00"></label><div class="actions"><button data-action="create">Create event</button><button data-action="update">Update event</button><button data-action="delete">Delete event</button><button data-action="watch">Start watch</button><button data-action="stop">Stop watch</button><button data-action="refresh">Refresh token</button><button data-action="revoke">Revoke connection</button></div><p>Update and delete target the last event created in this app.</p></section><section><h2>Events, busy intervals & notifications</h2><p>Busy query window: October 19, 2026, 00:00–24:00 UTC.</p><pre id="result"></pre></section><script>
const byId=id=>document.getElementById(id);
async function load(){const response=await fetch('/api/state');const data=await response.json();byId('status').textContent=data.status;byId('result').textContent=JSON.stringify(data,null,2);const select=byId('calendar');select.replaceChildren(...data.calendars.map(c=>{const option=document.createElement('option');option.value=c.id;option.textContent=c.summary;option.selected=c.id===data.selected||(data.selected==='primary'&&c.primary);return option;}));}
async function action(action){byId('error').textContent='';try{const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,calendarId:byId('calendar').value,summary:byId('summary').value,start:byId('start').value,end:byId('end').value})});const data=await response.json();if(!response.ok)throw Error(data.error);await load();}catch(e){byId('error').textContent=e.message;}}
document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>action(button.dataset.action)));byId('reload').onclick=load;byId('calendar').onchange=()=>action('select');load();
</script></body></html>`;
