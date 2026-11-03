import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { serviceImage } from '../../lib/serviceImages.ts';
import { ArrowRightIcon, ClockIcon } from '../icons.tsx';

const TIMES = [
  { time: '09:00', taken: true },
  { time: '09:30', taken: false },
  { time: '10:00', taken: false },
  { time: '10:30', taken: true },
  { time: '11:00', taken: false },
  { time: '11:30', taken: false },
];

interface BookingPreviewProps {
  pending: boolean;
  onBook: () => void;
}

/** A working miniature of the booking screen: pick a time, then open it in the demo. */
export function BookingPreview({ pending, onBook }: BookingPreviewProps) {
  const [picked, setPicked] = useState('10:00');
  const still = useReducedMotion() ?? false;

  return (
    <div className="preview-booking">
      <div className="preview-service">
        <img
          src={serviceImage('Classic Haircut')}
          alt="A barber finishing a fade haircut with clippers"
          width={640}
          height={440}
          loading="lazy"
          decoding="async"
        />
        <div>
          <p className="preview-service__name">Classic Haircut</p>
          <p className="preview-service__meta">
            <ClockIcon className="icon" />
            30 min · Rp 75.000
          </p>
        </div>
      </div>
      <fieldset className="preview-times">
        <legend>Pick a time on Thursday</legend>
        <div className="preview-times__grid">
          {TIMES.map(({ time, taken }) => (
            <button
              key={time}
              type="button"
              className="preview-time"
              aria-pressed={picked === time}
              disabled={taken}
              aria-label={taken ? `${time}, taken` : time}
              onClick={() => {
                setPicked(time);
              }}
            >
              {picked === time && (
                <motion.span
                  layoutId="preview-time-pill"
                  className="preview-time__pill"
                  transition={
                    still ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }
                  }
                />
              )}
              <span className="preview-time__label">{time}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={pending}
        onClick={onBook}
      >
        {pending ? 'Opening the demo...' : `Book ${picked} in the demo`}
        {!pending && <ArrowRightIcon className="icon" />}
      </button>
    </div>
  );
}
