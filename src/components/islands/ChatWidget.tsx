import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Send, Phone, Mail, MessageCircle, Sparkles, CircleCheck, AlertTriangle } from 'lucide-react';
import { business } from '../../data/business';
import {
  detectContactInfo,
  getSmartReply,
  initialChatContext,
  isValidEmail,
  isValidName,
  isValidPhone,
  type ChatContext
} from '../../lib/chat/engine';
import { getPageContextTopic, topicLabel } from '../../lib/chat/knowledge';
import { services } from '../../data/services';
import { cityPages } from '../../data/cityPages';

const EASE = [0.16, 1, 0.3, 1] as const;
const TEASER_SEEN_KEY = 'aph-chat-teaser-seen';

type Message = { id: string; from: 'bot' | 'user'; content: React.ReactNode };
type QuickAction = { key: string; label: string; shortLabel: string; triggerText: string };
type LeadStep =
  | 'idle'
  | 'offer'
  | 'wizard-service'
  | 'wizard-urgency'
  | 'wizard-city'
  | 'wizard-type'
  | 'wizard-issue'
  | 'name'
  | 'phone'
  | 'email'
  | 'confirm'
  | 'sending'
  | 'done';
type PropertyType = 'Residential' | 'Commercial';
type LeadState = {
  step: LeadStep;
  name?: string;
  phone?: string;
  email?: string;
  wizard?: boolean;
  wizardService?: string;
  wizardUrgent?: boolean;
  wizardCity?: string;
  wizardPropertyType?: PropertyType;
  wizardIssue?: string;
};
type TranscriptLine = { from: 'bot' | 'user'; text: string };

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

const GREETING = (
  <>
    Hi, I&rsquo;m the Affordable Plumbing &amp; Heat assistant. Ask me about a service, your area, pricing, or just
    tell me what&rsquo;s going on, I&rsquo;ll get you the right answer or a real person.
  </>
);

/** Smart greeting based on current page: a visitor already reading about a
 * specific service or city gets acknowledged instead of a generic hello. */
function buildGreeting(pageTopic: string | null): React.ReactNode {
  if (pageTopic?.startsWith('service:')) {
    const slug = pageTopic.slice('service:'.length);
    const service = services.find((s) => s.slug === slug);
    if (service) {
      return (
        <>
          Hi, I&rsquo;m the Affordable Plumbing &amp; Heat assistant. Looking into {service.title.toLowerCase()}? I
          can answer questions about it, pricing, or anything else on your mind.
        </>
      );
    }
  }
  if (pageTopic?.startsWith('location:')) {
    const slug = pageTopic.slice('location:'.length);
    const city = cityPages.find((c) => c.slug === slug);
    if (city) {
      return (
        <>
          Hi, I&rsquo;m the Affordable Plumbing &amp; Heat assistant. Yep, we serve {city.name}, ask me anything about
          service there, pricing, or a specific issue.
        </>
      );
    }
  }
  return GREETING;
}

/** Quick-reply chips adapt to the page a visitor is chatting from. */
function buildQuickActions(pageTopic: string | null): QuickAction[] {
  if (pageTopic?.startsWith('service:')) {
    const slug = pageTopic.slice('service:'.length);
    const service = services.find((s) => s.slug === slug);
    if (service) {
      const contextual: QuickAction = {
        key: 'page-service-cost',
        label: `Cost of ${service.title.toLowerCase()}`,
        shortLabel: 'Pricing',
        triggerText: 'How much will this cost?'
      };
      return [contextual, ...QUICK_ACTIONS.filter((qa) => qa.key !== 'services')];
    }
  }
  return QUICK_ACTIONS;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'estimate-wizard',
    label: 'Get a free estimate',
    shortLabel: 'Free estimate',
    triggerText: "I'd like a free estimate"
  },
  { key: 'emergency', label: 'This is an emergency', shortLabel: 'Emergency', triggerText: 'This is an emergency' },
  {
    key: 'services',
    label: 'What services do you offer',
    shortLabel: 'Services',
    triggerText: 'What services do you offer?'
  },
  { key: 'areas', label: 'Do you serve my area', shortLabel: 'Service area', triggerText: 'Do you serve my area?' },
  { key: 'coupons', label: 'Any current coupons', shortLabel: 'Coupons', triggerText: 'Do you have any coupons?' },
  {
    key: 'human',
    label: 'Talk to a real person',
    shortLabel: 'Talk to a human',
    triggerText: 'I want to talk to a real person'
  }
];

function BotAvatar() {
  return (
    <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-navy-900">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 32% 26%, rgba(236,87,19,0.5), transparent 60%)' }}
      />
      <MessageCircle className="relative h-3.5 w-3.5 text-white" strokeWidth={2.25} />
    </span>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <BotAvatar />
      <div className="border-ink-100 flex items-center gap-1 rounded-2xl rounded-bl-md border bg-white px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="bg-ink-300 h-1.5 w-1.5 rounded-full"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="border-ink-200 text-ink-800 flex min-h-11 items-center justify-center rounded-xl border bg-white px-2 py-2 text-center text-xs leading-tight font-medium transition-colors hover:border-orange-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function buildLeadPayload(lead: LeadState, ctx: ChatContext, transcript: TranscriptLine[]) {
  const urgent = Boolean(lead.wizardUrgent || ctx.urgent);
  const topics = ctx.topicsDiscussed.map(topicLabel).join(', ') || 'General chat';
  return {
    source: 'chatbot' as const,
    name: lead.name ?? '',
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    service: lead.wizardService ?? '',
    city: lead.wizardCity ?? '',
    propertyType: lead.wizardPropertyType ?? '',
    message: lead.wizardIssue ?? '',
    urgent,
    topicsDiscussed: topics,
    transcript: transcript.map((line) => `${line.from === 'bot' ? 'Bot' : 'Visitor'}: ${line.text}`).join('\n'),
    // Honeypot field — always empty for a real human using the chat UI.
    company: ''
  };
}

function buildLeadMailto(lead: LeadState, ctx: ChatContext, transcript: TranscriptLine[]): string {
  const urgent = lead.wizardUrgent || ctx.urgent;
  const subject = lead.wizard
    ? `Estimate request: ${lead.wizardService ?? 'Service'} (${lead.name})${urgent ? ' - URGENT' : ''}`
    : `Chatbot lead: ${lead.name} (${business.name} site)`;
  const topics = ctx.topicsDiscussed.map(topicLabel).join(', ') || 'General chat';
  const body = [
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    lead.email ? `Email: ${lead.email}` : null,
    lead.wizard ? `Service needed: ${lead.wizardService}` : null,
    lead.wizard ? `City: ${lead.wizardCity}` : null,
    lead.wizard ? `Property type: ${lead.wizardPropertyType}` : null,
    lead.wizard && lead.wizardIssue ? `Issue details: ${lead.wizardIssue}` : null,
    `Urgent: ${urgent ? 'Yes' : 'No'}`,
    `Topics discussed: ${topics}`,
    '',
    'Conversation:',
    ...transcript.map((line) => `${line.from === 'bot' ? 'Bot' : 'Visitor'}: ${line.text}`)
  ]
    .filter((line) => line !== null)
    .join('\n');
  return `mailto:${business.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Astro islands with client:load hydrate in the browser, so this module-level
// read happens once, after mount, never during SSR.
const initialPageTopic: string | null =
  typeof window === 'undefined' ? null : getPageContextTopic(window.location.pathname);

export default function ChatWidget() {
  const [pageTopic] = useState<string | null>(initialPageTopic);
  const quickActions = useMemo(() => buildQuickActions(pageTopic), [pageTopic]);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId(), from: 'bot', content: buildGreeting(initialPageTopic) }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [unread, setUnread] = useState(0);
  const [ctx, setCtx] = useState<ChatContext>(initialChatContext);
  const [lead, setLead] = useState<LeadState>({ step: 'idle' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<TranscriptLine[]>([{ from: 'bot', text: 'Greeted the visitor' }]);
  const leadRef = useRef<LeadState>(lead);
  const ctxRef = useRef<ChatContext>(ctx);

  useEffect(() => {
    leadRef.current = lead;
  }, [lead]);
  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  useEffect(() => {
    if (sessionStorage.getItem(TEASER_SEEN_KEY)) return;
    const t = setTimeout(() => {
      setTeaser(true);
      sessionStorage.setItem(TEASER_SEEN_KEY, '1');
    }, 4500);
    return () => clearTimeout(t);
  }, []);

  // `open` belongs in here: the transcript survives a close, so reopening a
  // conversation with no new message left the scroller parked at the top and
  // the newest reply cut off mid-sentence. Jump (not smooth) on reopen, since
  // there is no motion for the reader to follow from a freshly mounted panel.
  useEffect(() => {
    if (!open) return;
    // The panel mounts through AnimatePresence, so scrollRef is still null on
    // this tick. A timer rather than requestAnimationFrame: rAF is throttled
    // to zero in a backgrounded tab, and this has to land whether or not the
    // browser is painting frames. Instant, not smooth - there is no motion
    // for the reader to follow out of a panel that just appeared.
    const t = window.setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const launcher = (e.target as HTMLElement).closest('[aria-label="Open chat"], [aria-label="Close chat"]');
        if (!launcher) setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  function pushUserMessage(text: string) {
    setMessages((m) => [...m, { id: nextId(), from: 'user', content: text }]);
    transcriptRef.current.push({ from: 'user', text });
  }

  function pushBotReply(content: React.ReactNode, logLabel: string, onDone?: () => void) {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: nextId(), from: 'bot', content }]);
      transcriptRef.current.push({ from: 'bot', text: logLabel });
      if (!open) setUnread((u) => u + 1);
      onDone?.();
    }, 700);
  }

  function offerLeadCapture() {
    setCtx((c) => ({ ...c, leadOffered: true }));
    setLead({ step: 'offer' });
    pushBotReply(
      <>Want me to have a technician follow up? I just need a name and phone number, no obligation.</>,
      'Offered to collect contact info'
    );
  }

  function startLeadCapture(prefill: { phone?: string; email?: string }, autoDetected: boolean) {
    setCtx((c) => ({ ...c, leadOffered: true }));
    setLead({ step: 'name', phone: prefill.phone, email: prefill.email });
    pushBotReply(
      autoDetected ? (
        <>Thanks, I&rsquo;ve got that. What name should I put with it?</>
      ) : (
        <>Great, what&rsquo;s your name?</>
      ),
      'Detected contact info and started lead capture'
    );
  }

  function startWizard() {
    setCtx((c) => ({ ...c, leadOffered: true }));
    setLead({ step: 'wizard-service', wizard: true });
    pushBotReply(
      <>Happy to help you get an estimate. What do you need help with?</>,
      'Started the estimate wizard: asked for service type'
    );
  }

  function confirmReply(l: LeadState): React.ReactNode {
    return (
      <>
        <p>Here&rsquo;s what I&rsquo;ve got:</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          {l.wizard && <li>Service: {l.wizardService}</li>}
          {l.wizard && <li>Urgency: {l.wizardUrgent ? 'Emergency' : 'Not an emergency'}</li>}
          {l.wizard && <li>City: {l.wizardCity}</li>}
          {l.wizard && <li>Property: {l.wizardPropertyType}</li>}
          {l.wizard && l.wizardIssue && <li>Details: {l.wizardIssue}</li>}
          <li>Name: {l.name}</li>
          <li>Phone: {l.phone}</li>
          {l.email && <li>Email: {l.email}</li>}
        </ul>
        <p className="mt-2">
          {l.wizard
            ? 'Perfect! We’ve got everything our team needs. Want me to send this over now?'
            : 'Want me to send this to the team?'}
        </p>
      </>
    );
  }

  async function submitLeadFromChat() {
    setLead((prev) => ({ ...prev, step: 'sending' }));
    const payload = buildLeadPayload(leadRef.current, ctxRef.current, transcriptRef.current);
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Request failed');
      setLead((prev) => ({ ...prev, step: 'done' }));
      setCtx((c) => ({ ...c, leadSubmitted: true }));
      pushBotReply(
        <>
          <p className="flex items-center gap-1.5 font-semibold text-orange-600">
            <CircleCheck className="h-4 w-4" /> Got it, thanks!
          </p>
          <p className="text-ink-500 mt-1">
            Our team will reach out shortly. For anything urgent, call {business.hotline.display}.
          </p>
        </>,
        'Lead submitted successfully to the office'
      );
    } catch {
      // Fall back to a mailto: hand-off so the lead is never silently lost
      // if the API route is unreachable.
      window.location.href = buildLeadMailto(leadRef.current, ctxRef.current, transcriptRef.current);
      setLead((prev) => ({ ...prev, step: 'done' }));
      setCtx((c) => ({ ...c, leadSubmitted: true }));
      pushBotReply(
        <>
          <p className="flex items-center gap-1.5 font-semibold text-orange-600">
            <AlertTriangle className="h-4 w-4" /> Your email app should be opening now.
          </p>
          <p className="text-ink-500 mt-1">
            Hit send there to reach our office. For anything urgent, call {business.hotline.display}.
          </p>
        </>,
        'Lead API unreachable, handed off to visitor email client'
      );
    }
  }

  function handleLeadStep(text: string) {
    const t = text.trim();
    const step = leadRef.current.step;

    if (step === 'offer') {
      if (/^(yes|yep|yeah|sure|let'?s do it|ok|okay|sounds good)/i.test(t)) {
        setLead({ step: 'name' });
        pushBotReply(<>Great, what&rsquo;s your name?</>, 'Asked for name');
      } else if (/^(no|nope|not now|no thanks|not really)/i.test(t)) {
        setCtx((c) => ({ ...c, leadDeclined: true }));
        setLead({ step: 'idle' });
        pushBotReply(
          <>No problem, happy to keep answering questions. Call {business.hotline.display} any time.</>,
          'Declined lead capture'
        );
      } else {
        pushBotReply(<>Just a yes or no works, want me to grab your info?</>, 'Reprompted for offer response');
      }
      return;
    }

    if (step === 'wizard-service') {
      const matchedService = services.find((s) => s.title.toLowerCase() === t.toLowerCase());
      const label = matchedService?.title ?? t;
      if (t.length < 2) {
        pushBotReply(
          <>What kind of issue is it, drain, water heater, cooling, electrical, or something else?</>,
          'Reprompted for service type'
        );
        return;
      }
      const urgentWords = /emergency|urgent|burst|flood|no water|no heat|leak|leaking|asap|spark/i.test(t);
      setLead((prev) => ({ ...prev, wizardService: label, step: 'wizard-urgency' }));
      pushBotReply(
        <>Got it, {label.toLowerCase()}. Is this an emergency, or can it wait for regular scheduling?</>,
        `Wizard: service = ${label}`,
        () => {
          if (urgentWords) setCtx((c) => ({ ...c, urgent: true }));
        }
      );
      return;
    }

    if (step === 'wizard-urgency') {
      const isUrgent = /^(yes|yep|yeah|emergency|urgent|asap|right now)/i.test(t);
      const isNotUrgent = /^(no|nope|not|can wait|whenever|regular|schedule)/i.test(t);
      if (!isUrgent && !isNotUrgent) {
        pushBotReply(<>Just need to know, is it an emergency (yes) or can it wait (no)?</>, 'Reprompted for urgency');
        return;
      }
      setLead((prev) => ({ ...prev, wizardUrgent: isUrgent, step: 'wizard-city' }));
      if (isUrgent) setCtx((c) => ({ ...c, urgent: true }));
      pushBotReply(
        isUrgent ? (
          <>
            Got it, we&rsquo;ll flag this as urgent. For fastest help right now you can also call{' '}
            {business.hotline.display} directly. Which city are you in?
          </>
        ) : (
          <>No rush, good to know. Which city are you in?</>
        ),
        `Wizard: urgency = ${isUrgent ? 'emergency' : 'not urgent'}`
      );
      return;
    }

    if (step === 'wizard-city') {
      if (t.length < 2) {
        pushBotReply(<>Which city should I put down?</>, 'Reprompted for city');
        return;
      }
      setLead((prev) => ({ ...prev, wizardCity: t, step: 'wizard-type' }));
      pushBotReply(<>Thanks. Is this for a home (residential) or a business (commercial)?</>, `Wizard: city = ${t}`);
      return;
    }

    if (step === 'wizard-type') {
      const isCommercial = /^comm/i.test(t);
      const isResidential = /^resi|^home|^house/i.test(t);
      if (!isCommercial && !isResidential) {
        pushBotReply(<>Residential or commercial?</>, 'Reprompted for property type');
        return;
      }
      const propertyType: PropertyType = isCommercial ? 'Commercial' : 'Residential';
      setLead((prev) => ({ ...prev, wizardPropertyType: propertyType, step: 'wizard-issue' }));
      pushBotReply(
        <>
          Last thing before I grab your contact info, anything else about the issue our team should know? (Or type
          &ldquo;skip&rdquo;.)
        </>,
        `Wizard: property type = ${propertyType}`
      );
      return;
    }

    if (step === 'wizard-issue') {
      const issue = /^skip$/i.test(t) ? undefined : t;
      setLead((prev) => ({ ...prev, wizardIssue: issue, step: 'name' }));
      pushBotReply(<>Great, what&rsquo;s your name?</>, 'Wizard: collected issue details, asked for name');
      return;
    }

    if (step === 'name') {
      if (!isValidName(t)) {
        pushBotReply(<>I didn&rsquo;t quite catch a name there, mind typing it again?</>, 'Asked again for name');
        return;
      }
      const firstName = t.split(' ')[0];
      if (leadRef.current.phone) {
        setLead((prev) => ({ ...prev, name: t, step: 'confirm' }));
        pushBotReply(confirmReply({ ...leadRef.current, name: t }), 'Recapped lead details for confirmation');
      } else {
        setLead((prev) => ({ ...prev, name: t, step: 'phone' }));
        pushBotReply(<>Thanks, {firstName}. What&rsquo;s the best phone number to reach you?</>, 'Asked for phone');
      }
      return;
    }

    if (step === 'phone') {
      if (!isValidPhone(t)) {
        pushBotReply(
          <>That doesn&rsquo;t look like a full phone number, mind trying again?</>,
          'Asked again for phone'
        );
        return;
      }
      if (leadRef.current.email) {
        setLead((prev) => ({ ...prev, phone: t, step: 'confirm' }));
        pushBotReply(confirmReply({ ...leadRef.current, phone: t }), 'Recapped lead details for confirmation');
      } else {
        setLead((prev) => ({ ...prev, phone: t, step: 'email' }));
        pushBotReply(<>Got it. Email too? Optional, type &ldquo;skip&rdquo; to move on.</>, 'Asked for email');
      }
      return;
    }

    if (step === 'email') {
      if (/^skip$/i.test(t)) {
        setLead((prev) => ({ ...prev, step: 'confirm' }));
        pushBotReply(confirmReply(leadRef.current), 'Recapped lead details for confirmation');
        return;
      }
      if (!isValidEmail(t)) {
        pushBotReply(
          <>That email doesn&rsquo;t look quite right, try again or type &ldquo;skip&rdquo;.</>,
          'Asked again for email'
        );
        return;
      }
      setLead((prev) => ({ ...prev, email: t, step: 'confirm' }));
      pushBotReply(confirmReply({ ...leadRef.current, email: t }), 'Recapped lead details for confirmation');
      return;
    }

    if (step === 'confirm') {
      if (/^(yes|yep|yeah|send|confirm|correct|sure)/i.test(t)) {
        submitLeadFromChat();
      } else if (/^(no|nope|start over|redo|restart)/i.test(t)) {
        setLead({ step: 'name' });
        pushBotReply(<>No problem, let&rsquo;s start over. What&rsquo;s your name?</>, 'Restarted lead capture');
      } else {
        pushBotReply(
          <>Just need a yes to send this along, or say &ldquo;start over&rdquo;.</>,
          'Reprompted for confirmation'
        );
      }
    }
  }

  function cancelLeadCapture() {
    pushUserMessage('Cancel');
    setCtx((c) => ({ ...c, leadDeclined: true }));
    setLead({ step: 'idle' });
    pushBotReply(<>No worries, cancelled. What else can I help with?</>, 'Cancelled lead capture');
  }

  function handleUserInput(displayText: string, matchText: string = displayText) {
    pushUserMessage(displayText);

    const step = leadRef.current.step;
    if (step !== 'idle' && step !== 'done') {
      handleLeadStep(matchText);
      return;
    }

    const detected = detectContactInfo(matchText);
    if ((detected.phone || detected.email) && !ctx.leadOffered && !ctx.leadDeclined && !ctx.leadSubmitted) {
      startLeadCapture(detected, true);
      return;
    }

    const result = getSmartReply(matchText, ctx, pageTopic);
    setCtx(result.nextContext);
    pushBotReply(result.content, result.logLabel, () => {
      if (result.startWizard) setTimeout(startWizard, 500);
      else if (result.offerLeadCapture) setTimeout(offerLeadCapture, 500);
    });
  }

  function handleQuickAction(qa: QuickAction) {
    if (qa.key === 'coupons') window.dispatchEvent(new CustomEvent('open-coupon-widget'));
    if (qa.key === 'estimate-wizard' || qa.key === 'page-service-estimate') {
      pushUserMessage(qa.label);
      startWizard();
      return;
    }
    handleUserInput(qa.label, qa.triggerText);
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    handleUserInput(text);
  }

  const capturing = lead.step !== 'idle' && lead.step !== 'done';
  const placeholder =
    lead.step === 'name'
      ? 'Your name…'
      : lead.step === 'phone'
        ? 'Your phone number…'
        : lead.step === 'email'
          ? 'Your email (or type skip)…'
          : lead.step === 'offer' ||
              lead.step === 'confirm' ||
              lead.step === 'wizard-urgency' ||
              lead.step === 'wizard-type'
            ? 'Yes or no…'
            : lead.step === 'wizard-service'
              ? 'e.g. drain cleaning…'
              : lead.step === 'wizard-city'
                ? 'Your city…'
                : lead.step === 'wizard-issue'
                  ? 'Optional details, or type skip…'
                  : 'Type a question…';

  return (
    <div className={`fixed right-4 bottom-24 lg:right-6 lg:bottom-6 ${open ? 'z-[60]' : 'z-40'}`}>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="border-ink-100 mb-4 flex h-[min(600px,72vh)] w-[92vw] max-w-[400px] flex-col overflow-hidden rounded-[1.75rem] border bg-white shadow-2xl shadow-black/15"
            role="dialog"
            aria-modal="true"
            aria-label={`Chat with ${business.name}`}
          >
            <div className="relative shrink-0 overflow-hidden bg-navy-900 p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(circle at 18% 0%, rgba(236,87,19,0.35), transparent 60%)' }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/20 bg-white">
                    <MessageCircle className="h-5 w-5 text-orange-600" strokeWidth={2.25} />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      {business.shortName}
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                        <Sparkles className="h-2.5 w-2.5" /> Smart assistant
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-white/70">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                      Usually replies in minutes
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close chat"
                  onClick={() => setOpen(false)}
                  className="grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mt-4 flex flex-wrap gap-2">
                <a
                  href={`tel:${business.hotline.tel}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  <Phone className="h-3 w-3" /> Call
                </a>
                <a
                  href={`mailto:${business.email}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  <Mail className="h-3 w-3" /> Email
                </a>
              </div>
            </div>

            <div ref={scrollRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-end gap-2 ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.from === 'bot' && <BotAvatar />}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.from === 'user'
                        ? 'rounded-br-md bg-orange-600 text-white'
                        : 'border-ink-100 text-ink-700 rounded-bl-md border bg-white'
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {typing && <TypingIndicator />}
            </div>

            <div className="border-ink-100 bg-ink-50/60 shrink-0 border-t px-3 py-2.5">
              {lead.step === 'offer' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <ActionButton label="Yes, let's do it" onClick={() => handleUserInput("Yes, let's do it")} />
                  <ActionButton label="No thanks" onClick={() => handleUserInput('No thanks')} />
                </div>
              ) : lead.step === 'wizard-service' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {services.slice(0, 8).map((s) => (
                    <ActionButton key={s.slug} label={s.title} onClick={() => handleUserInput(s.title)} />
                  ))}
                  <ActionButton label="Something else" onClick={() => handleUserInput('Something else')} />
                  <ActionButton label="Cancel" onClick={cancelLeadCapture} />
                </div>
              ) : lead.step === 'wizard-urgency' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <ActionButton label="Yes, emergency" onClick={() => handleUserInput('Yes, emergency')} />
                  <ActionButton label="No, can wait" onClick={() => handleUserInput('No, can wait')} />
                </div>
              ) : lead.step === 'wizard-type' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <ActionButton label="Residential" onClick={() => handleUserInput('Residential')} />
                  <ActionButton label="Commercial" onClick={() => handleUserInput('Commercial')} />
                </div>
              ) : lead.step === 'wizard-issue' ? (
                <ActionButton label="Skip this" onClick={() => handleUserInput('skip')} />
              ) : lead.step === 'confirm' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <ActionButton label="Yes, send it" onClick={() => handleUserInput('Yes, send it')} />
                  <ActionButton label="Start over" onClick={() => handleUserInput('Start over')} />
                </div>
              ) : lead.step === 'sending' ? (
                <p className="text-ink-400 py-1.5 text-center text-xs">Sending…</p>
              ) : lead.step === 'name' ||
                lead.step === 'phone' ||
                lead.step === 'email' ||
                lead.step === 'wizard-city' ? (
                <ActionButton label="Cancel" onClick={cancelLeadCapture} />
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {quickActions.map((qa) => (
                    <ActionButton key={qa.key} label={qa.shortLabel} onClick={() => handleQuickAction(qa)} />
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="border-ink-100 flex shrink-0 items-center gap-2 border-t p-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder={placeholder}
                className="border-ink-200 text-ink-900 placeholder:text-ink-400 flex-1 rounded-full border bg-white px-4 py-2.5 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={!input.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange-600 text-white transition-transform active:scale-95 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="text-ink-400 shrink-0 px-4 pb-3 text-center text-[11px]">
              {capturing
                ? 'Your info goes straight to our team.'
                : `Automated assistant. For anything urgent, call ${business.hotline.display}.`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-end gap-3">
        <AnimatePresence>
          {teaser && !open && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="border-ink-100 flex max-w-[220px] items-start gap-2 rounded-2xl rounded-br-md border bg-white p-3.5 pr-2.5 shadow-xl shadow-black/10"
            >
              <p className="text-ink-700 flex-1 text-sm leading-snug">
                Got a plumbing, HVAC, or electrical question? I can help, or connect you to a real person.
              </p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setTeaser(false)}
                className="text-ink-400 hover:bg-ink-100 hover:text-ink-700 grid h-5 w-5 shrink-0 place-items-center rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!open && (
            <motion.button
              type="button"
              onClick={() => {
                setOpen(true);
                setTeaser(false);
                setUnread(0);
              }}
              aria-label="Open chat"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.2, ease: EASE }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              className="group relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-navy-900 text-white shadow-[0_0_0_3px_var(--color-orange-400),var(--shadow-card-hover)] lg:h-16 lg:w-16"
            >
              <span
                aria-hidden
                className="animate-pulse-ring absolute inset-0 rounded-full border-2"
                style={{ borderColor: 'color-mix(in oklab, var(--color-orange-500) 55%, transparent)' }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(circle at 32% 26%, rgba(236,87,19,0.35), transparent 60%)' }}
              />
              <MessageCircle className="relative h-6 w-6 lg:h-7 lg:w-7" strokeWidth={2.25} />
              {unread > 0 && (
                <span className="border-ink-50 absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 bg-orange-600 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
