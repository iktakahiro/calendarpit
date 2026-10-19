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
      text: 'Events your app writes appear within two seconds. Edit or add events to set up the next test.',
    },
    {
      view: 'history',
      label: 'API history',
      text: 'Read the method, status, headers, and bodies of every Calendar API and OAuth request, with credentials masked.',
    },
    {
      view: 'watch',
      label: 'Watch',
      text: 'Inspect active channels and every webhook delivery, including retries and the HTTP status your app returned.',
    },
    {
      view: 'connections',
      label: 'Connections',
      text: 'Review granted scopes, and revoke a connection to test how your app handles reconnection.',
    },
  ],
  ja: [
    {
      view: 'schedule-week',
      label: 'スケジュール',
      text: 'アプリが書き込んだ予定は 2 秒以内に表示されます。予定を編集・追加して次のテストを準備できます。',
    },
    {
      view: 'history',
      label: 'API 履歴',
      text: 'Calendar API と OAuth の各リクエストのメソッド、ステータス、ヘッダー、ボディを確認できます。認証情報はマスクされます。',
    },
    {
      view: 'watch',
      label: 'Watch',
      text: '有効なチャネルと Webhook の配信を、リトライやアプリが返した HTTP ステータスも含めて確認できます。',
    },
    {
      view: 'connections',
      label: '接続',
      text: '許可されたスコープを確認し、接続を取り消してアプリの再接続処理をテストできます。',
    },
  ],
};

/**
 * Landing page tour of the admin UI: each screen in turn, with its name and
 * one sentence on what it is for.
 */
export function AdminShowcase({ lang = 'en' }: { lang?: 'en' | 'ja' }) {
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
          <AdminPreview view={item.view} />
        </li>
      ))}
    </ol>
  );
}
