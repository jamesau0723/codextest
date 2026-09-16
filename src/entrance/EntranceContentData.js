/**
 * EntranceContentData
 * Translations, word order and timings, separated from rendering.
 * Spec v2.0 sections 3 and 5.
 */

export const LOCALES = ['en', 'zh-Hant', 'zh-Hans'];
export const DEFAULT_LOCALE = 'en';

/** Native spelling of each choice. Order is fixed; all choices have equal weight. */
export const LANGUAGE_CHOICES = [
  { locale: 'zh-Hant', label: '繁體中文', lang: 'zh-Hant' },
  { locale: 'zh-Hans', label: '简体中文', lang: 'zh-Hans' },
  { locale: 'en', label: 'English', lang: 'en' }
];

export const COPY = {
  en: {
    htmlLang: 'en',
    languageHeading: 'Choose your language',
    question1: 'When did music last move you?',
    question2: 'What turns notes into music?',
    continue: 'Continue',
    skip: 'Skip',
    enter: 'Enter D',
    holdHint: 'Hold anywhere for 1.5s to skip',
    holdProgress: 'Keep holding to skip',
    holdThreshold: 'Release to enter',
    pause: 'Pause motion',
    resume: 'Resume motion',
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
    skip: '略過',
    enter: '進入 D',
    holdHint: '長按任意位置 1.5 秒即可略過',
    holdProgress: '繼續長按即可略過',
    holdThreshold: '放開即可進入',
    pause: '暫停動畫',
    resume: '繼續播放',
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
    skip: '跳过',
    enter: '进入 D',
    holdHint: '长按任意位置 1.5 秒即可跳过',
    holdProgress: '继续长按即可跳过',
    holdThreshold: '松开即可进入',
    pause: '暂停动画',
    resume: '继续播放',
    replay: '重播开场',
    wordListLabel: 'D 的十个词',
    entranceLabel: 'D Festival 开场',
    festival: 'D FESTIVAL'
  }
};

/**
 * The ten D-words. English is shown in every locale so the shared initial is
 * apparent; Chinese locales add the translation underneath.
 * Timeline values are milliseconds from the start of the word passage.
 */
export const WORDS = [
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
  languageAppear: 200,
  typing: 1000,
  wordReveal: 200,
  wordHold: 800,
  wordDisappear: 200,
  dawnHold: 1200,
  wordsTotal: 12200,
  finalDissolve: 350,
  finalReveal: 250,
  exitNormal: 450,
  exitSkip: 150,
  holdThreshold: 1500,
  holdIndicatorDelay: 150,
  holdPreview: 150,
  holdTolerancePx: 12
};

export function copyFor(locale) {
  return COPY[locale] || COPY[DEFAULT_LOCALE];
}

export function wordTranslation(word, locale) {
  return locale === 'en' ? null : word[locale] || null;
}
