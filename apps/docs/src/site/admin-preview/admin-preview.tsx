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
      text: 'Events your app writes to Calendarpit through the Calendar API appear within 2 seconds. Add or edit events here to set up the next test.',
    },
    {
      view: 'history',
      label: 'API history',
      text: 'Inspect the method, status, headers, and bodies of every Calendar API and OAuth request your app sent, with credentials masked. Filter for error responses to see why a call failed.',
    },
    {
      view: 'watch',
      label: 'Watch',
      text: "Check active watch channels and each webhook delivery to your app's callback URL, with its attempt count and the HTTP status your endpoint returned.",
    },
    {
      view: 'connections',
      label: 'Connections',
      text: 'A connection is an OAuth grant: which test user granted which scopes to which OAuth client. Revoke one to invalidate its tokens and test how your app asks the user to authorize again.',
    },
  ],
  ja: [
    {
      view: 'schedule-week',
      label: 'スケジュール',
      text: 'アプリが Calendar API で Calendarpit に作成・更新した予定は、2 秒以内にここへ表示されます。予定を追加・編集して、次のテストのデータを用意できます。',
    },
    {
      view: 'history',
      label: 'API 履歴',
      text: 'アプリが送信した Calendar API と OAuth の各リクエストについて、メソッド、ステータス、ヘッダー、ボディを確認できます（認証情報はマスクされます）。エラーレスポンスだけに絞り込んで失敗の原因を調べられます。',
    },
    {
      view: 'watch',
      label: 'Watch',
      text: '有効な watch チャネルと、アプリのコールバック URL への Webhook 配信を確認できます。配信ごとに、試行回数とエンドポイントが返した HTTP ステータスが表示されます。',
    },
    {
      view: 'connections',
      label: 'OAuth 接続',
      text: '接続は OAuth の認可（grant）です。どのテストユーザーが、どの OAuth クライアントに、どのスコープを許可したかを確認できます。接続を取り消すとトークンが無効になるので、アプリがユーザーに再認可を求める処理をテストできます。',
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
