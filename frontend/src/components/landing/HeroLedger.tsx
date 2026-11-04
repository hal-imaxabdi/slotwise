import { motion, useReducedMotion } from 'motion/react';

const ROWS = [
  { time: '09:00', name: 'Andi Pratama', service: 'Classic Haircut' },
  { time: '09:30', name: 'Siti Rahmawati', service: 'Grey Blending' },
  { time: '10:00', name: 'Rizky Hidayat', service: 'Beard Trim and Shape' },
];

const EASE = [0.16, 1, 0.3, 1] as const;
const WRITE = 0.55; // seconds to "ink" one line
const GAP = 0.3;
const CLASH_AT = ROWS.length * GAP + WRITE + 0.35;

/**
 * The page's signature moment: a day in the appointment book writes itself, then a
 * second booking for 10:00 is refused and struck through. One line, one name.
 */
export function HeroLedger() {
  const still = useReducedMotion() ?? false;
  const at = (delay: number) => (still ? { duration: 0 } : { duration: WRITE, delay, ease: EASE });

  return (
    <div
      className="ledger"
      role="img"
      aria-label="Today’s appointment book: Andi at 09:00, Siti at 09:30, Rizky at 10:00. A second booking for 10:00 is refused because the slot is taken; 10:30 is still open, and Dimas is at 11:00."
    >
      <div className="ledger__head" aria-hidden="true">
        <span>Today’s book</span>
        <span>Sat, 8 Nov</span>
      </div>
      <ol className="ledger__lines" aria-hidden="true">
        {ROWS.map((row, index) => (
          <li key={row.time} className="ledger__line">
            <span className="ledger__time">{row.time}</span>
            <motion.span
              className="ledger__entry"
              initial={still ? false : { clipPath: 'inset(0 100% 0 0)' }}
              animate={{ clipPath: 'inset(0 0% 0 0)' }}
              transition={at(0.2 + index * GAP)}
            >
              <strong>{row.name}</strong>
              <span>{row.service}</span>
            </motion.span>
            {row.time === '10:00' && (
              <motion.span
                className="ledger__clash"
                initial={still ? false : { opacity: 0, x: 48 }}
                animate={
                  still
                    ? { opacity: 1, x: 0 }
                    : { opacity: [0, 1, 1, 1, 1, 1], x: [48, 0, -7, 6, -3, 0] }
                }
                transition={
                  still ? { duration: 0 } : { duration: 0.75, delay: CLASH_AT, ease: 'easeOut' }
                }
              >
                <span className="ledger__clash-name">
                  Kevin Tanoto
                  <motion.span
                    className="ledger__strike"
                    initial={still ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={
                      still
                        ? { duration: 0 }
                        : { duration: 0.35, delay: CLASH_AT + 0.8, ease: EASE }
                    }
                  />
                </span>
                <motion.span
                  className="ledger__taken"
                  initial={still ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    still ? { duration: 0 } : { duration: 0.4, delay: CLASH_AT + 1.05, ease: EASE }
                  }
                >
                  Taken, try 10:30
                </motion.span>
              </motion.span>
            )}
          </li>
        ))}
        <li className="ledger__line ledger__line--open">
          <span className="ledger__time">10:30</span>
          <motion.span
            className="ledger__open"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={
              still ? { duration: 0 } : { duration: 0.5, delay: CLASH_AT + 1.4, ease: EASE }
            }
          >
            Open
          </motion.span>
        </li>
        <li className="ledger__line">
          <span className="ledger__time">11:00</span>
          <motion.span
            className="ledger__entry"
            initial={still ? false : { clipPath: 'inset(0 100% 0 0)' }}
            animate={{ clipPath: 'inset(0 0% 0 0)' }}
            transition={at(0.2 + ROWS.length * GAP)}
          >
            <strong>Dimas Saputra</strong>
            <span>Hot Towel Shave</span>
          </motion.span>
        </li>
      </ol>
      <p className="ledger__foot" aria-hidden="true">
        <span>4 booked · 1 open</span>
        <span>1 clash refused</span>
      </p>
    </div>
  );
}
