/**
 * Entrance copy, word order and timings — plain data, no React.
 * Spec v2.0 sections 3 and 5.
 */

export const LOCALES = ['en', 'zh-Hant', 'zh-Hans'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type LanguageChoice = { locale: Locale; label: string; lang: string };

/** Native spelling of each choice. All options carry equal default weight. */
export const LANGUAGE_CHOICES: LanguageChoice[] = [
  { locale: 'zh-Hant', label: '繁體中文', lang: 'zh-Hant' },
  { locale: 'zh-Hans', label: '简体中文', lang: 'zh-Hans' },
  { locale: 'en', label: 'English', lang: 'en' }
];

export type Copy = {
  htmlLang: string;
  languageHeading: string;
  question1: string;
  question2: string;
  continue: string;
  enter: string;
  scrollCue: string;
  holdHint: string;
  holdProgress: string;
  holdThreshold: string;
  replay: string;
  wordListLabel: string;
  entranceLabel: string;
  festival: string;
};

export const COPY: Record<Locale, Copy> = {
  en: {
    htmlLang: 'en',
    languageHeading: 'Choose your language',
    question1: 'When did music last move you?',
    question2: 'What turns notes into music?',
    continue: 'Continue',
    enter: 'Enter D',
    scrollCue: 'Scroll to read',
    holdHint: 'Hold anywhere for 1.5s to skip',
    holdProgress: 'Keep holding to skip',
    holdThreshold: 'Release to enter',
    replay: 'Replay entrance',
    wordListLabel: 'Ten words of D',
    entranceLabel: 'D Festival entrance',
    festival: 'D FESTIVAL'
  },
  'zh-Hant': {
    htmlLang: 'zh-Hant',
    languageHeading: '選擇語言',
    question1: '上一次被音樂打動，是甚麼時候？',
    question2: '是甚麼，讓音符成為音樂？',
    continue: '繼續',
    enter: '進入 D',
    scrollCue: '向下捲動閱讀',
    holdHint: '長按任意位置 1.5 秒即可略過',
    holdProgress: '繼續長按即可略過',
    holdThreshold: '放開即可進入',
    replay: '重播開場',
    wordListLabel: 'D 的十個詞',
    entranceLabel: 'D Festival 開場',
    festival: 'D FESTIVAL'
  },
  'zh-Hans': {
    htmlLang: 'zh-Hans',
    languageHeading: '选择语言',
    question1: '上一次被音乐打动，是什么时候？',
    question2: '是什么，让音符成为音乐？',
    continue: '继续',
    enter: '进入 D',
    scrollCue: '向下滚动阅读',
    holdHint: '长按任意位置 1.5 秒即可跳过',
    holdProgress: '继续长按即可跳过',
    holdThreshold: '松开即可进入',
    replay: '重播开场',
    wordListLabel: 'D 的十个词',
    entranceLabel: 'D Festival 开场',
    festival: 'D FESTIVAL'
  }
};

export type DWord = {
  en: string;
  'zh-Hant': string;
  'zh-Hans': string;
  start: number;
  end: number;
};

/**
 * The ten D-words. English shows in every locale so the shared initial is
 * apparent; Chinese locales add the translation underneath.
 * Timeline values are milliseconds from the start of the passage.
 */
export const WORDS: DWord[] = [
  { en: 'Doubt',       'zh-Hant': '質疑', 'zh-Hans': '质疑', start: 0,     end: 1200 },
  { en: 'Desire',      'zh-Hant': '渴望', 'zh-Hans': '渴望', start: 1200,  end: 2400 },
  { en: 'Discipline',  'zh-Hant': '自律', 'zh-Hans': '自律', start: 2400,  end: 3600 },
  { en: 'Devotion',    'zh-Hant': '傾心', 'zh-Hans': '倾心', start: 3600,  end: 4800 },
  { en: 'Dialogue',    'zh-Hant': '對話', 'zh-Hans': '对话', start: 4800,  end: 6000 },
  { en: 'Daring',      'zh-Hant': '膽識', 'zh-Hans': '胆识', start: 6000,  end: 7200 },
  { en: 'Discernment', 'zh-Hant': '洞察', 'zh-Hans': '洞察', start: 7200,  end: 8400 },
  { en: 'Discovery',   'zh-Hant': '發現', 'zh-Hans': '发现', start: 8400,  end: 9600 },
  { en: 'Depth',       'zh-Hant': '深邃', 'zh-Hans': '深邃', start: 9600,  end: 10800 },
  { en: 'Dawn',        'zh-Hant': '曙光', 'zh-Hans': '曙光', start: 10800, end: 12200 }
];

/** The longest English word governs the shared word font size (spec 4). */
export const LONGEST_WORD = WORDS.reduce(
  (longest, word) => (word.en.length > longest.length ? word.en : longest),
  ''
);

export const TIMING = {
  sceneTransition: 250,
  /**
   * Scroll-scrub reveal. `scrubWindow` is the share of total scroll progress
   * over which a single word travels from unrevealed to revealed; the rest is
   * spread across the words as staggered start points.
   */
  scrubWindow: 0.35,
  revealOpacityFrom: 0.2,
  revealBlurFrom: 4,
  /** Hold hint: appears once the language is chosen, then fades for good. */
  hintVisible: 2000,
  hintFade: 400,
  wordReveal: 200,
  wordDisappear: 200,
  wordsTotal: 12200,
  finalDissolve: 350,
  finalReveal: 250,
  /** How long the finished D FESTIVAL composition holds before entering. */
  finalHold: 1100,
  /** The zoom that carries the footage down into the homepage hero. */
  zoomOut: 1500,
  /** Text and scrim clear early, so the zoom reads as one uninterrupted move. */
  zoomUiFade: 520,
  exitNormal: 450,
  exitSkip: 150,
  holdThreshold: 1500,
  holdIndicatorDelay: 150,
  /** Homepage preview reveal once the hold threshold is reached. */
  holdPreview: 150,
  holdTolerancePx: 12
} as const;

export function copyFor(locale: Locale): Copy {
  return COPY[locale] ?? COPY[DEFAULT_LOCALE];
}

export function wordTranslation(word: DWord, locale: Locale): string | null {
  return locale === 'en' ? null : word[locale] || null;
}
