import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AnimatePresence, motion } from 'motion/react';
import {
  Send,
  CheckCircle2,
  Phone,
  Loader2,
  User,
  Mail,
  MapPin,
  MessageSquare,
  CircleCheck,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { contactSchema, OTHER_SERVICE, type ContactFormValues } from '../../lib/contactSchema';
import { zodResolver } from '../../lib/zodResolver';
import { business } from '../../data/business';
import { services } from '../../data/services';
import { serviceIconMap } from '../../lib/serviceIcons';
import { Turnstile } from './Turnstile';
import { PUBLIC_TURNSTILE_SITE_KEY } from 'astro:env/client';

const turnstileRequired = Boolean(PUBLIC_TURNSTILE_SITE_KEY);

const serviceTiles = [
  ...services.slice(0, 11).map((s) => ({ title: s.title, icon: serviceIconMap[s.icon] })),
  { title: 'Emergency / Not Sure', icon: AlertTriangle },
  { title: OTHER_SERVICE, icon: HelpCircle }
];

const fieldBase =
  'w-full rounded-2xl border border-ink-200 bg-white py-3.5 text-[15px] text-ink-900 placeholder:text-ink-400 outline-none transition-colors focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10';
const errorBase = 'border-red-500/60 focus:border-red-500';
const labelBase = 'mb-1.5 block text-sm font-semibold text-ink-700';
/* Each of these carries role="alert": validation runs in JS on submit, so
   without a live region a screen-reader user gets no announcement that
   anything failed - focus just lands back in the form. */
const errorText = 'mt-1.5 text-xs font-medium text-red-600';

export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    // With no defaults, an untouched radio group reports `null`, which fails
    // Zod's *type* check before `.min(1)` is ever reached - so the visitor
    // was shown the raw "Invalid input: expected string, received null"
    // instead of "Please select a service."
    defaultValues: { name: '', phone: '', email: '', city: '', service: '', otherService: '', message: '' }
  });

  const selectedService = watch('service');

  const onSubmit = handleSubmit(async (data) => {
    const serviceLine = data.service === OTHER_SERVICE ? `Something else: ${data.otherService}` : data.service;
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'contact-form',
          name: data.name,
          phone: data.phone,
          email: data.email,
          city: data.city,
          service: serviceLine,
          message: data.message,
          urgent: data.service === 'Emergency / Not Sure',
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
        className="border-navy-500/25 bg-navy-50 flex flex-col items-center gap-4 rounded-3xl border p-10 text-center"
      >
        <CheckCircle2 className="text-navy-700 size-12" aria-hidden="true" />
        <h3 className="font-display text-ink-900 text-xl font-bold">Request received</h3>
        <p className="text-ink-600 max-w-sm text-sm">
          We'll get back to you within one business day. For emergencies, please call now.
        </p>
        <a
          href={`tel:${business.hotline.tel}`}
          className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 text-sm font-bold text-white transition-transform active:scale-95"
        >
          <Phone className="size-4" aria-hidden="true" />
          Call {business.hotline.display}
        </a>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {/* Honeypot: hidden from sighted and screen-reader users, real
          visitors never fill it. Any bot that auto-fills every field trips
          this and the server silently discards the submission. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input id="company" type="text" tabIndex={-1} autoComplete="off" {...register('company')} />
      </div>

      {status === 'error' && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Something went wrong sending your request. Please call us at{' '}
            <a href={`tel:${business.hotline.tel}`} className="font-semibold underline">
              {business.hotline.display}
            </a>{' '}
            instead.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelBase}>
            Full Name
          </label>
          <div className="relative">
            <User
              className="text-ink-400 pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="name"
              type="text"
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className={`${fieldBase} pr-4 pl-11 ${errors.name ? errorBase : ''}`}
              {...register('name')}
            />
          </div>
          {errors.name && (
            <p id="name-error" role="alert" className={errorText}>
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className={labelBase}>
            Phone Number
          </label>
          <div className="relative">
            <Phone
              className="text-ink-400 pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
              className={`${fieldBase} pr-4 pl-11 ${errors.phone ? errorBase : ''}`}
              {...register('phone')}
            />
          </div>
          {errors.phone && (
            <p id="phone-error" role="alert" className={errorText}>
              {errors.phone.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className={labelBase}>
            Email Address
          </label>
          <div className="relative">
            <Mail
              className="text-ink-400 pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={`${fieldBase} pr-4 pl-11 ${errors.email ? errorBase : ''}`}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p id="email-error" role="alert" className={errorText}>
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="city" className={labelBase}>
            City
          </label>
          <div className="relative">
            <MapPin
              className="text-ink-400 pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="city"
              type="text"
              autoComplete="address-level2"
              aria-invalid={!!errors.city}
              aria-describedby={errors.city ? 'city-error' : undefined}
              className={`${fieldBase} pr-4 pl-11 ${errors.city ? errorBase : ''}`}
              {...register('city')}
            />
          </div>
          {errors.city && (
            <p id="city-error" role="alert" className={errorText}>
              {errors.city.message}
            </p>
          )}
        </div>
      </div>

      <fieldset>
        <legend className={labelBase}>What Do You Need?</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {serviceTiles.map(({ title, icon: Icon }) => (
            <label
              key={title}
              /* The radio itself is sr-only, so without a `has-focus-visible`
                 ring on the label a keyboard user tabbing through these tiles
                 sees nothing move at all (WCAG 2.4.7). */
              className="has-checked:shadow-glow-orange group border-ink-200 hover:border-ink-300 hover:bg-ink-50 relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border bg-white px-2.5 py-4 text-center transition-colors has-checked:border-orange-500 has-checked:bg-orange-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-orange-500"
            >
              <input type="radio" value={title} className="sr-only" {...register('service')} />
              <CircleCheck
                className="absolute top-2 right-2 size-4 text-orange-600 opacity-0 transition-opacity group-has-checked:opacity-100"
                aria-hidden="true"
              />
              <Icon
                className="text-ink-400 size-6 transition-colors group-has-checked:text-orange-600"
                aria-hidden="true"
              />
              <span className="text-ink-700 text-xs leading-tight font-semibold">{title}</span>
            </label>
          ))}
        </div>
        {errors.service && (
          <p role="alert" className={errorText}>
            {errors.service.message}
          </p>
        )}
      </fieldset>

      <AnimatePresence initial={false}>
        {selectedService === OTHER_SERVICE && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <label htmlFor="otherService" className={labelBase}>
              What can we help with?
            </label>
            <input
              id="otherService"
              type="text"
              placeholder="e.g. Repiping a rental property"
              aria-invalid={!!errors.otherService}
              aria-describedby={errors.otherService ? 'otherService-error' : undefined}
              className={`${fieldBase} px-4 ${errors.otherService ? errorBase : ''}`}
              {...register('otherService')}
            />
            {errors.otherService && (
              <p id="otherService-error" role="alert" className={errorText}>
                {errors.otherService.message}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <label htmlFor="message" className={labelBase}>
          Tell Us What's Going On
        </label>
        <div className="relative">
          <MessageSquare className="text-ink-400 pointer-events-none absolute top-4 left-4 size-4" aria-hidden="true" />
          <textarea
            id="message"
            rows={4}
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? 'message-error' : undefined}
            className={`${fieldBase} resize-none pr-4 pl-11 ${errors.message ? errorBase : ''}`}
            {...register('message')}
          />
        </div>
        {errors.message && (
          <p id="message-error" role="alert" className={errorText}>
            {errors.message.message}
          </p>
        )}
      </div>

      <div>
        <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} theme="light" />
      </div>

      <div>
        <button
          type="submit"
          disabled={isSubmitting || (turnstileRequired && !turnstileToken)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Sending&hellip;
            </>
          ) : (
            <>
              Request Service
              <Send className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </>
          )}
        </button>
        <p className="text-ink-500 mt-4 text-center text-xs">
          We'll get back to you within one business day. For emergencies, please call {business.hotline.display}.
        </p>
      </div>
    </form>
  );
}
