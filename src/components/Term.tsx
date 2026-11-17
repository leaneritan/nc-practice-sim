import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { terms } from '../i18n/glossary';
import type { TermId } from '../i18n/glossary';

export function Term({ id, label }: { id: TermId; label?: string }) {
  const { language } = useI18n();
  const term = terms[id];
  const tooltipId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = useState({ left: 0, top: 0 });
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  function close() { setOpen(false); setPinned(false); pinnedRef.current = false; }
  useLayoutEffect(() => {
    if (!open || !root.current || !tooltip.current) return;
    const anchor = root.current.getBoundingClientRect();
    const box = tooltip.current.getBoundingClientRect();
    setPlacement({
      left: Math.max(8, Math.min(anchor.left, window.innerWidth - box.width - 8)),
      top: anchor.top > box.height + 16 ? anchor.top - box.height - 8 : anchor.bottom + 8,
    });
  }, [open, language]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);
  return <span className="term" ref={root}
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => { if (!pinnedRef.current) setOpen(false); }}>
    <button type="button" className="term-trigger" aria-describedby={open ? tooltipId : undefined}
      aria-expanded={open} onFocus={() => setOpen(true)} onBlur={close}
      onClick={() => {
        const next = !pinned;
        pinnedRef.current = next;
        setPinned(next);
        setOpen(next);
      }}>
      {label ?? (language === 'ja' ? term.ja : term.en)}
    </button>
    {open && <span id={tooltipId} ref={tooltip} role="tooltip" className="term-tooltip" style={placement}>
      <strong lang="ja">{term.ja}</strong>
      <span lang="ja">{term.kana}</span>
      <span lang="ja-Latn">{term.romaji}</span>
      <strong lang="en">{term.en}</strong>
      <span>{language === 'ja' ? term.meaningJa : term.meaningEn}</span>
    </span>}
  </span>;
}
