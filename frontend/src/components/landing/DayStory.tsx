import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const MOMENTS = [
  {
    time: '08:45',
    title: 'The book is already full',
    text: 'Clients booked last night from their phones. Before the first coffee, your team opens today’s list and sees who is in the chair next.',
    screen: '/images/product/mobile-staff.webp',
    alt: 'Slotwise on a phone: the staff list of today’s appointments',
  },
  {
    time: '13:10',
    title: 'A walk-in, sorted in seconds',
    text: 'Someone at the door? Pick a free time, book it for them and carry on. No scribbles in the margin, no clash with the next client.',
    screen: '/images/product/mobile-services.webp',
    alt: 'Slotwise on a phone: the list of services with photos and prices',
  },
  {
    time: '18:30',
    title: 'Tomorrow takes care of itself',
    text: 'Clients move or cancel their own bookings online, up to a day before. Closing for a holiday? Block it once and those times disappear.',
    screen: '/images/product/mobile.webp',
    alt: 'Slotwise on a phone: a client’s upcoming appointments with cancel and reschedule',
  },
];

function Moment({
  index,
  onActive,
  moment,
}: {
  index: number;
  onActive: (index: number) => void;
  moment: (typeof MOMENTS)[number];
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });
  useEffect(() => {
    if (inView) {
      onActive(index);
    }
  }, [inView, index, onActive]);

  return (
    <li ref={ref} className="day__moment">
      <p className="day__time">
        <time>{moment.time}</time>
      </p>
      <h3>{moment.title}</h3>
      <p>{moment.text}</p>
      <img
        className="day__inline-shot"
        src={moment.screen}
        alt={moment.alt}
        width={780}
        height={1688}
        loading="lazy"
        decoding="async"
      />
    </li>
  );
}

/** A day at the shop, told in three moments while the phone beside it keeps up. */
export function DayStory() {
  const [active, setActive] = useState(0);
  const still = useReducedMotion() ?? false;
  const current = MOMENTS[active];

  return (
    <div className="day">
      <ol className="day__moments">
        {MOMENTS.map((moment, index) => (
          <Moment key={moment.time} index={index} moment={moment} onActive={setActive} />
        ))}
      </ol>
      <div className="day__stage" aria-hidden="true">
        <div className="day__phone">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.img
              key={current.screen}
              src={current.screen}
              alt=""
              width={780}
              height={1688}
              initial={still ? false : { opacity: 0, y: 24, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={still ? undefined : { opacity: 0, y: -24, filter: 'blur(6px)' }}
              transition={{ duration: still ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
