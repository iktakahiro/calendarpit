import { createSample } from './app';
const port = Number(process.env.SAMPLE_PORT ?? 4175);
const origin = `http://127.0.0.1:${port}`;
const sample = createSample({
  provider: process.env.CALENDARPIT_URL ?? 'http://127.0.0.1:4173',
  origin,
  clientId: process.env.SAMPLE_CLIENT_ID,
  clientSecret: process.env.SAMPLE_CLIENT_SECRET,
  authorizationUrl: process.env.AUTHORIZATION_URL,
  tokenUrl: process.env.TOKEN_URL,
  userInfoUrl: process.env.USERINFO_URL,
  calendarRootUrl: process.env.CALENDAR_API_URL,
});
const server = Bun.serve({ hostname: '127.0.0.1', port, fetch: sample.handle });
console.info(`Calendarpit Google SDK sample: ${server.url}`);
