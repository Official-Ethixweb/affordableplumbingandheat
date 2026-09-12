import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Tag, X, Phone, Printer, ArrowRight, Sparkles } from 'lucide-react';
import { coupons } from '../../data/coupons';
import { business } from '../../data/business';

/* The open state used to be mirrored into sessionStorage and restored on
   mount, which meant one tap on "Coupons" re-opened the panel over the hero
   of every page the visitor browsed to afterwards - and below 1024px the
   rail tab that closes it isn't rendered. The panel now opens only when the
   visitor asks for it on the page they're on. */
const EASE = [0.16, 1, 0.3, 1] as const;

function printCoupon(coupon: (typeof coupons)[number]) {
  const win = window.open('', '_blank', 'width=480,height=640');
  if (!win) return;
  const doc = win.document;
  doc.title = `${coupon.title} - ${business.shortName} Coupon`;
  const style = doc.createElement('style');
  style.textContent = `
    body{font-family:system-ui,sans-serif;padding:32px;color:#16181e;}
    .card{border:3px dashed #ec5713;border-radius:24px;padding:32px;max-width:420px;margin:0 auto;text-align:center;}
    .brand{font-weight:800;font-size:18px;margin-bottom:24px;}
    .kicker{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#d3440a;margin:0 0 8px;font-weight:700;}
    h1{font-size:24px;margin:0 0 16px;}
    .offer{font-size:16px;margin:0 0 18px;}
    .code{display:inline-block;border:2px solid #16181e;border-radius:999px;padding:6px 18px;font-weight:700;letter-spacing:.08em;margin-bottom:18px;}
    .terms{font-size:12px;color:#555;margin:14px 0 0;line-height:1.5;}
  `;
  doc.head.appendChild(style);
  const card = doc.createElement('div');
  card.className = 'card';
  // All interpolated values come from our own static coupons.ts (no user
  // input reaches this template), so building markup here is safe.
  card.innerHTML = `
    <div class="brand">${business.shortName}</div>
    <p class="kicker">Coupon</p>
    <h1>${coupon.title}</h1>
    <p class="offer">${coupon.description}</p>
    <div class="code">CODE: ${coupon.code}</div>
    <p class="terms">Show this coupon to your technician at time of service. Restrictions may apply.</p>
    <p class="terms">Call ${business.hotline.display} to redeem.</p>
  `;
  doc.body.appendChild(card);
  win.focus();
  win.print();
}

export default function CouponWidget() {
  const [open, setOpen] = useState(false);
  const tabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const onOpenRequest = () => setOpen(true);
    window.addEventListener('open-coupon-widget', onOpenRequest);
    return () => window.removeEventListener('open-coupon-widget', onOpenRequest);
  }, []);

  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        tabRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || tabRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[39] bg-black/50 backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <button
        ref={tabRef}
        type="button"
        aria-expanded={open}
        aria-controls="coupon-panel"
        onClick={() => setOpen((v) => !v)}
        className={`shadow-glow-orange fixed top-1/2 left-0 z-40 hidden w-12 -translate-y-1/2 flex-col items-center gap-2 rounded-r-2xl border border-l-0 border-white/15 bg-gradient-to-b from-orange-500 to-orange-700 py-5 text-white transition-[width,padding] duration-300 hover:w-14 lg:flex ${open ? '' : 'animate-float'}`}
      >
        {open ? (
          <X className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <Tag className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="font-display [transform:rotate(180deg)] text-[11px] font-bold tracking-wider uppercase [writing-mode:vertical-rl]">
          {open ? 'Close' : 'Coupons'}
        </span>
        {!open && (
          <span className="font-display flex size-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
            {coupons.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id="coupon-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Current coupons and offers"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="border-ink-100 fixed inset-x-3 top-16 bottom-16 z-[60] flex max-h-[600px] flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl shadow-black/15 lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-12 lg:h-[min(600px,calc(100dvh-160px))] lg:max-h-none lg:w-[calc(100vw-3rem)] lg:max-w-[400px] lg:-translate-y-1/2"
          >
            <div className="border-ink-100 shrink-0 border-b bg-gradient-to-br from-orange-50 to-transparent px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display flex items-center gap-2 text-xs font-bold tracking-wider text-orange-600 uppercase">
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Current Offers
                  </p>
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="font-display text-ink-900 mt-1.5 text-xl font-bold text-balance outline-none"
                  >
                    {coupons.length} Ways to Save
                  </h2>
                </div>
                {/* The rail tab doubles as the close control, but it is
                    `lg:flex` only - below 1024px it never renders, which left
                    the panel with no visible way out but a backdrop tap. */}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    tabRef.current?.focus();
                  }}
                  aria-label="Close coupons"
                  className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 -mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {coupons.map((coupon) => (
                <div
                  key={coupon.code}
                  className="border-ink-100 shadow-card hover:bg-ink-50 rounded-2xl border bg-white p-4 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500 ring-1 ring-orange-500/25 ring-inset">
                      <Tag className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-ink-900 text-sm font-bold">{coupon.title}</p>
                      <p className="mt-1 text-[13px] leading-snug text-ink-600">{coupon.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="font-display border-ink-200 text-ink-500 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide">
                      CODE {coupon.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => printCoupon(coupon)}
                      aria-label={`Print ${coupon.title} coupon`}
                      className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
                    >
                      <Printer className="size-3.5" aria-hidden="true" />
                      Print
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-ink-100 shrink-0 space-y-2.5 border-t bg-mist-100 p-4">
              <a
                href={`tel:${business.hotline.tel}`}
                className="font-display flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-5 py-3 text-sm font-bold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset] transition-colors hover:bg-orange-700"
              >
                <Phone className="size-4" aria-hidden="true" />
                Call to Redeem: {business.hotline.display}
              </a>
              <a
                href="/contact-us/"
                className="text-ink-500 hover:text-ink-900 flex w-full items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold transition-colors"
              >
                Get a Free Estimate Instead
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
