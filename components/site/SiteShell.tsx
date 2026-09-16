'use client';

/**
 * Minimal host shell so the entrance has a real page to enter into: focus
 * transfer, deep-link bypass, Replay, locale propagation, and a usable page
 * when JavaScript is unavailable.
 */
import { useEffect, useState } from 'react';
import { EntranceGate } from '@/components/entrance/EntranceGate';
import { COPY, type Locale } from '@/components/entrance/lib/content';
import type { MediaConfig } from '@/components/entrance/lib/mediaConfig';

const SITE_COPY = {
  en: {
    heroTitle: 'D Festival',
    heroLede: 'Young Pianist Program',
    aboutTitle: 'This year’s performances',
    aboutBody: 'Students of the programme perform across the season.',
    programme: 'Programme',
    faculty: 'Faculty'
  },
  'zh-Hant': {
    heroTitle: 'D Festival',
    heroLede: '青年鋼琴家藝術節',
    aboutTitle: '本年度演出',
    aboutBody: '課程學生於整個樂季演出。',
    programme: '節目',
    faculty: '師資'
  },
  'zh-Hans': {
    heroTitle: 'D Festival',
    heroLede: '青年钢琴家艺术节',
    aboutTitle: '本年度演出',
    aboutBody: '课程学生于整个乐季演出。',
    programme: '节目',
    faculty: '师资'
  }
} as const;

export function SiteShell({
  eligible,
  media,
  children
}: {
  eligible: boolean;
  media?: Partial<MediaConfig> | null;
  children?: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>('en');
  const copy = SITE_COPY[locale];
  const lang = COPY[locale].htmlLang;

  // Propagate the locale to the document itself, so it reaches assistive
  // technology and CSS :lang() rules, not just the visible labels.
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.dataset.locale = locale;
  }, [locale, lang]);

  return (
    <>
      <div id="site-root">
        <header className="site-header">
          <a className="site-header__brand" href="/">
            D&nbsp;FESTIVAL
          </a>
          <nav className="site-nav" aria-label="Main">
            <a href="/programme" lang={lang}>
              {copy.programme}
            </a>
            <a href="/programme#faculty" lang={lang}>
              {copy.faculty}
            </a>
          </nav>
        </header>

        <main id="main-content" className="site-main">
          {children ?? (
            <>
              <section className="site-hero" data-reuses-entrance-video>
                <div className="site-hero__inner">
                  <h1>{copy.heroTitle}</h1>
                  <p className="site-hero__lede" lang={lang}>
                    {copy.heroLede}
                  </p>
                </div>
              </section>

              <section className="site-section">
                <h2 lang={lang}>{copy.aboutTitle}</h2>
                <p lang={lang}>{copy.aboutBody}</p>
              </section>
            </>
          )}
        </main>

        <footer className="site-footer">
          {/* Language links keep the site switchable without JavaScript. */}
          <nav className="site-footer__langs" aria-label="Language">
            <a href="?lang=zh-Hant" lang="zh-Hant">繁體中文</a>
            <a href="?lang=zh-Hans" lang="zh-Hans">简体中文</a>
            <a href="?lang=en" lang="en">English</a>
          </nav>
          <button
            type="button"
            className="site-footer__replay"
            data-action="replay-entrance"
            lang={lang}
            hidden
          >
            {COPY[locale].replay}
          </button>
        </footer>
      </div>

      <EntranceGate eligible={eligible} media={media} onLocaleChange={setLocale} />
    </>
  );
}
