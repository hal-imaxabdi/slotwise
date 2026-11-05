import { MotionConfig, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { pingHealth } from '../api/health.ts';
import type { Role } from '../api/types.ts';
import { useAuth } from '../auth/useAuth.ts';
import { ArrowRightIcon } from '../components/icons.tsx';
import { BookingPreview } from '../components/landing/BookingPreview.tsx';
import { HeroStage } from '../components/landing/HeroStage.tsx';
import { StaffPreview } from '../components/landing/StaffPreview.tsx';
import { WAKING_MESSAGE } from '../components/LoadingScreen.tsx';
import { PublicHeader } from '../components/PublicHeader.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { useDemoLogin } from '../hooks/useDemoLogin.ts';
import { DEMO_ACCOUNTS } from '../lib/demoAccounts.ts';

export const LANDING_TITLE = 'Slotwise';

const EASE = [0.16, 1, 0.3, 1] as const;

const DEMO_LABELS: Record<Role, string> = {
  customer: 'Explore as a client',
  staff: 'Explore as staff',
  admin: 'Explore as the owner',
};

const DEMO_ROLES: Record<Role, { title: string; text: string }> = {
  customer: {
    title: 'Client',
    text: 'Browse services and prices, book a real free time, then move or cancel it.',
  },
  staff: {
    title: 'Staff',
    text: 'Work the day-book: walk-ins, done and no-show, closures for training.',
  },
  admin: {
    title: 'Owner',
    text: 'Price and pause services, set the week’s hours, close for a holiday.',
  },
};

/** Section heading with a strip of scarlet tape pulled across under it, once. The text is
    always visible; only the tape moves. */
function Wipe({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const still = useReducedMotion() ?? false;
  return (
    <h2 id={id} className={`taped ${className ?? ''}`}>
      <motion.span
        className="taped__tape"
        aria-hidden="true"
        initial={still ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      {children}
    </h2>
  );
}

export function LandingPage() {
  const auth = useAuth();
  const { hash } = useLocation();
  const demo = useDemoLogin();
  const still = useReducedMotion() ?? false;

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
  const slam = (index: number) =>
    still
      ? { initial: false as const }
      : {
          initial: { opacity: 0, x: -80 },
          animate: { opacity: 1, x: 0 },
          transition: { duration: 0.65, delay: 0.1 + index * 0.14, ease: EASE },
        };

  // Rows rise and straighten as they enter; they stay readable at every frame.
  const rise = still
    ? {}
    : {
        initial: { y: 56, rotate: -0.8 },
        whileInView: { y: 0, rotate: 0 },
        viewport: { once: true, amount: 0.25 },
        transition: { duration: 0.8, ease: EASE },
      };

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing">
        <PublicHeader onLanding />
        <main id="main-content">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero__inner">
              <div className="hero__copy">
                <h1 id="hero-title" className="hero__title">
                  <span className="visually-hidden">Fully booked. Never double-booked.</span>
                  <motion.span className="hero__line" aria-hidden="true" {...slam(0)}>
                    Fully booked.
                  </motion.span>
                  <motion.span className="hero__line hero__line--strip" aria-hidden="true" {...slam(1)}>
                    <span>Never <span className="nowrap">double-booked.</span></span>
                  </motion.span>
                </h1>
                <motion.p className="hero__lead" {...slam(2)}>
                  Online booking for barbershops, salons and studios. Clients book a time that’s
                  really free from their phone, your team works from one shared day, and no two
                  clients are ever given the same slot.
                </motion.p>
              </div>
              <HeroStage />
            </div>
          </section>

          <section id="features" className="features" aria-labelledby="features-title">
            <div className="features__head">
              <Wipe id="features-title" className="section-heading">
                What Slotwise does.
              </Wipe>
              <p className="section-lead">
                One shop, one book, three ways in. Here is each of them, as it looks in the app.
              </p>
            </div>

            <motion.article className="feature" {...rise}>
              <div className="feature__copy">
                <h3 className="feature__title">Clients book themselves.</h3>
                <p>
                  Every service shows its price and how long it takes. Only genuinely free times
                  are offered, grouped by morning, afternoon and evening. Plans change? Clients move
                  or cancel online, up to 24 hours before.
                </p>
              </div>
              <div className="feature__media">
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
                  <p role="alert" className="alert alert--error">
                    {demo.state.message}
                  </p>
                )}
              </div>
            </motion.article>

            <motion.article className="feature feature--flip" {...rise}>
              <div className="feature__copy">
                <h3 className="feature__title">The counter sees the whole day.</h3>
                <p>
                  Staff get the day-book in time order, filtered by date and status. Someone walks
                  in? Book them on the spot. Mark each visit done or no-show as it happens, and
                  block out time for training.
                </p>
              </div>
              <div className="feature__media">
                <StaffPreview />
              </div>
            </motion.article>

            <motion.article className="feature" {...rise}>
              <div className="feature__copy">
                <h3 className="feature__title">The owner runs the week.</h3>
                <p>
                  Add, price and pause services. Set opening hours for each day and split them
                  around lunch. Close for a holiday and those times disappear from booking, without
                  touching anything already booked.
                </p>
              </div>
              <div className="feature__media feature__media--photo">
                <img
                  src="/images/hero-salon.webp"
                  alt="A stylist laughing with her client in a bright salon"
                  width={2400}
                  height={1600}
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </motion.article>
          </section>

          <section id="demo" className="demo" aria-labelledby="demo-title">
            <div className="demo__inner">
              <div className="demo__head">
                <Wipe id="demo-title" className="section-heading">
                  Walk in. No sign-up.
                </Wipe>
                <p>
                  A fictional Jakarta barbershop with a full week of bookings. Pick a role and you’re
                  in. The data resets regularly.
                </p>
                <img
                  className="demo__photo"
                  src="/images/client-smiling.webp"
                  alt="A smiling client in the barber’s chair while his barber works"
                  width={1000}
                  height={667}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <ul className="demo__roles">
                {DEMO_ACCOUNTS.map((account, index) => {
                  const pending = !fromPreview && pendingRole === account.role;
                  const error =
                    !fromPreview && demo.state.kind === 'error' && demo.state.role === account.role
                      ? demo.state.message
                      : null;
                  const role = DEMO_ROLES[account.role];
                  return (
                    <motion.li
                      key={account.role}
                      className="demo__role"
                      initial={still ? false : { opacity: 0, y: 40, rotate: -3 }}
                      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 0.6, delay: index * 0.1, ease: EASE }}
                    >
                      <h3>{role.title}</h3>
                      <p>{role.text}</p>
                      <button
                        type="button"
                        className="demo__btn"
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
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
