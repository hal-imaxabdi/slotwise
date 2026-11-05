/** The hero's demo day: which times are already taken, which one gets claimed, what is next. */
export const BOARD = [
  { time: '09:00', booked: true },
  { time: '09:30', booked: false },
  { time: '10:00', booked: false },
  { time: '10:30', booked: false },
  { time: '11:00', booked: false },
  { time: '11:30', booked: true },
  { time: '13:00', booked: false },
  { time: '13:30', booked: false },
  { time: '14:00', booked: true },
  { time: '14:30', booked: false },
  { time: '15:00', booked: false },
  { time: '15:30', booked: false },
] as const;

export const CLAIM_INDEX = 2;
export const NEXT_INDEX = 3;

export const BOARD_LABEL =
  'Today’s slot board: 09:00, 11:30 and 14:00 are already booked. A client books 10:00. A second booking for 10:00 is refused because the slot is taken, and 10:30 is offered as the next free time.';
