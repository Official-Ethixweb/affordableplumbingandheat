import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'motion/react';
import { Send, CheckCircle2, Phone, Loader2, User, AlertTriangle } from 'lucide-react';
import { quickLeadSchema, type QuickLeadValues } from '../../lib/contactSchema';
import { zodResolver } from '../../lib/zodResolver';
import { business } from '../../data/business';
import { Turnstile } from './Turnstile';
import { PUBLIC_TURNSTILE_SITE_KEY } from 'astro:env/client';

const turnstileRequired = Boolean(PUBLIC_TURNSTILE_SITE_KEY);

/**
 * Short homepage enquiry form: name, phone, service, optional detail.
 *
 * Deliberately not the full ContactForm — this sits beside the hero trust
 * points as a low-friction capture, and anything more than four fields there
 * reads as work. POST /api/lead already accepts a short payload (only name and
 * phone are required), so both forms hit the same endpoint and the same inbox;
 * `source` stays 'contact-form' because the API only distinguishes form vs
 * chatbot.
 */
const SERVICE_OPTIONS = [
  'Plumbing',
  'Heating / Furnace',
  'Air Conditioning',
  'Electrical',
  'Water Heater',
  'Drain / Sewer',
  'Emergency - Need Help Now',
  'Something else'
];

const fieldBase =
  'w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/45 outline-none transition-colors focus:border-orange-400 focus:bg-white/15 focus:ring-4 focus:ring-orange-500/20';
const errorBase = 'border-red-400/70 focus:border-red-400';
const labelBase = 'mb-1.5 block text-xs font-semibold tracking-wide text-white/70 uppercase';
/* Each of these carries role="alert": validation runs in JS on submit, so
   without a live region a screen-reader user gets no announcement that
   anything failed - focus just lands back in the form. */
const errorText = 'mt-1.5 text-xs font-medium text-red-300';

export default function QuickLeadForm() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<QuickLeadValues>({ resolver: zodResolver(quickLeadSchema) });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'contact-form',
          name: data.name,
          phone: data.phone,
          service: data.service,
          message: data.message ?? '',
          urgent: data.service === 'Emergency - Need Help Now',
          company: data.company ?? '',
          turnstileToken
        })
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('sent');
    } catch {
      setTurnstileToken(null);
      setStatus('error');
    }
  });

  if (status === 'sent') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        className="flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-8 text-center"
      >
        <CheckCircle2 className="size-10 text-orange-400" aria-hidden="true" />
        <h3 className="font-display text-lg font-bold text-white">Request received</h3>
        <p className="max-w-xs text-sm text-white/70">
          We&rsquo;ll call you back shortly. For emergencies, reach us right now.
        </p>
        <a
          href={`tel:${business.hotline.tel}`}
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition-transform active:scale-95"
        >
          <Phone className="size-4" aria-hidden="true" />
          Call {business.hotline.display}
        </a>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {/* Honeypot — hidden from sighted and screen-reader users. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="quick-company">Company</label>
        <input id="quick-company" type="text" tabIndex={-1} autoComplete="off" {...register('company')} />
      </div>

      {status === 'error' && (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2.5 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Couldn&rsquo;t send that. Please call{' '}
            <a href={`tel:${business.hotline.tel}`} className="font-semibold underline">
              {business.hotline.display}
            </a>
            .
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quick-name" className={labelBase}>
            Name
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/40"
              aria-hidden="true"
            />
            <input
              id="quick-name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'quick-name-error' : undefined}
              className={`${fieldBase} pl-10 ${errors.name ? errorBase : ''}`}
              {...register('name')}
            />
          </div>
          {errors.name && (
            <p id="quick-name-error" role="alert" className={errorText}>
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="quick-phone" className={labelBase}>
            Phone
          </label>
          <div className="relative">
            <Phone
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/40"
              aria-hidden="true"
            />
            <input
              id="quick-phone"
              type="tel"
              autoComplete="tel"
              placeholder="(719) 000-0000"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'quick-phone-error' : undefined}
              className={`${fieldBase} pl-10 ${errors.phone ? errorBase : ''}`}
              {...register('phone')}
            />
          </div>
          {errors.phone && (
            <p id="quick-phone-error" role="alert" className={errorText}>
              {errors.phone.message}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="quick-service" className={labelBase}>
          What do you need?
        </label>
        <select
          id="quick-service"
          defaultValue=""
          aria-invalid={!!errors.service}
          aria-describedby={errors.service ? 'quick-service-error' : undefined}
          className={`${fieldBase} [&>option]:text-ink-900 ${errors.service ? errorBase : ''}`}
          {...register('service')}
        >
          <option value="" disabled>
            Select a service&hellip;
          </option>
          {SERVICE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.service && (
          <p id="quick-service-error" role="alert" className={errorText}>
            {errors.service.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="quick-message" className={labelBase}>
          Details <span className="font-normal normal-case">(optional)</span>
        </label>
        <textarea
          id="quick-message"
          rows={2}
          placeholder="Briefly, what&rsquo;s going on?"
          className={`${fieldBase} resize-none`}
          {...register('message')}
        />
      </div>

      <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} theme="dark" />

      <button
        type="submit"
        disabled={isSubmitting || (turnstileRequired && !turnstileToken)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-900/30 transition-transform hover:bg-orange-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Sending&hellip;
          </>
        ) : (
          <>
            Request Service
            <Send className="size-4" aria-hidden="true" />
          </>
        )}
      </button>

      <p className="text-center text-xs text-white/50">
        No obligation. For emergencies, call {business.hotline.display}.
      </p>
    </form>
  );
}
