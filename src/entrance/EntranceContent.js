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

const wordSegmenters = new Map();

function wordSegmenter(locale) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
  if (!wordSegmenters.has(locale)) {
    wordSegmenters.set(locale, new Intl.Segmenter(locale, { granularity: 'word' }));
  }
  return wordSegmenters.get(locale);
}

/**
 * Split text into reveal units.
 *
 * Word granularity rather than grapheme: the reveal is word-by-word. Chinese
 * has no spaces, so Intl.Segmenter does the real work there, yielding
 * 上一次 / 被 / 音樂 / 打動 rather than one character at a time.
 *
 * Returns { text, isWord } segments; whitespace and punctuation come back as
 * non-word segments so they can render as plain text and keep normal
 * line-breaking behaviour.
 */
export function segmentWords(text, locale) {
  const segmenter = wordSegmenter(locale);
  if (segmenter) {
    return Array.from(segmenter.segment(text), (segment) => ({
      text: segment.segment,
      isWord: Boolean(segment.isWordLike)
    }));
  }
  // Fallback: split on whitespace, keeping the separators.
  return text
    .split(/(\s+)/)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, isWord: !/^\s+$/.test(part) }));
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
    // Every scene starts at the top of the scrollport, so an outgoing
    // scroll-scrub scene cannot leave the next one scrolled part-way down.
    this.container.scrollTop = 0;
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
   * Scenes 2 and 3 — a scroll-scrubbed question with an always-available
   * advance control.
   *
   * Structure: a tall track supplies the scroll distance, and a sticky pin
   * holds the text at the exact centre of the viewport for the whole scrub, so
   * the spec's centring requirement survives the scroll interaction.
   *
   *   .d-scene--scroll
   *     .d-scroll-track    height = one viewport + the scrub distance
   *       .d-scroll-pin    sticky, one viewport tall, content centred
   *
   * The complete question is exposed to assistive technology once; the
   * per-word layer is decorative. Reveal state is purely a function of scroll
   * position — no timers, no intervals, nothing time-based.
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

    const reveal = document.createElement('span');
    reveal.className = 'd-reveal';
    reveal.setAttribute('aria-hidden', 'true');

    const words = [];
    for (const segment of segmentWords(text, this.locale)) {
      if (!segment.isWord) {
        if (/^\s+$/.test(segment.text)) {
          // Whitespace stays a text node, so wrapping behaves exactly as it
          // would in an ordinary paragraph.
          reveal.appendChild(document.createTextNode(segment.text));
        } else if (words.length > 0) {
          // Punctuation rides with the word it belongs to. Left on its own it
          // would sit at full brightness beside a still-blurred word, and could
          // wrap onto a line by itself — "you ?" and "時候 ？".
          words[words.length - 1].textContent += segment.text;
        } else {
          // Leading punctuation has no word to join; give it its own unit.
          const span = document.createElement('span');
          span.className = 'd-reveal__w';
          span.textContent = segment.text;
          reveal.appendChild(span);
          words.push(span);
        }
        continue;
      }
      const span = document.createElement('span');
      span.className = 'd-reveal__w';
      span.textContent = segment.text;
      reveal.appendChild(span);
      words.push(span);
    }

    heading.appendChild(reveal);

    // Scroll affordance in the eyebrow position above the question. Without it
    // a scroll-driven reveal is undiscoverable. It fades for good once the
    // scrub starts.
    const cue = document.createElement('p');
    cue.className = 'd-scroll-cue';
    cue.lang = copy.htmlLang;
    cue.setAttribute('aria-hidden', 'true');
    cue.textContent = copy.scrollCue;

    main.appendChild(cue);
    main.appendChild(heading);

    const advance = document.createElement('button');
    advance.type = 'button';
    advance.className = 'd-button d-scene__advance';
    advance.dataset.action = 'advance';
    advance.lang = copy.htmlLang;
    advance.textContent = copy.continue;
    // Available immediately at any scroll position: the reveal is never a gate.
    advance.addEventListener('click', onAdvance);
    main.appendChild(advance);

    if (this.reducedMotion) {
      // Reduced motion shows the question in full at once and asks for no
      // scrolling.
      cue.hidden = true;
      panel.appendChild(main);
      for (const word of words) {
        word.style.opacity = '1';
        word.style.filter = 'none';
      }
      this.swap(panel);
      return { panel, heading, words, scroller: null, progress: 1, revealed: true };
    }

    panel.classList.add('d-scene--scroll');

    const track = document.createElement('div');
    track.className = 'd-scroll-track';

    const pin = document.createElement('div');
    pin.className = 'd-scroll-pin';
    pin.appendChild(main);
    track.appendChild(pin);
    panel.appendChild(track);

    this.swap(panel);

    const state = {
      panel,
      heading,
      words,
      cue,
      track,
      pin,
      scroller: this.container,
      progress: -1,
      revealed: false
    };

    // Apply the unrevealed values before the first frame, so the scene never
    // flashes fully-revealed text on entry.
    this.applyReveal(state, 0);
    // Each scene starts its own scrub from the top.
    this.container.scrollTop = 0;
    return state;
  }

  /**
   * Map scroll position to reveal progress and apply it.
   *
   * progress = scrollTop / (track height - pin height): 0 when the scene is
   * untouched, 1 once the track has been scrubbed through. Each word occupies
   * a staggered window inside that range.
   */
  updateScrollReveal(state) {
    if (!state || !state.scroller || state.revealed) return true;
    const distance = state.track.offsetHeight - state.pin.offsetHeight;
    const progress = distance > 0 ? clamp(state.scroller.scrollTop / distance, 0, 1) : 1;
    // Nothing moved: skip the style writes entirely.
    if (Math.abs(progress - state.progress) < 0.0005) return progress >= 1;
    this.applyReveal(state, progress);
    return progress >= 1;
  }

  applyReveal(state, progress) {
    state.progress = progress;
    const total = state.words.length;
    const span = TIMING.scrubWindow;
    const spread = 1 - span;

    for (let i = 0; i < total; i += 1) {
      const start = total > 1 ? (i / (total - 1)) * spread : 0;
      const t = clamp((progress - start) / span, 0, 1);
      const word = state.words[i];
      word.style.opacity = (
        TIMING.revealOpacityFrom + (1 - TIMING.revealOpacityFrom) * t
      ).toFixed(3);
      const blur = TIMING.revealBlurFrom * (1 - t);
      // Drop the filter entirely once a word is readable: a blur filter across
      // a dozen inline boxes is real compositing work on a phone.
      word.style.filter = blur < 0.05 ? 'none' : `blur(${blur.toFixed(2)}px)`;
    }

    if (state.cue) state.cue.classList.toggle('is-gone', progress > 0.02);
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

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

let idCounter = 0;
function ensureId(node) {
  if (!node.id) {
    idCounter += 1;
    node.id = `d-entrance-heading-${idCounter}`;
  }
  return node.id;
}
