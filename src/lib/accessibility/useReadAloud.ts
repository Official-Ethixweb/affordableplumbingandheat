import { useCallback, useEffect, useRef, useState } from 'react';
import type { A11ySettings } from './constants';

const HIGHLIGHT_CLASS = 'a11y-reading-highlight';
const READABLE_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption';

export type ReadAloudStatus = 'idle' | 'playing' | 'paused';
export type ReadAloudMode = 'page' | 'selection' | null;

function collectReadableBlocks(): HTMLElement[] {
  const root = document.querySelector('main') ?? document.body;
  return Array.from(root.querySelectorAll<HTMLElement>(READABLE_SELECTOR)).filter((el) => {
    if (!el.textContent?.trim()) return false;
    if (el.closest('[data-a11y-panel]')) return false;
    return el.offsetParent !== null;
  });
}

export function useReadAloud(settings: A11ySettings, announce: (message: string) => void) {
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  /* WebKit on iOS/iPadOS accepts `utterance.volume` and then ignores it -
     speech always plays at the device volume. Exposing that here lets the
     panel hide a slider that would otherwise look broken: the visitor drags
     it to 20% and nothing gets quieter. Detected by engine rather than UA
     string family, since every iOS browser is WebKit underneath. */
  const [volumeSupported] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return !(/iPad|iPhone|iPod/.test(navigator.platform) || touchMac);
  });
  const [status, setStatus] = useState<ReadAloudStatus>('idle');
  const [mode, setMode] = useState<ReadAloudMode>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const settingsRef = useRef(settings);
  const blocksRef = useRef<HTMLElement[]>([]);
  const indexRef = useRef(0);
  const highlightedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!supported) return;
    function loadVoices() {
      setVoices(window.speechSynthesis.getVoices());
    }
    loadVoices();
    /* iOS Safari populates the voice list lazily and fires `voiceschanged`
       inconsistently - often not until after the first user gesture - so a
       one-shot read at mount leaves the Voice picker permanently empty there.
       Re-read on the first interaction, and poll briefly as a backstop for
       the engines that never fire the event at all. */
    const onFirstGesture = () => loadVoices();
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    window.addEventListener('keydown', onFirstGesture, { once: true });
    let tries = 0;
    const poll = window.setInterval(() => {
      if (window.speechSynthesis.getVoices().length > 0 || ++tries > 10) {
        window.clearInterval(poll);
        loadVoices();
        return;
      }
      loadVoices();
    }, 250);
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      window.clearInterval(poll);
    };
  }, [supported]);

  const clearHighlight = useCallback(() => {
    highlightedRef.current?.classList.remove(HIGHLIGHT_CLASS);
    highlightedRef.current = null;
  }, []);

  const applyHighlight = useCallback(
    (el: HTMLElement) => {
      clearHighlight();
      el.classList.add(HIGHLIGHT_CLASS);
      highlightedRef.current = el;
      el.scrollIntoView({ behavior: settingsRef.current.reduceMotion ? 'auto' : 'smooth', block: 'center' });
    },
    [clearHighlight]
  );

  const pickVoice = useCallback(() => {
    const uri = settingsRef.current.readAloudVoiceURI;
    if (!uri) return undefined;
    return voices.find((v) => v.voiceURI === uri);
  }, [voices]);

  const speakBlockRef = useRef<(i: number) => void>(() => {});

  const speakBlock = useCallback(
    (i: number) => {
      const blocks = blocksRef.current;
      if (i < 0 || i >= blocks.length) {
        setStatus('idle');
        setMode(null);
        clearHighlight();
        announce('Finished reading the page');
        return;
      }
      indexRef.current = i;
      applyHighlight(blocks[i]);
      const utterance = new SpeechSynthesisUtterance(blocks[i].textContent ?? '');
      utterance.rate = settingsRef.current.readAloudRate;
      utterance.volume = settingsRef.current.readAloudVolume;
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        if (indexRef.current === i) speakBlockRef.current(i + 1);
      };
      utterance.onerror = () => {
        setStatus('idle');
        setMode(null);
        clearHighlight();
      };
      window.speechSynthesis.speak(utterance);
    },
    [announce, applyHighlight, clearHighlight, pickVoice]
  );

  useEffect(() => {
    speakBlockRef.current = speakBlock;
  }, [speakBlock]);

  const readPage = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const blocks = collectReadableBlocks();
    if (blocks.length === 0) {
      announce('No readable text found on this page');
      return;
    }
    blocksRef.current = blocks;
    setMode('page');
    setStatus('playing');
    announce('Reading the page from the top');
    speakBlock(0);
  }, [announce, speakBlock, supported]);

  const readSelection = useCallback(() => {
    if (!supported) return;
    const selected = window.getSelection()?.toString().trim();
    if (!selected) {
      announce('Select some text on the page first');
      return;
    }
    window.speechSynthesis.cancel();
    clearHighlight();
    blocksRef.current = [];
    setMode('selection');
    setStatus('playing');
    announce('Reading the selected text');
    const utterance = new SpeechSynthesisUtterance(selected);
    utterance.rate = settingsRef.current.readAloudRate;
    utterance.volume = settingsRef.current.readAloudVolume;
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      setStatus('idle');
      setMode(null);
      announce('Finished reading the selection');
    };
    utterance.onerror = () => {
      setStatus('idle');
      setMode(null);
    };
    window.speechSynthesis.speak(utterance);
  }, [announce, clearHighlight, pickVoice, supported]);

  const pause = useCallback(() => {
    if (!supported || status !== 'playing') return;
    window.speechSynthesis.pause();
    setStatus('paused');
    announce('Reading paused');
  }, [announce, status, supported]);

  const resume = useCallback(() => {
    if (!supported || status !== 'paused') return;
    window.speechSynthesis.resume();
    setStatus('playing');
    announce('Reading resumed');
  }, [announce, status, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    clearHighlight();
    setStatus('idle');
    setMode(null);
    announce('Reading stopped');
  }, [announce, clearHighlight, supported]);

  const next = useCallback(() => {
    if (mode !== 'page') return;
    window.speechSynthesis.cancel();
    speakBlock(indexRef.current + 1);
  }, [mode, speakBlock]);

  const prev = useCallback(() => {
    if (mode !== 'page') return;
    window.speechSynthesis.cancel();
    speakBlock(Math.max(0, indexRef.current - 1));
  }, [mode, speakBlock]);

  useEffect(() => {
    if (!supported) return;
    return () => {
      window.speechSynthesis.cancel();
      clearHighlight();
    };
  }, [supported, clearHighlight]);

  return { supported, volumeSupported, status, mode, voices, readPage, readSelection, pause, resume, stop, next, prev };
}
