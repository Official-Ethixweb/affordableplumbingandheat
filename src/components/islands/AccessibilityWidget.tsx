import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Accessibility,
  X,
  RotateCcw,
  ALargeSmall,
  StretchHorizontal,
  Rows3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Contrast,
  Blend,
  Droplets,
  Underline,
  Highlighter,
  Heading1,
  MousePointer2,
  ScanLine,
  ScanEye,
  SpellCheck2,
  PauseCircle,
  Wind,
  ImageOff,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  Gauge,
  AudioLines,
  BookOpenText,
  TextSelect
} from 'lucide-react';
import {
  DEFAULT_A11Y_SETTINGS,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  LETTER_SPACING_MAX,
  LETTER_SPACING_MIN,
  LETTER_SPACING_STEP,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_STEP,
  READ_RATE_MAX,
  READ_RATE_MIN,
  READ_RATE_STEP,
  READ_VOLUME_MAX,
  READ_VOLUME_MIN,
  READ_VOLUME_STEP,
  type A11ySettings,
  type TextAlign
} from '../../lib/accessibility/constants';
import {
  A11yButtonGroup,
  A11ySection,
  A11ySelect,
  A11ySlider,
  A11yStepper,
  A11yToggleBox
} from './AccessibilityControls';
import {
  closeA11yPanel,
  openA11yPanel,
  resetA11ySettings,
  toggleA11yPanel,
  updateA11ySettings,
  useA11ySettings,
  useA11yPanelOpen
} from '../../lib/accessibility/store';
import { useReadAloud } from '../../lib/accessibility/useReadAloud';

const EASE = [0.16, 1, 0.3, 1] as const;

const ALIGN_OPTIONS: { value: TextAlign; label: string; icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align center', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify }
];

function focusA11yTrigger() {
  document.querySelectorAll<HTMLElement>('[data-a11y-trigger]').forEach((el) => {
    if (el.offsetParent !== null) el.focus();
  });
}

function focusableIn(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )
  );
}

export default function AccessibilityWidget() {
  const open = useA11yPanelOpen();
  const [announcement, setAnnouncement] = useState('');
  const settings = useA11ySettings();

  const panelRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const maskTopRef = useRef<HTMLDivElement>(null);
  const maskBottomRef = useRef<HTMLDivElement>(null);

  const announce = (message: string) => setAnnouncement(message);
  const readAloud = useReadAloud(settings, announce);

  function update<K extends keyof A11ySettings>(key: K, value: A11ySettings[K], message?: string) {
    updateA11ySettings((prev) => {
      const next: A11ySettings = { ...prev, [key]: value };
      if (key === 'readingGuide' && value === true) next.readingMask = false;
      if (key === 'readingMask' && value === true) next.readingGuide = false;
      return next;
    });
    if (message) announce(message);
  }

  // Open when the mobile nav menu's "Accessibility" row fires this (see Navbar.astro).
  useEffect(() => {
    const onOpenRequest = () => openA11yPanel();
    window.addEventListener('open-a11y-panel', onOpenRequest);
    return () => window.removeEventListener('open-a11y-panel', onOpenRequest);
  }, []);

  // Apply effects to the document whenever settings change.
  useEffect(() => {
    const html = document.documentElement;
    const classes: Record<string, boolean> = {
      'a11y-high-contrast': settings.highContrast,
      'a11y-invert': settings.invertColors,
      'a11y-grayscale': settings.grayscale,
      'a11y-underline-links': settings.underlineLinks,
      'a11y-highlight-links': settings.highlightLinks,
      'a11y-highlight-headings': settings.highlightHeadings,
      'a11y-large-cursor': settings.largeCursor,
      'a11y-dyslexia-font': settings.dyslexiaFont,
      'a11y-hide-images': settings.hideImages,
      'a11y-pause-animations': settings.pauseAnimations,
      'a11y-reduce-motion': settings.reduceMotion,
      'a11y-custom-spacing': settings.letterSpacing > 0,
      'a11y-custom-leading': settings.lineHeight > 0,
      'a11y-align-left': settings.textAlign === 'left',
      'a11y-align-center': settings.textAlign === 'center',
      'a11y-align-right': settings.textAlign === 'right',
      'a11y-align-justify': settings.textAlign === 'justify'
    };
    for (const [cls, active] of Object.entries(classes)) html.classList.toggle(cls, active);

    html.style.setProperty('--a11y-font-scale', String(settings.fontScale));
    html.style.setProperty('--a11y-letter-spacing', `${settings.letterSpacing}em`);
    html.style.setProperty('--a11y-line-height', String(1.5 + settings.lineHeight));
  }, [settings]);

  // Reading guide: a highlighted bar that follows the cursor.
  useEffect(() => {
    if (!settings.readingGuide) return;
    function onMove(e: MouseEvent) {
      if (guideRef.current) guideRef.current.style.top = `${e.clientY - 22}px`;
    }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [settings.readingGuide]);

  // Reading mask: dims everything except a horizontal band around the cursor.
  useEffect(() => {
    if (!settings.readingMask) return;
    const gap = 90;
    function onMove(e: MouseEvent) {
      if (maskTopRef.current) maskTopRef.current.style.height = `${Math.max(0, e.clientY - gap)}px`;
      if (maskBottomRef.current)
        maskBottomRef.current.style.height = `${Math.max(0, window.innerHeight - e.clientY - gap)}px`;
    }
    onMove({ clientY: window.innerHeight / 2 } as MouseEvent);
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [settings.readingMask]);

  // Global shortcut (Alt+A) and Escape-to-close.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        toggleA11yPanel();
      } else if (e.key === 'Escape' && open) {
        closeA11yPanel();
        focusA11yTrigger();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Focus the panel on open; trap Tab while open.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusables = focusableIn(panelRef.current);
    focusables[0]?.focus();

    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = focusableIn(panelRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [open]);

  function resetAll() {
    resetA11ySettings();
    announce('All accessibility settings reset to default');
  }

  return (
    <>
      {settings.readingGuide && (
        <div ref={guideRef} aria-hidden className="a11y-reading-guide-bar" style={{ top: '50%' }} />
      )}
      {settings.readingMask && (
        <>
          <div ref={maskTopRef} aria-hidden className="a11y-reading-mask-panel" style={{ top: 0 }} />
          <div ref={maskBottomRef} aria-hidden className="a11y-reading-mask-panel" style={{ bottom: 0 }} />
        </>
      )}

      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      {/* Floating trigger, bottom-left on every screen size */}
      <button
        type="button"
        data-a11y-trigger
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-label={open ? 'Close accessibility menu' : 'Open accessibility menu (Alt+A)'}
        onClick={() => toggleA11yPanel()}
        /* Below lg the sticky call bar owns the bottom ~77px of the screen,
           so this trigger has to clear it (mirroring the chat launcher's
           bottom-24) or it renders on top of the Call Now / Get Estimate
           buttons. From lg up the call bar is hidden and it can sit low. */
        className="fixed bottom-24 left-[21px] z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-navy-900 text-white shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4)] transition-transform active:scale-95 lg:bottom-[21px]"
      >
        {open ? <X className="h-[19.2px] w-[19.2px]" /> : <Accessibility className="h-[19.2px] w-[19.2px]" />}
      </button>

      {/* z-40 is the tier the chat launcher also sits on, and the launcher is
          rendered after this one, so at z-40 it painted straight over the
          bottom-right corner of the open panel. An open panel outranks every
          floating launcher; closed, it drops back so it never traps clicks. */}
      <div className={`fixed bottom-20 left-3 ${open ? 'z-[60]' : 'z-40'}`}>
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              id="a11y-panel"
              data-a11y-panel
              role="dialog"
              aria-modal="true"
              aria-label="Accessibility settings"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="border-ink-100 flex h-[min(640px,72vh)] w-[calc(100vw-1.5rem)] max-w-[380px] flex-col overflow-hidden rounded-[1.75rem] border bg-white shadow-2xl shadow-black/15"
            >
              <div className="relative shrink-0 overflow-hidden bg-navy-900 p-5">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ background: 'radial-gradient(circle at 18% 0%, rgba(236,87,19,0.35), transparent 60%)' }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-orange-300">
                      <Accessibility className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-white">Accessibility</div>
                      <div className="text-xs text-white/65">Personalize how you view this site</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close accessibility menu"
                    onClick={() => {
                      closeA11yPanel();
                      focusA11yTrigger();
                    }}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="a11y-panel-scroll flex-1 overflow-y-auto p-4">
                <div className="grid gap-5">
                  <A11ySection title="Read aloud">
                    {!readAloud.supported ? (
                      <p className="border-ink-100 text-ink-500 rounded-xl border bg-white px-3 py-3 text-xs leading-relaxed">
                        Read Aloud isn&rsquo;t supported in this browser. Try the latest Chrome, Edge, or Safari.
                      </p>
                    ) : (
                      <>
                        {readAloud.status === 'idle' ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={readAloud.readPage}
                              className="border-ink-100 inline-flex flex-col items-center gap-1.5 rounded-xl border bg-white px-2 py-3 text-center transition-colors hover:border-orange-400 hover:text-orange-600"
                            >
                              <BookOpenText className="h-4 w-4" />
                              <span className="text-ink-800 text-xs font-medium">Read page</span>
                            </button>
                            <button
                              type="button"
                              onClick={readAloud.readSelection}
                              className="border-ink-100 inline-flex flex-col items-center gap-1.5 rounded-xl border bg-white px-2 py-3 text-center transition-colors hover:border-orange-400 hover:text-orange-600"
                            >
                              <TextSelect className="h-4 w-4" />
                              <span className="text-ink-800 text-xs font-medium">Read selection</span>
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-orange-500 bg-orange-50 px-3 py-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-orange-600">
                              <AudioLines className="h-4 w-4" />
                              {readAloud.status === 'playing' ? 'Reading aloud' : 'Paused'}
                              {readAloud.mode === 'page' ? ' · page' : ' · selection'}
                            </div>
                            <div className="mt-3 grid grid-cols-4 gap-1.5">
                              <button
                                type="button"
                                aria-label="Previous paragraph"
                                disabled={readAloud.mode !== 'page'}
                                onClick={readAloud.prev}
                                className="border-ink-100 text-ink-800 inline-flex items-center justify-center rounded-lg border py-2 transition-colors hover:border-orange-400 hover:text-orange-600 disabled:pointer-events-none disabled:opacity-40"
                              >
                                <SkipBack className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label={readAloud.status === 'playing' ? 'Pause reading' : 'Resume reading'}
                                onClick={readAloud.status === 'playing' ? readAloud.pause : readAloud.resume}
                                className="inline-flex items-center justify-center rounded-lg border border-orange-600 bg-orange-600 py-2 text-white"
                              >
                                {readAloud.status === 'playing' ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                aria-label="Stop reading"
                                onClick={readAloud.stop}
                                className="border-ink-100 text-ink-800 inline-flex items-center justify-center rounded-lg border py-2 transition-colors hover:border-orange-400 hover:text-orange-600"
                              >
                                <Square className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Next paragraph"
                                disabled={readAloud.mode !== 'page'}
                                onClick={readAloud.next}
                                className="border-ink-100 text-ink-800 inline-flex items-center justify-center rounded-lg border py-2 transition-colors hover:border-orange-400 hover:text-orange-600 disabled:pointer-events-none disabled:opacity-40"
                              >
                                <SkipForward className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        <A11ySlider
                          icon={Gauge}
                          label="Reading speed"
                          tooltip="Adjust how fast the voice reads"
                          min={READ_RATE_MIN}
                          max={READ_RATE_MAX}
                          step={READ_RATE_STEP}
                          value={settings.readAloudRate}
                          displayValue={`${settings.readAloudRate.toFixed(1)}x`}
                          onChange={(v) => update('readAloudRate', v)}
                        />
                        {readAloud.volumeSupported && (
                          <A11ySlider
                            icon={Volume2}
                            label="Volume"
                            tooltip="Adjust the read-aloud volume"
                            min={READ_VOLUME_MIN}
                            max={READ_VOLUME_MAX}
                            step={READ_VOLUME_STEP}
                            value={settings.readAloudVolume}
                            displayValue={`${Math.round(settings.readAloudVolume * 100)}%`}
                            onChange={(v) => update('readAloudVolume', v)}
                          />
                        )}
                        {readAloud.voices.length > 0 && (
                          <A11ySelect
                            icon={AudioLines}
                            label="Voice"
                            tooltip="Choose which system voice reads the page"
                            value={settings.readAloudVoiceURI ?? ''}
                            options={[
                              { value: '', label: 'System default' },
                              ...readAloud.voices.map((v) => ({
                                value: v.voiceURI,
                                label: `${v.name}${v.lang ? ` (${v.lang})` : ''}`
                              }))
                            ]}
                            onChange={(v) => update('readAloudVoiceURI', v || null)}
                          />
                        )}
                      </>
                    )}
                  </A11ySection>

                  <A11ySection title="Text">
                    <A11yStepper
                      icon={ALargeSmall}
                      label="Text size"
                      tooltip="Increase, decrease, or reset the site's text size"
                      valueLabel={`${Math.round(settings.fontScale * 100)}%`}
                      canIncrease={settings.fontScale < FONT_SCALE_MAX}
                      canDecrease={settings.fontScale > FONT_SCALE_MIN}
                      onIncrease={() =>
                        update(
                          'fontScale',
                          Math.min(FONT_SCALE_MAX, +(settings.fontScale + FONT_SCALE_STEP).toFixed(2)),
                          'Text size increased'
                        )
                      }
                      onDecrease={() =>
                        update(
                          'fontScale',
                          Math.max(FONT_SCALE_MIN, +(settings.fontScale - FONT_SCALE_STEP).toFixed(2)),
                          'Text size decreased'
                        )
                      }
                      onReset={() => update('fontScale', DEFAULT_A11Y_SETTINGS.fontScale, 'Text size reset')}
                    />
                    <A11ySlider
                      icon={StretchHorizontal}
                      label="Letter spacing"
                      tooltip="Adjust the spacing between letters"
                      min={LETTER_SPACING_MIN}
                      max={LETTER_SPACING_MAX}
                      step={LETTER_SPACING_STEP}
                      value={settings.letterSpacing}
                      displayValue={
                        settings.letterSpacing === 0 ? 'Default' : `+${settings.letterSpacing.toFixed(2)}em`
                      }
                      onChange={(v) => update('letterSpacing', v)}
                    />
                    <A11ySlider
                      icon={Rows3}
                      label="Line height"
                      tooltip="Adjust the spacing between lines of text"
                      min={LINE_HEIGHT_MIN}
                      max={LINE_HEIGHT_MAX}
                      step={LINE_HEIGHT_STEP}
                      value={settings.lineHeight}
                      displayValue={settings.lineHeight === 0 ? 'Default' : (1.5 + settings.lineHeight).toFixed(1)}
                      onChange={(v) => update('lineHeight', v)}
                    />
                    <A11yButtonGroup
                      icon={AlignJustify}
                      label="Text alignment"
                      tooltip="Change how paragraph text is aligned"
                      options={ALIGN_OPTIONS}
                      value={settings.textAlign === 'default' ? ('left' as TextAlign) : settings.textAlign}
                      onChange={(v) => update('textAlign', v, `Text aligned ${v}`)}
                    />
                  </A11ySection>

                  <A11ySection title="Visual" columns={3}>
                    <A11yToggleBox
                      icon={Contrast}
                      label="High contrast"
                      tooltip="Maximize contrast between text and background"
                      checked={settings.highContrast}
                      onChange={(v) => update('highContrast', v, `High contrast ${v ? 'enabled' : 'disabled'}`)}
                    />
                    <A11yToggleBox
                      icon={Blend}
                      label="Invert colors"
                      tooltip="Invert the site's colors, photos stay true to life"
                      checked={settings.invertColors}
                      onChange={(v) => update('invertColors', v, `Invert colors ${v ? 'enabled' : 'disabled'}`)}
                    />
                    <A11yToggleBox
                      icon={Droplets}
                      label="Grayscale"
                      tooltip="Remove color from the entire site"
                      checked={settings.grayscale}
                      onChange={(v) => update('grayscale', v, `Grayscale ${v ? 'enabled' : 'disabled'}`)}
                    />
                    <A11yToggleBox
                      icon={Underline}
                      label="Underline links"
                      tooltip="Add underlines to every link"
                      checked={settings.underlineLinks}
                      onChange={(v) => update('underlineLinks', v, `Underline links ${v ? 'enabled' : 'disabled'}`)}
                    />
                    <A11yToggleBox
                      icon={Highlighter}
                      label="Highlight links"
                      tooltip="Add a bright highlight behind every link"
                      checked={settings.highlightLinks}
                      onChange={(v) => update('highlightLinks', v, `Highlight links ${v ? 'enabled' : 'disabled'}`)}
                    />
                    <A11yToggleBox
                      icon={Heading1}
                      label="Highlight headings"
                      tooltip="Outline every heading on the page"
                      checked={settings.highlightHeadings}
                      onChange={(v) =>
                        update('highlightHeadings', v, `Highlight headings ${v ? 'enabled' : 'disabled'}`)
                      }
                    />
                    <A11yToggleBox
                      icon={SpellCheck2}
                      label="Dyslexia font"
                      tooltip="Switch to a more legible, evenly-spaced font"
                      checked={settings.dyslexiaFont}
                      onChange={(v) =>
                        update('dyslexiaFont', v, `Dyslexia-friendly font ${v ? 'enabled' : 'disabled'}`)
                      }
                    />
                  </A11ySection>

                  <A11ySection title="Navigation" columns={3}>
                    <A11yToggleBox
                      icon={MousePointer2}
                      label="Larger cursor"
                      tooltip="Use a larger, high-contrast mouse cursor"
                      checked={settings.largeCursor}
                      onChange={(v) => update('largeCursor', v, `Larger cursor ${v ? 'enabled' : 'disabled'}`)}
                    />
                    <A11yToggleBox
                      icon={ScanLine}
                      label="Reading guide"
                      tooltip="A highlighted line that follows your cursor"
                      checked={settings.readingGuide}
                      onChange={(v) => update('readingGuide', v, `Reading guide ${v ? 'enabled' : 'disabled'}`)}
                    />
                    <A11yToggleBox
                      icon={ScanEye}
                      label="Reading mask"
                      tooltip="Dim everything except a band around your cursor"
                      checked={settings.readingMask}
                      onChange={(v) => update('readingMask', v, `Reading mask ${v ? 'enabled' : 'disabled'}`)}
                    />
                  </A11ySection>

                  <A11ySection title="Motion & media" columns={3}>
                    <A11yToggleBox
                      icon={PauseCircle}
                      label="Pause animations"
                      tooltip="Freeze all moving elements in place"
                      checked={settings.pauseAnimations}
                      onChange={(v) => update('pauseAnimations', v, `Animations ${v ? 'paused' : 'resumed'}`)}
                    />
                    <A11yToggleBox
                      icon={Wind}
                      label="Reduce motion"
                      tooltip="Skip transitions and motion effects"
                      checked={settings.reduceMotion}
                      onChange={(v) => update('reduceMotion', v, `Reduced motion ${v ? 'enabled' : 'disabled'}`)}
                    />
                    <A11yToggleBox
                      icon={ImageOff}
                      label="Hide images"
                      tooltip="Hide photos so screen readers focus on text"
                      checked={settings.hideImages}
                      onChange={(v) => update('hideImages', v, `Hide images ${v ? 'enabled' : 'disabled'}`)}
                    />
                  </A11ySection>
                </div>
              </div>

              <div className="border-ink-100 bg-ink-50 shrink-0 border-t p-3">
                <button
                  type="button"
                  onClick={resetAll}
                  className="border-ink-200 text-ink-800 inline-flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors hover:border-orange-400 hover:text-orange-600"
                >
                  <RotateCcw className="h-4 w-4" /> Reset all settings
                </button>
                <p className="text-ink-400 mt-2 text-center text-[11px]">Alt+A to toggle &middot; Esc to close</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
