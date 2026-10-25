/** .ics calendar file for booking emails (opens in Google, Apple and Outlook calendars). */
import { createEvent, type DateArray, type EventAttributes } from 'ics';

export interface IcsInput {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description: string;
  location: string;
  url?: string;
  organizer: { name: string; email: string };
  status?: 'CONFIRMED' | 'CANCELLED';
  /** Increase on every change so calendars update the existing event. */
  sequence?: number;
}

const utcArray = (d: Date): DateArray => [
  d.getUTCFullYear(),
  d.getUTCMonth() + 1,
  d.getUTCDate(),
  d.getUTCHours(),
  d.getUTCMinutes(),
];

export function buildIcs(input: IcsInput): string {
  const attrs: EventAttributes = {
    uid: `${input.uid}@soliddriveautowa`,
    start: utcArray(input.start),
    startInputType: 'utc',
    startOutputType: 'utc',
    end: utcArray(input.end),
    endInputType: 'utc',
    endOutputType: 'utc',
    title: input.title,
    description: input.description,
    location: input.location,
    url: input.url,
    status: input.status ?? 'CONFIRMED',
    busyStatus: 'BUSY',
    organizer: input.organizer,
    sequence: input.sequence ?? 0,
    productId: 'soliddriveautowa/bookings',
    method: 'PUBLISH',
    alarms: input.status === 'CANCELLED' ? [] : [{ action: 'display', description: input.title, trigger: { hours: 2, before: true } }],
  };
  const { error, value } = createEvent(attrs);
  if (error || !value) throw error ?? new Error('Could not build the calendar file');
  return value;
}
