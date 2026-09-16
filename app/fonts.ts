/**
 * Typography for the D Festival entrance.
 *
 * Loaded with next/font, so the files are downloaded at build time and served
 * from our own origin: no runtime request to a third party, no render-blocking
 * stylesheet, and no layout shift from a late swap.
 *
 * All four families are SIL Open Font License, so they can ship with the site.
 */
import { Cormorant_Garamond, Jost } from 'next/font/google';

/**
 * Latin display — Cormorant Garamond.
 *
 * A high-contrast Garamond with genuinely calligraphic proportions: fine
 * hairlines, a generous aperture and an elegant capital D, which matters more
 * here than anywhere else since Dawn resolves into a single letterform. Light
 * (300) at display sizes reads as engraved rather than printed, which suits a
 * concert programme better than a workhorse text serif.
 */
export const displayLatin = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display-latin',
  fallback: ['Georgia', 'Times New Roman', 'serif']
});

/*
 * Traditional and Simplified Chinese — Noto Serif HK and Noto Serif SC.
 *
 * Deliberately NOT loaded through next/font: it self-hosts every Unicode range
 * of a CJK family, which came to 223 files and 14MB here. They are instead
 * subset to the ~150 characters this site actually uses (132KB in total) by
 * `npm run fonts`, and declared in the generated app/fonts-cjk.css.
 *
 * Noto Serif HK carries Hong Kong glyph forms rather than Taiwanese ones, which
 * is right for a Hong Kong programme. A Song/Ming serif matches Cormorant's
 * modulated strokes far better than a sans would.
 */

/**
 * Controls and labels — Jost.
 *
 * A geometric sans in the Futura tradition. Its circular bowls and single-storey
 * shapes stay quiet next to Cormorant's modulation, and light weights with open
 * letter-spacing read as exhibition signage rather than UI chrome.
 */
export const ui = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-ui-sans',
  fallback: ['system-ui', 'Helvetica Neue', 'Arial', 'sans-serif']
});
