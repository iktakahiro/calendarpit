import { uiTranslations, type Translations } from 'fumadocs-ui/i18n';
import { i18n } from './i18n';

/** Japanese labels for the Fumadocs controls used by this site. */
export const japaneseLabels = {
  'Choose a language(language switcher)': '言語を選択',
  'Choose a language(language switcher)(aria-label)': '言語を選択',
  'On this page(table of contents)': '目次',
  'Table of Contents(inline table of contents)': '目次',
  'No Headings(table of contents)': '見出しはありません',
  'Previous Page(pagination)': '前のページ',
  'Next Page(pagination)': '次のページ',
  'Toggle Theme(theme switcher)(aria-label)': 'テーマを切り替え',
  'Light(theme switcher)(aria-label)': 'ライト',
  'Dark(theme switcher)(aria-label)': 'ダーク',
  'System(theme switcher)(aria-label)': 'システム',
  'Toggle Menu(mobile menu)(aria-label)': 'メニューを切り替え',
  'Open Sidebar(sidebar)(aria-label)': 'サイドバーを開く',
  'Close Sidebar(sidebar)(aria-label)': 'サイドバーを閉じる',
  'Close Sidebar(aria-label)': 'サイドバーを閉じる',
  'Collapse Sidebar(sidebar)(aria-label)': 'サイドバーを折りたたむ',
  'Show Sidebar(sidebar)': 'サイドバーを表示',
  'Hide Sidebar(sidebar)': 'サイドバーを隠す',
  'Copy Anchor Link(heading anchor)(aria-label)': '見出しのリンクをコピー',
  'Copied Anchor Link(heading anchor)(aria-label)':
    '見出しのリンクをコピーしました',
  'Copy Text(code block)(aria-label)': 'テキストをコピー',
  'Copied Text(code block)(aria-label)': 'コピーしました',
  'Copy Link(accordion)(aria-label)': 'リンクをコピー',
  'Copied Link(accordion)(aria-label)': 'リンクをコピーしました',
} satisfies Partial<Translations>;

/** Fumadocs language navigation and UI labels for both site locales. */
export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .add({
    en: { displayName: 'English' },
    ja: { displayName: '日本語', ...japaneseLabels },
  });
