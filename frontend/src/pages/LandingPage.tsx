import { MotionConfig, motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router';
import { pingHealth } from '../api/health.ts';
import type { Role } from '../api/types.ts';
import { useAuth } from '../auth/useAuth.ts';
import { ArrowRightIcon } from '../components/icons.tsx';
import { BookingPreview } from '../components/landing/BookingPreview.tsx';
import { DayStory } from '../components/landing/DayStory.tsx';
import { HeroLedger } from '../components/landing/HeroLedger.tsx';
import { Reveal } from '../components/landing/Reveal.tsx';
import { WAKING_MESSAGE } from '../components/LoadingScreen.tsx';
import { PublicHeader } from '../components/PublicHeader.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { useDemoLogin } from '../hooks/useDemoLogin.ts';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts.ts';

export const LANDING_TITLE = 'Slotwise';

const ROLES = [
  {
    title: 'For clients',
    text: 'Browse services with prices and how long they take, pick a time that’s really free, and move or cancel it online up to a day before.',
  },
  {
    title: 'For staff',
    text: 'See the day by date and status, book a walk-in for a client, and mark each visit done or no-show as it happens.',
  },
  {
    title: 'For owners',
    text: 'Add, price and pause services, set opening hours for each day, split them around lunch, and close for holidays or training.',
  },
];

const DEMO_LABELS: Record<Role, string> = {
  customer: 'Explore as a client',
  staff: 'Explore as staff',
  admin: 'Explore as the owner',
};

const EASE = [0.16, 1, 0.3, 1] as const;

const HEADLINE = ['Fully booked.', 'Never double-booked.'];

export function LandingPage() {
  const auth = useAuth();
  const { hash } = useLocation();
  const demo = useDemoLogin();
  const still = useReducedMotion() ?? false;
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const photoY = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [0, 120]);
  const cardY = useTransform(scrollYProgress, [0, 1], still ? [0, 0] : [0, -60]);
  const rolesRef = useRef<HTMLElement>(null);
  const { scrollYProgress: rolesProgress } = useScroll({
    target: rolesRef,
    offset: ['start end', 'end start'],
  });
  const rolesY = useTransform(rolesProgress, [0, 1], still ? [0, 0] : [-30, 30]);

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
          {/* Velora-inspired (Korsa, Dribbble): a full-bleed photo in a rounded frame, a centred
              light headline, and the day's book rising out of the bottom edge as a glass card. */}
          <section ref={heroRef} className="hero" aria-labelledby="hero-title">
            <div className="hero__frame">
              <motion.img
                className="hero__photo"
                src="/images/hero-interior.webp"
                alt="A modern salon with styling chairs and wash basins under warm lights"
                width={2400}
                height={1602}
                fetchPriority="high"
                style={{ y: photoY }}
                initial={still ? false : { scale: 1.14, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1.8, ease: EASE }}
              />
              <div className="hero__content">
                <h1 id="hero-title">
                  <span className="visually-hidden">{HEADLINE.join(' ')}</span>
                  {HEADLINE.map((line, lineIndex) => (
                    <span key={line} className="hero__line" aria-hidden="true">
                      {line.split(' ').map((word, wordIndex) => (
                        <motion.span
                          key={word}
                          className="hero__word"
                          initial={still ? false : { opacity: 0, y: '0.45em', filter: 'blur(10px)' }}
                          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                          transition={{
                            duration: 0.8,
                            delay: 0.25 + (lineIndex * 2 + wordIndex) * 0.12,
                            ease: EASE,
                          }}
                        >
                          {word}{' '}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </h1>
                <motion.p
                  className="hero__lead"
                  initial={still ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.85, ease: EASE }}
                >
                  Clients book in a few taps; your team gets one calm, clear day.
                </motion.p>
              </div>
              <motion.div className="hero__card" style={{ y: cardY }}>
                <motion.div
                  initial={still ? false : { opacity: 0, y: 80 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.1, delay: 0.9, ease: EASE }}
                >
                  <HeroLedger />
                </motion.div>
              </motion.div>
            </div>
          </section>

          <section className="about" aria-labelledby="band-title">
            <div className="about__side">
              <motion.img
                className="about__photo"
                src="/images/client-smiling.webp"
                alt="A smiling client in the barber’s chair while his barber works"
                width={1000}
                height={667}
                loading="lazy"
                decoding="async"
                initial={still ? false : { clipPath: 'inset(18% 18% 18% 18% round 20px)', scale: 1.12 }}
                whileInView={{ clipPath: 'inset(0% 0% 0% 0% round 20px)', scale: 1 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 1.1, ease: EASE }}
              />
            </div>
            <div className="about__main">
              <Reveal>
                <h2 id="band-title">Booking that takes a minute, not a phone call.</h2>
                <p className="about__lead">
                  Clients see every service with its price and length, pick a time that’s
                  actually free, and they’re done. Plans change? They move or cancel online, up to
                  24 hours before.
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
            </div>
          </section>

          <section id="product" className="section" aria-labelledby="roles-title">
            <div className="section__head">
              <div>
                <h2 id="roles-title" className="section__title">
                  One book, read three ways.
                </h2>
              </div>
            </div>
            <div className="roles-wrap">
              <figure ref={rolesRef} className="roles__figure">
                <motion.img
                  style={{ y: rolesY, scale: 1.08 }}
                  src="/images/hair-wash.webp"
                  alt="A stylist washing a client’s hair at the basin"
                  width={1200}
                  height={801}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="roles__stat">
                  <span>Booked online</span>
                  <strong className="num">24/7</strong>
                  <span>Moves and cancellations up to a day before</span>
                </figcaption>
              </figure>
              <ol className="roles">
                {ROLES.map(({ title, text }, index) => (
                  <motion.li
                    key={title}
                    initial={still ? false : { opacity: 0.35, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, delay: index * 0.08, ease: EASE }}
                  >
                    <span className="roles__num num" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </div>
          </section>

          <section id="day" className="section section--story" aria-labelledby="day-title">
            <div className="section__head">
              <div>
                <h2 id="day-title" className="section__title">
                  A day at the shop, on Slotwise.
                </h2>
              </div>
            </div>
            <DayStory />
          </section>

          <section id="demo" className="demo" aria-labelledby="demo-title">
            <motion.div
              className="demo__inner"
              initial={still ? false : { opacity: 0, scale: 0.96, y: 40 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.9, ease: EASE }}
            >
              <div className="demo__copy">
                <h2 id="demo-title">See it in action.</h2>
                <p>A fictional Jakarta barbershop. No sign-up needed.</p>
                <ul className="demo__actions">
                  {DEMO_ACCOUNTS.map((account) => {
                    const pending = !fromPreview && pendingRole === account.role;
                    const error =
                      !fromPreview &&
                      demo.state.kind === 'error' &&
                      demo.state.role === account.role
                        ? demo.state.message
                        : null;
                    return (
                      <motion.li
                        key={account.role}
                        initial={still ? false : { opacity: 0, x: -16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{
                          duration: 0.6,
                          delay: 0.25 + DEMO_ACCOUNTS.indexOf(account) * 0.1,
                          ease: EASE,
                        }}
                      >
                        <button
                          type="button"
                          className="demo__btn"
                          disabled={demo.state.kind === 'pending'}
                          onClick={() => {
                            void demo.start(account);
                          }}
                        >
                          <span className="demo__btn-label">
                            {pending ? 'Signing in...' : DEMO_LABELS[account.role]}
                          </span>
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
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
              <img
                className="demo__photo"
                src="/images/hero-salon.webp"
                alt="A stylist laughing with her client in a bright, plant-filled salon"
                width={2400}
                height={1600}
                loading="lazy"
                decoding="async"
              />
            </motion.div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
