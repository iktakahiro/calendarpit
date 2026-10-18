import { Select } from '@cloudflare/kumo/components/select';
import { useEffect, useRef, useState } from 'react';
import type { LanguageOption } from './language-options';

/**
 * Header language menu.
 *
 * Renders Kumo's select and navigates to the option pathname, the same
 * contract as Starlight's built-in language select (`location.pathname`).
 * Choosing the current language does nothing. A page restored from the
 * back-forward cache resets to the locale that was rendered, because the
 * browser can restore the control after the reader has already picked
 * another language.
 */
export default function LanguageSelectMenu({
  label,
  value,
  options,
}: {
  /** Accessible name from Starlight's `languageSelect.accessibleLabel` string. */
  label: string;
  /** Pathname of the current locale's option. */
  value: string;
  /** Locales in menu order. Each pathname includes the site base. */
  options: readonly LanguageOption[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(value);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSelected(value);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [value]);

  return (
    <div className='docs-lang-select' ref={container}>
      <Select
        aria-label={label}
        align='end'
        container={container}
        items={options.map((option) => ({
          label: option.label,
          value: option.pathname,
        }))}
        onValueChange={(next: string | null) => {
          if (!next || next === window.location.pathname) return;
          setSelected(next);
          window.location.pathname = next;
        }}
        size='sm'
        value={selected}
      />
    </div>
  );
}
