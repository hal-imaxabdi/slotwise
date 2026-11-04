import { motion, useReducedMotion, type Variants } from 'motion/react';
import { HeroLedger } from './HeroLedger.tsx';

/*
 * Adapted from 21st.dev "Centered Hero with Image Fan" (felipemenezes098/hero-10):
 * three overlapping cards, the outer two tilted and sliding in from behind the middle one.
 * Rebuilt on our CSS tokens (no Tailwind, square corners, hairlines instead of shadows),
 * and the middle card is the product itself: today's appointment book.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

const SLOTS = [
  { rotate: -6, x: 48, y: 24 },
  { rotate: 0, x: 0, y: -8 },
  { rotate: 6, x: -48, y: 24 },
] as const;

type Slot = (typeof SLOTS)[number];

const fan: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: EASE, delay: 0.4, delayChildren: 0.5, staggerChildren: 0.1 },
  },
};

const card: Variants = {
  hidden: (slot: Slot) => ({ x: slot.x, rotate: slot.rotate, y: slot.y }),
  visible: (slot: Slot) => ({
    x: 0,
    rotate: slot.rotate,
    y: slot.y,
    transition: { duration: 0.5, ease: EASE },
  }),
};

export function HeroFan() {
  const still = useReducedMotion() ?? false;
  return (
    <motion.div
      className="fan"
      variants={fan}
      initial={still ? 'visible' : 'hidden'}
      animate="visible"
    >
      <motion.div className="fan__card fan__card--side" custom={SLOTS[0]} variants={card}>
        <img
          src="/images/hero-barber.webp"
          alt="A smiling barber at his shop counter while a client pays by phone"
          width={1400}
          height={1050}
          fetchPriority="high"
          decoding="async"
        />
      </motion.div>
      <motion.div className="fan__card fan__card--center" custom={SLOTS[1]} variants={card}>
        <HeroLedger />
      </motion.div>
      <motion.div className="fan__card fan__card--side" custom={SLOTS[2]} variants={card}>
        <img
          src="/images/services/hair-coloring.webp"
          alt="A stylist blow-drying a client’s freshly coloured hair"
          width={640}
          height={440}
          decoding="async"
        />
      </motion.div>
    </motion.div>
  );
}
