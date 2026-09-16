/**
 * Split text into reveal units for the scroll-scrub reveal.
 *
 * Word granularity, not grapheme: the reveal is word-by-word. Chinese has no
 * spaces, so `Intl.Segmenter` does the real work there — it yields
 * 上一次 / 被 / 音樂 / 打動 rather than one character at a time.
 */
export type Segment = { text: string; isWord: boolean };

const segmenters = new Map<string, Intl.Segmenter>();

function segmenterFor(locale: string): Intl.Segmenter | null {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
  if (!segmenters.has(locale)) {
    segmenters.set(locale, new Intl.Segmenter(locale, { granularity: 'word' }));
  }
  return segmenters.get(locale) ?? null;
}

export function segmentWords(text: string, locale: string): Segment[] {
  const segmenter = segmenterFor(locale);
  if (segmenter) {
    return Array.from(segmenter.segment(text), (segment) => ({
      text: segment.segment,
      isWord: Boolean(segment.isWordLike)
    }));
  }
  return text
    .split(/(\s+)/)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, isWord: !/^\s+$/.test(part) }));
}

export type RevealToken = { text: string; kind: 'word' | 'space' };

/**
 * Build the tokens the reveal renders.
 *
 * Punctuation rides with the word it belongs to. Left on its own it would sit
 * at full brightness beside a still-blurred word, and could wrap onto a line by
 * itself — "you ?" and "時候 ？". Whitespace stays separate so wrapping behaves
 * exactly as it would in an ordinary paragraph.
 */
export function revealTokens(text: string, locale: string): RevealToken[] {
  const tokens: RevealToken[] = [];
  let lastWordIndex = -1;

  for (const segment of segmentWords(text, locale)) {
    if (segment.isWord) {
      tokens.push({ text: segment.text, kind: 'word' });
      lastWordIndex = tokens.length - 1;
      continue;
    }
    if (/^\s+$/.test(segment.text)) {
      tokens.push({ text: segment.text, kind: 'space' });
      continue;
    }
    if (lastWordIndex >= 0) {
      tokens[lastWordIndex] = {
        text: tokens[lastWordIndex].text + segment.text,
        kind: 'word'
      };
    } else {
      tokens.push({ text: segment.text, kind: 'word' });
      lastWordIndex = tokens.length - 1;
    }
  }

  return tokens;
}

export function countWords(tokens: RevealToken[]): number {
  return tokens.reduce((total, token) => total + (token.kind === 'word' ? 1 : 0), 0);
}
