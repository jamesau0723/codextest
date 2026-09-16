/**
 * EntranceContent (spec 3, 4, 8).
 *
 * Builds and animates the centred foreground: language choice, the two typed
 * questions, the ten-word passage, and the final D transformation — plus the
 * reduced-motion alternative.
 *
 * All motion is computed numerically from the scene clock on each frame rather
 * than handed to CSS keyframes, so a pause, a hidden tab or a held pointer
 * freezes mid-fade exactly where it was and resumes from the same value.
 */
import {
  LANGUAGE_CHOICES,
  WORDS,
  LONGEST_WORD,
  TIMING,
  copyFor,
  wordTranslation
} from './EntranceContentData.js';

const GRAPHEME_SEGMENTER =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** Split by grapheme, not by raw code units, so typing never splits a cluster. */
export function graphemes(text) {
  if (GRAPHEME_SEGMENTER) {
    return Array.from(GRAPHEME_SEGMENTER.segment(text), (segment) => segment.segment);
  }
  return Array.from(text);
}

export class EntranceContent {
  constructor({ root, container, locale, reducedMotion }) {
    this.root = root;
    this.container = container;
    this.locale = locale;
    this.reducedMotion = Boolean(reducedMotion);
    this.current = null;
    this.wordProbe = null;
    this.ensureProbe();
  }

  setLocale(locale) {
    this.locale = locale;
  }

  get copy() {
    return copyFor(this.locale);
  }

  /** Hidden probe used to size the whole word set against the longest word. */
  ensureProbe() {
    const probe = document.createElement('span');
    probe.className = 'd-word__probe';
    probe.setAttribute('aria-hidden', 'true');
    probe.lang = 'en';
    probe.textContent = LONGEST_WORD;
    this.container.appendChild(probe);
    this.wordProbe = probe;
  }

  /**
   * Scale the entire word set down when the longest English word would not fit.
   * One shared scale — words are never resized independently and never wrap.
   */
  fitWords() {
    if (!this.wordProbe || !this.container) return;
    const style = getComputedStyle(this.container);
    const available =
      this.container.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0');
    if (!(available > 0)) return;
    this.root.style.setProperty('--word-scale', '1');
    const measured = this.wordProbe.getBoundingClientRect().width;
    if (measured > available) {
      this.root.style.setProperty('--word-scale', (available / measured).toFixed(4));
    }
  }

  /** Cross-fade to a new scene panel over 250ms. Returns the new panel. */
  swap(panel) {
    const previous = this.current;
    if (previous) {
      previous.classList.add('is-leaving');
      previous.setAttribute('aria-hidden', 'true');
      setTimeout(() => previous.remove(), TIMING.sceneTransition);
    }
    panel.classList.add('is-entering');
    this.container.appendChild(panel);
    // Force a style flush so the entering transition actually runs.
    void panel.offsetWidth;
    panel.classList.remove('is-entering');
    this.current = panel;
    return panel;
  }

  makePanel(name) {
    const panel = document.createElement('section');
    panel.className = 'd-scene';
    panel.dataset.scene = name;
    return panel;
  }

  /** Scene 1 — language choice. All three options carry equal weight. */
  renderLanguage({ onSelect }) {
    const copy = this.copy;
    const panel = this.makePanel('language');

    const heading = document.createElement('h2');
    heading.className = 'd-scene__heading';
    heading.tabIndex = -1;
    heading.textContent = copy.languageHeading;
    heading.lang = copy.htmlLang;
    panel.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'd-language';
    list.setAttribute('role', 'group');
    list.setAttribute('aria-labelledby', ensureId(heading));

    for (const choice of LANGUAGE_CHOICES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'd-button d-language__option';
      button.lang = choice.lang;
      button.textContent = choice.label;
      button.dataset.locale = choice.locale;
      button.dataset.action = 'select-language';
      // No option is pre-selected: nothing here sets aria-pressed or a
      // "current" class, so no choice carries default visual weight.
      button.addEventListener('click', () => onSelect(choice.locale));
      list.appendChild(button);
    }

    panel.appendChild(list);
    this.swap(panel);
    return { panel, heading };
  }

  /**
   * Scenes 2 and 3 — a typed question with an always-available advance control.
   * The full question is exposed to assistive technology once; the per-grapheme
   * layer is decorative.
   */
  renderQuestion(index, { onAdvance }) {
    const copy = this.copy;
    const text = index === 1 ? copy.question1 : copy.question2;
    const panel = this.makePanel(`question${index}`);

    const main = document.createElement('div');
    main.className = 'd-scene__main';

    const heading = document.createElement('h2');
    heading.className = 'd-scene__question';
    heading.tabIndex = -1;
    heading.lang = copy.htmlLang;

    const semantic = document.createElement('span');
    semantic.className = 'sr-only';
    semantic.textContent = text;
    heading.appendChild(semantic);

    const typing = document.createElement('span');
    typing.className = 'd-type';
    typing.setAttribute('aria-hidden', 'true');

    const cells = graphemes(text).map((grapheme) => {
      const span = document.createElement('span');
      span.className = 'd-type__g';
      // A space must still occupy its advance width while hidden.
      span.textContent = grapheme;
      typing.appendChild(span);
      return span;
    });

    heading.appendChild(typing);
    main.appendChild(heading);

    const advance = document.createElement('button');
    advance.type = 'button';
    advance.className = 'd-button d-scene__advance';
    advance.dataset.action = 'advance';
    advance.lang = copy.htmlLang;
    advance.textContent = copy.continue;
    // Available immediately: advancing works even while the text is typing.
    advance.addEventListener('click', onAdvance);
    main.appendChild(advance);

    panel.appendChild(main);
    this.swap(panel);

    if (this.reducedMotion) {
      // Reduced motion shows the question in full immediately, with no caret.
      for (const cell of cells) cell.classList.add('is-shown');
      return { panel, heading, cells, typed: true };
    }

    for (const cell of cells) cell.classList.remove('is-shown');
    return { panel, heading, cells, typed: false };
  }

  /** Reveal typed text for an elapsed time. Idempotent and pause-safe. */
  updateTyping(state, elapsed) {
    if (!state || state.typed) return true;
    const total = state.cells.length;
    if (total === 0) return true;
    const progress = Math.min(1, elapsed / TIMING.typing);
    const shown = Math.round(progress * total);
    for (let i = 0; i < total; i += 1) {
      const cell = state.cells[i];
      const visible = i < shown;
      cell.classList.toggle('is-shown', visible);
      // A thin caret follows the revealed text and disappears when complete.
      cell.classList.toggle('has-caret', visible && i === shown - 1 && progress < 1);
    }
    if (progress >= 1) state.typed = true;
    return progress >= 1;
  }

  /** Immediately complete typing — used when pausing, so text stays readable. */
  completeTyping(state) {
    if (!state || state.typed) return;
    for (const cell of state.cells) {
      cell.classList.add('is-shown');
      cell.classList.remove('has-caret');
    }
    state.typed = true;
  }

  /** Scene 4A — the ten-word passage. */
  renderWords({ onEnter }) {
    const copy = this.copy;
    const panel = this.makePanel('words');

    const main = document.createElement('div');
    main.className = 'd-scene__main';

    const group = document.createElement('div');
    group.className = 'd-word';
    group.setAttribute('aria-hidden', 'true');

    const en = document.createElement('span');
    en.className = 'd-word__en';
    en.lang = 'en';
    group.appendChild(en);

    const zh = document.createElement('span');
    zh.className = 'd-word__zh';
    zh.lang = copy.htmlLang;
    group.appendChild(zh);

    main.appendChild(group);

    // One stable accessible list, announced once. No per-word live updates.
    const list = this.buildWordList(copy);
    main.appendChild(list);

    const enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'd-button d-scene__advance';
    enter.dataset.action = 'enter';
    enter.lang = copy.htmlLang;
    enter.textContent = copy.enter;
    enter.addEventListener('click', onEnter);
    main.appendChild(enter);

    panel.appendChild(main);
    this.swap(panel);
    this.fitWords();

    return { panel, group, en, zh, list, index: -1 };
  }

  buildWordList(copy) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sr-only';
    wrapper.setAttribute('aria-live', 'polite');
    wrapper.tabIndex = -1;

    const heading = document.createElement('p');
    heading.textContent = copy.wordListLabel;
    wrapper.appendChild(heading);

    const list = document.createElement('ol');
    for (const word of WORDS) {
      const item = document.createElement('li');
      const english = document.createElement('span');
      english.lang = 'en';
      english.textContent = word.en;
      item.appendChild(english);
      const translation = wordTranslation(word, this.locale);
      if (translation) {
        item.appendChild(document.createTextNode(' '));
        const zh = document.createElement('span');
        zh.lang = copy.htmlLang;
        zh.textContent = translation;
        item.appendChild(zh);
      }
      list.appendChild(item);
    }
    wrapper.appendChild(list);
    return wrapper;
  }

  /**
   * Drive the word passage from elapsed time.
   * Returns true once the passage has run to the end of Dawn's hold.
   */
  updateWords(state, elapsed) {
    if (!state) return false;
    const index = WORDS.findIndex((word) => elapsed >= word.start && elapsed < word.end);
    const last = WORDS[WORDS.length - 1];

    if (index === -1) {
      if (elapsed >= last.end) {
        applyWordVisual(state, 1, 0);
        return true;
      }
      return false;
    }

    const word = WORDS[index];
    if (state.index !== index) {
      state.index = index;
      state.en.textContent = word.en;
      const translation = wordTranslation(word, this.locale);
      state.zh.textContent = translation || '';
      state.zh.hidden = !translation;
    }

    const local = elapsed - word.start;
    const isDawn = index === WORDS.length - 1;
    const span = word.end - word.start;

    let opacity;
    let glow;
    if (local < TIMING.wordReveal) {
      const progress = local / TIMING.wordReveal;
      opacity = progress;
      // A very soft white glow that settles as the word becomes readable.
      glow = 1 - progress;
    } else if (!isDawn && local > span - TIMING.wordDisappear) {
      opacity = Math.max(0, (span - local) / TIMING.wordDisappear);
      glow = 0;
    } else {
      opacity = 1;
      glow = 0;
    }

    applyWordVisual(state, opacity, glow);
    return false;
  }

  /** Scene 4B — Dawn becomes D, then D FESTIVAL appears underneath. */
  renderFinal({ onEnter }) {
    const copy = this.copy;
    const panel = this.makePanel('final');

    const main = document.createElement('div');
    main.className = 'd-scene__main';

    const group = document.createElement('div');
    group.className = 'd-final';

    const heading = document.createElement('h2');
    heading.className = 'd-final__word';
    heading.tabIndex = -1;
    heading.lang = 'en';

    const dLetter = document.createElement('span');
    dLetter.className = 'd-final__d';
    dLetter.textContent = 'D';
    heading.appendChild(dLetter);

    const awn = document.createElement('span');
    awn.className = 'd-final__awn';
    awn.textContent = 'awn';
    heading.appendChild(awn);

    group.appendChild(heading);

    const zh = document.createElement('span');
    zh.className = 'd-final__zh';
    const translation = wordTranslation(WORDS[WORDS.length - 1], this.locale);
    if (translation) {
      zh.lang = copy.htmlLang;
      zh.textContent = translation;
    } else {
      zh.hidden = true;
    }
    group.appendChild(zh);

    const festival = document.createElement('p');
    festival.className = 'd-final__festival';
    festival.lang = 'en';
    festival.textContent = copy.festival;
    group.appendChild(festival);

    main.appendChild(group);

    const enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'd-button d-scene__advance';
    enter.dataset.action = 'enter';
    enter.lang = copy.htmlLang;
    enter.textContent = copy.enter;
    enter.addEventListener('click', onEnter);
    main.appendChild(enter);

    panel.appendChild(main);
    this.swap(panel);

    // Measure `awn` so the surviving D can slide to true centre smoothly.
    const awnWidth = awn.getBoundingClientRect().width;
    awn.style.setProperty('--awn-width', `${awnWidth}px`);

    const state = { panel, heading, dLetter, awn, zh, festival };
    if (this.reducedMotion) {
      // No morph under reduced motion: show the end state immediately.
      applyFinalVisual(state, 1, 1);
    } else {
      applyFinalVisual(state, 0, 0);
    }
    return state;
  }

  /** Drive the final transformation. Returns true when it has settled. */
  updateFinal(state, elapsed) {
    if (!state) return false;
    if (this.reducedMotion) {
      applyFinalVisual(state, 1, 1);
      return true;
    }
    const dissolve = Math.min(1, elapsed / TIMING.finalDissolve);
    const reveal = Math.min(
      1,
      Math.max(0, (elapsed - TIMING.finalDissolve) / TIMING.finalReveal)
    );
    applyFinalVisual(state, dissolve, reveal);
    return dissolve >= 1 && reveal >= 1;
  }

  /**
   * Reduced-motion alternative to the timed passage: all ten words at once,
   * scrollable on small or zoomed screens, with Enter D immediately available.
   */
  renderStaticWords({ onEnter }) {
    const copy = this.copy;
    const panel = this.makePanel('words-static');

    const main = document.createElement('div');
    main.className = 'd-scene__main d-scene__main--static';

    const heading = document.createElement('h2');
    heading.className = 'sr-only';
    heading.tabIndex = -1;
    heading.textContent = copy.wordListLabel;
    main.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'd-static-words';
    for (const word of WORDS) {
      const item = document.createElement('li');
      const en = document.createElement('span');
      en.className = 'd-static-words__en';
      en.lang = 'en';
      en.textContent = word.en;
      item.appendChild(en);
      const translation = wordTranslation(word, this.locale);
      if (translation) {
        const zh = document.createElement('span');
        zh.className = 'd-static-words__zh';
        zh.lang = copy.htmlLang;
        zh.textContent = translation;
        item.appendChild(zh);
      }
      list.appendChild(item);
    }
    main.appendChild(list);

    const enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'd-button d-scene__advance d-scene__advance--static';
    enter.dataset.action = 'enter';
    enter.lang = copy.htmlLang;
    enter.textContent = copy.enter;
    enter.addEventListener('click', onEnter);
    main.appendChild(enter);

    panel.appendChild(main);
    this.swap(panel);
    return { panel, heading };
  }

  destroy() {
    this.wordProbe?.remove();
    this.current = null;
  }
}

function applyWordVisual(state, opacity, glow) {
  state.group.style.opacity = String(opacity);
  const blur = (glow * 30).toFixed(2);
  const alpha = (glow * 0.85).toFixed(3);
  // The core lettering stays pure white; only the halo changes.
  state.group.style.setProperty(
    '--word-glow',
    glow > 0 ? `0 0 ${blur}px rgba(255,255,255,${alpha})` : 'none'
  );
}

function applyFinalVisual(state, dissolve, reveal) {
  state.awn.style.opacity = String(1 - dissolve);
  // Pulling `awn` in by its own measured width re-centres the surviving D.
  state.awn.style.marginRight = `calc(var(--awn-width, 0px) * -${dissolve})`;
  if (state.zh && !state.zh.hidden) state.zh.style.opacity = String(1 - dissolve);
  state.festival.style.opacity = String(reveal);
}

let idCounter = 0;
function ensureId(node) {
  if (!node.id) {
    idCounter += 1;
    node.id = `d-entrance-heading-${idCounter}`;
  }
  return node.id;
}
