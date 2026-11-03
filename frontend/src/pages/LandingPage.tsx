import { MotionConfig, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router';
import { pingHealth } from '../api/health.ts';
import type { Role } from '../api/types.ts';
import { useAuth } from '../auth/useAuth.ts';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardIcon,
  SlidersIcon,
} from '../components/icons.tsx';
import { BookingPreview } from '../components/landing/BookingPreview.tsx';
import { DayStory } from '../components/landing/DayStory.tsx';
import { HeroLedger } from '../components/landing/HeroLedger.tsx';
import { Reveal } from '../components/landing/Reveal.tsx';
import { TrustBoard } from '../components/landing/TrustBoard.tsx';
import { WAKING_MESSAGE } from '../components/LoadingScreen.tsx';
import { PublicHeader } from '../components/PublicHeader.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { useDemoLogin } from '../hooks/useDemoLogin.ts';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts.ts';

export const LANDING_TITLE = 'Slotwise';

const ROLES = [
  {
    icon: CalendarIcon,
    title: 'For clients',
    text: 'Browse services with prices and how long they take, pick a time that’s really free, and move or cancel it online up to a day before.',
  },
  {
    icon: ClipboardIcon,
    title: 'For staff',
    text: 'See the day by date and status, book a walk-in for a client, and mark each visit done or no-show as it happens.',
  },
  {
    icon: SlidersIcon,
    title: 'For owners',
    text: 'Add, price and pause services, set opening hours for each day, split them around lunch, and close for holidays or training.',
  },
];

const PROMISES = [
  'Two clients can never book the same time, even if they tap at the same moment.',
  'Change your hours without fear: Slotwise won’t strand anyone already booked.',
  'No ads and no tracking. Clients can delete their account whenever they like.',
  'Free and open source, from the booking page to the database.',
];

const FAQS = [
  {
    q: 'Is Slotwise really free?',
    a: 'Yes. No subscription, no per-booking fee and no ads. It’s open source, so you can also run your own copy.',
  },
  {
    q: 'How do you stop double bookings on a busy Saturday?',
    a: 'Every booking is checked the instant it’s made. If two people go for the same time together, the first one gets it and the second is asked to pick another slot.',
  },
  {
    q: 'What if I change my opening hours or prices?',
    a: 'Change them whenever you like. If a change would clash with someone already booked, Slotwise holds it back until that booking is moved, so nobody turns up to a closed door.',
  },
  {
    q: 'How do clients cancel or move a booking?',
    a: 'From their own account, online, up to 24 hours before. After that they contact the shop, and your team can still change anything.',
  },
  {
    q: 'Can my team book walk-ins?',
    a: 'Yes. Staff pick any free time and book it for the client, then mark the visit completed or no-show when it’s over.',
  },
  {
    q: 'Can clients remove their personal data?',
    a: 'Yes. They delete their account from the account page, and their name, email and booking notes are erased right away.',
  },
  {
    q: 'Is the demo a real shop?',
    a: 'No. The Jakarta barbershop and its clients are made up, so book, cancel and change whatever you like. The demo resets regularly.',
  },
];

const DEMO_LABELS: Record<Role, string> = {
  customer: 'Explore as a client',
  staff: 'Explore as staff',
  admin: 'Explore as the owner',
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function LandingPage() {
  const auth = useAuth();
  const { hash } = useLocation();
  const demo = useDemoLogin();
  const still = useReducedMotion() ?? false;
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const photoY = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [0, 90]);

  useEffect(() => {
    document.title = LANDING_TITLE;
    // Free-tier hosting sleeps when idle: start waking the API while the visitor reads.
    pingHealth();
  }, []);

  useEffect(() => {
    if (hash !== '') {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, [hash]);

  if (auth.status === 'authenticated') {
    return <Navigate to={demo.target ?? '/services'} replace />;
  }

  const client = DEMO_ACCOUNTS[0];
  const pendingRole = demo.state.kind === 'pending' ? demo.state.role : null;
  const fromPreview = demo.state.kind !== 'idle' && demo.state.source === 'preview';

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing">
        <PublicHeader onLanding />
        <main id="main-content">
          <section ref={heroRef} className="hero" aria-labelledby="hero-title">
            <div className="hero__copy">
              <motion.h1
                id="hero-title"
                initial={still ? false : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: EASE }}
              >
                Fully booked.
                <br />
                <em>Never</em> double‑booked.
              </motion.h1>
              <motion.div
                initial={still ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.12, ease: EASE }}
              >
                <p className="hero__lead">
                  Online booking for barbershops, salons, nail studios, spas and skin clinics.
                  Clients book in a few taps; your team gets one calm, clear day.
                </p>
                <div className="hero__actions">
                  <a href="#demo" className="btn btn--primary btn--lg">
                    Try the live demo
                    <ArrowRightIcon className="icon" />
                  </a>
                  <a href="#day" className="btn btn--ghost btn--lg">
                    See how it works
                  </a>
                </div>
                <p className="hero__note">
                  No sign-up. Explore as a client, staff member or owner.
                </p>
              </motion.div>
            </div>
            <div className="hero__visual">
              <motion.img
                className="hero__photo"
                src="/images/hero-barber.webp"
                alt="A smiling barber at his shop counter while a client pays by phone"
                width={1400}
                height={1050}
                fetchPriority="high"
                style={{ y: photoY }}
                initial={still ? false : { opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.1, ease: EASE }}
              />
              <HeroLedger />
            </div>
          </section>

          <section className="band" aria-labelledby="band-title">
            <Reveal className="band__copy">
              <h2 id="band-title">Booking that takes a minute, not a phone call.</h2>
              <p>
                Clients see every service with its price and length, pick a time that’s actually
                free, and they’re done. Plans change? They move or cancel online, up to 24 hours
                before.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <BookingPreview
                pending={fromPreview && pendingRole === 'customer'}
                onBook={() => {
                  void demo.start(client, 'preview');
                }}
              />
              {fromPreview && pendingRole !== null && demo.slow && (
                <p role="status" className="loading-hint">
                  {WAKING_MESSAGE}
                </p>
              )}
              {fromPreview && demo.state.kind === 'error' && (
                <p role="alert" className="alert alert--error band__error">
                  {demo.state.message}
                </p>
              )}
            </Reveal>
          </section>

          <section id="product" className="section" aria-labelledby="roles-title">
            <h2 id="roles-title" className="section__title">
              One book, read three ways.
            </h2>
            <ul className="roles">
              {ROLES.map(({ icon: Icon, title, text }, index) => (
                <motion.li
                  key={title}
                  initial={still ? false : { opacity: 0.35, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.7, delay: index * 0.12, ease: EASE }}
                >
                  <span className="roles__icon">
                    <Icon className="icon" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </motion.li>
              ))}
            </ul>
          </section>

          <section id="day" className="section section--story" aria-labelledby="day-title">
            <h2 id="day-title" className="section__title">
              A day at the shop, on Slotwise.
            </h2>
            <DayStory />
          </section>

          <section className="section trust" aria-labelledby="trust-title">
            <Reveal className="trust__copy">
              <h2 id="trust-title">Built on trust. Kept simple.</h2>
              <ul className="ticks">
                {PROMISES.map((promise) => (
                  <li key={promise}>
                    <CheckIcon className="icon" />
                    {promise}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.1}>
              <TrustBoard />
            </Reveal>
          </section>

          <section id="demo" className="demo" aria-labelledby="demo-title">
            <img
              className="demo__photo"
              src="/images/team.webp"
              alt="A shop team laughing together around a table"
              width={1024}
              height={559}
              loading="lazy"
              decoding="async"
            />
            <div className="demo__copy">
              <h2 id="demo-title">See it in action, right now.</h2>
              <p>
                Walk through a fictional Jakarta barbershop as a client, a member of staff or the
                owner. No sign-up, and the data resets regularly, so change whatever you like.
              </p>
              <ul className="demo__actions">
                {DEMO_ACCOUNTS.map((account) => {
                  const pending = !fromPreview && pendingRole === account.role;
                  const error =
                    !fromPreview && demo.state.kind === 'error' && demo.state.role === account.role
                      ? demo.state.message
                      : null;
                  return (
                    <li key={account.role}>
                      <button
                        type="button"
                        className="btn btn--lg demo__btn"
                        disabled={demo.state.kind === 'pending'}
                        onClick={() => {
                          void demo.start(account);
                        }}
                      >
                        {pending ? 'Signing in...' : DEMO_LABELS[account.role]}
                        {!pending && <ArrowRightIcon className="icon" />}
                      </button>
                      {pending && demo.slow && (
                        <p role="status" className="demo__hint">
                          {WAKING_MESSAGE}
                        </p>
                      )}
                      {error !== null && (
                        <p role="alert" className="demo__error">
                          {error}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <details className="demo__creds">
                <summary>Prefer to type the logins?</summary>
                <dl>
                  {DEMO_ACCOUNTS.map((account) => (
                    <div key={account.role}>
                      <dt>{account.label}</dt>
                      <dd>
                        <span>{account.email}</span>
                        <span>{account.password}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
          </section>

          <section id="faq" className="section faq" aria-labelledby="faq-title">
            <h2 id="faq-title" className="section__title">
              Questions, answered.
            </h2>
            <div className="faq__list">
              {FAQS.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
