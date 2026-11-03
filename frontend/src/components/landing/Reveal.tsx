import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/** Section entrance: a short rise from already-legible, once, when it scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const still = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      initial={still ? false : { opacity: 0.35, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
