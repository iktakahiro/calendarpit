import { BorderBeam } from '../motion/border-beam';
import { useLandingMotion } from '../motion/landing-motion';
import { AdminShell, BrowserFrame } from './admin-window';
import { adminViews, type AdminView } from './admin-views';
import './admin-preview.css';

/**
 * Renders one admin UI screen as a static, theme-aware picture. The markup
 * mirrors the admin UI layout with fixed sample data, so it stays sharp at any
 * size and needs no screenshot files. It is not a live admin UI.
 */
function AdminPreview({ view }: { view: AdminView }) {
  const { path, shell, body } = adminViews[view];
  return (
    <BrowserFrame path={path}>
      {shell ? <AdminShell {...shell}>{body()}</AdminShell> : body()}
    </BrowserFrame>
  );
}

/**
 * MDX figure that shows one admin UI screen with a caption. Use it next to
 * prose that refers to that screen, for example
 * `<AdminScreen view='history' caption='API history with a failed request.' />`.
 */
export function AdminScreen({
  view,
  caption,
}: {
  view: AdminView;
  /** Visible caption. It is also the only text assistive technology reads. */
  caption: string;
}) {
  return (
    <figure className='admin-preview not-prose'>
      <AdminPreview view={view} />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

type ShowcaseItem = { view: AdminView; label: string; text: string };

const showcaseCopy: Record<'en' | 'ja', ShowcaseItem[]> = {
  en: [
    {
      view: 'schedule-week',
      label: 'Schedule',
      text: 'Events your app creates or updates appear immediately. Edit them here to set up test data.',
    },
    {
      view: 'history',
      label: 'API history',
      text: 'Every Calendar API and OAuth request, with its status, headers, and body. Filter for errors to see why a call failed.',
    },
    {
      view: 'watch',
      label: 'Watch',
      text: 'Active watch channels and each webhook delivery, with its attempt count and the HTTP status your endpoint returned.',
    },
    {
      view: 'connections',
      label: 'Connections',
      text: 'OAuth grants by test user, client, and scope. Revoke one to test how your app handles reauthorization.',
    },
  ],
  ja: [
    {
      view: 'schedule-week',
      label: 'スケジュール',
      text: 'アプリが作成・更新した予定がすぐに表示されます。ここで予定を編集して、テストデータを用意できます。',
    },
    {
      view: 'history',
      label: 'API 履歴',
      text: 'Calendar API と OAuth のリクエストを、ステータス、ヘッダー、ボディつきで確認できます。エラーだけに絞り込んで原因を調べられます。',
    },
    {
      view: 'watch',
      label: 'Watch',
      text: '有効な watch チャネルと Webhook の配信履歴です。試行回数と、エンドポイントが返した HTTP ステータスを確認できます。',
    },
    {
      view: 'connections',
      label: '接続',
      text: 'テストユーザー、OAuth クライアント、スコープごとの認可の一覧です。取り消すと、アプリの再認可の処理をテストできます。',
    },
  ],
};

/**
 * Landing page tour of the admin UI: each screen in turn, with its name and
 * one sentence on what it is for. With landing motion on, a border beam
 * circles each screen, staggered so the screens do not pulse in step.
 */
export function AdminShowcase({ lang = 'en' }: { lang?: 'en' | 'ja' }) {
  const motion = useLandingMotion();
  return (
    <ol className='admin-showcase not-prose'>
      {showcaseCopy[lang].map((item, index) => (
        <li key={item.view} className='admin-showcase-item'>
          <div className='admin-showcase-text'>
            <span className='admin-showcase-index' aria-hidden='true'>
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3>{item.label}</h3>
            <p>{item.text}</p>
          </div>
          <div className='admin-showcase-frame'>
            <AdminPreview view={item.view} />
            {motion && (
              <BorderBeam size={120} duration={12} delay={index * 3} />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
