import { useId, useRef, useState, type KeyboardEvent } from 'react';
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

type ShowcaseTab = { view: AdminView; label: string; text: string };

const showcaseCopy: Record<'en' | 'ja', ShowcaseTab[]> = {
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
 * Landing page tour of the admin UI: a tab per screen, each with one sentence
 * on what the screen is for.
 */
export function AdminShowcase({ lang = 'en' }: { lang?: 'en' | 'ja' }) {
  const tabs = showcaseCopy[lang];
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const current = tabs[selected] ?? tabs[0];
  if (!current) return null;

  const onKeyDown = (event: KeyboardEvent) => {
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (selected + step + tabs.length) % tabs.length;
    setSelected(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className='admin-showcase not-prose'>
      <div
        className='admin-showcase-tabs'
        role='tablist'
        aria-label={lang === 'ja' ? '管理画面の画面' : 'Admin UI screens'}
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.view}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type='button'
            role='tab'
            id={`${id}-tab-${index}`}
            aria-selected={index === selected}
            aria-controls={`${id}-panel`}
            tabIndex={index === selected ? 0 : -1}
            onClick={() => setSelected(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className='admin-showcase-panel'
        role='tabpanel'
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${selected}`}
      >
        <p>{current.text}</p>
        <AdminPreview view={current.view} />
      </div>
    </div>
  );
}
