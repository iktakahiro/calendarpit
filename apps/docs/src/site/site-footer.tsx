import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';
import { sitePath } from './paths';

const repository = 'https://github.com/iktakahiro/calendarpit';

/**
 * Landing page footer: the Calendarpit lockup, project links, the license,
 * and a quiet credit for the project's origin.
 */
export function SiteFooter({ japanese }: { japanese: boolean }) {
  const links = [
    {
      text: japanese ? 'ドキュメント' : 'Documentation',
      url: sitePath(japanese ? 'ja/quick-start/' : 'quick-start/'),
    },
    { text: 'GitHub', url: repository, external: true },
    { text: 'Releases', url: `${repository}/releases`, external: true },
  ];

  return (
    <footer className='site-footer'>
      <div className='site-footer-main'>
        <a
          className='site-brand'
          href={sitePath(japanese ? 'ja/' : '')}
          aria-label='Calendarpit'
        >
          <img
            className='site-logo'
            data-theme='light'
            src={logoLight}
            width={182}
            height={22}
            alt=''
          />
          <img
            className='site-logo'
            data-theme='dark'
            src={logoDark}
            width={182}
            height={22}
            alt=''
          />
        </a>
        <nav className='site-footer-links' aria-label='Footer'>
          {links.map((link) => (
            <a key={link.url} href={link.url}>
              {link.text}
              {link.external && <span aria-hidden='true'>↗</span>}
            </a>
          ))}
        </nav>
      </div>
      <div className='site-footer-meta'>
        <p>
          © 2026 <a href='https://x.com/iktakahiro'>@iktakahiro</a> ·{' '}
          <a href={`${repository}/blob/main/LICENSE`}>MIT License</a>
        </p>
        <p>
          {japanese ? (
            <>
              統合カレンダーアプリ{' '}
              <a href='https://www.chronock.ai/'>Chronock</a>{' '}
              の開発から生まれました
            </>
          ) : (
            <>
              Made while building{' '}
              <a href='https://www.chronock.ai/'>Chronock</a>, a unified
              calendar app
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
