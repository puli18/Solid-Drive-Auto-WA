/**
 * Server actions behind every form/button that would call a Cloud Function (client-side).
 *
 *   import { runAction, actionErrorMessage, actionFieldIssues } from '@/lib/data';
 *   const { slots } = await runAction('getAvailability', { carId, date: '2026-10-27' });
 *   const { url } = await runAction('createDepositCheckout', {...}); window.location.assign(url);
 *
 * Firebase mode → the typed callable (lib/functions.ts). Demo mode → validated with the same zod schema,
 * then a local simulation: nothing is sent, availability is computed in-browser from settings/booking,
 * deposit checkout returns `/reserve/success?session_id=demo_…&demo=1` (no payment), exports throw
 * `DemoUnsupportedError` (generate client-side with exceljs instead).
 */
import {
  callableSchemas,
  type CallableInput,
  type CallableName,
  type CallableOutput,
  type CallableParsedInput,
  carTitle,
  DEFAULT_TIMEZONE,
  openSlotsForDate,
  toIsoInTz,
} from '@sda/shared';
import {
  CallableValidationError,
  callFunction,
  functionErrorMessage,
  functionFieldIssues,
  type FieldIssue,
} from '../functions';
import { withSettingsDefaults } from './common';
import { demoGet, demoGetSettings, demoList, demoNewId, demoPut } from './demo/store';
import { DEMO_MODE } from './mode';

export class DemoUnsupportedError extends Error {
  constructor(what: string) {
    super(`${what} isn't available in the preview.`);
    this.name = 'DemoUnsupportedError';
  }
}

type DemoHandlers = { [N in CallableName]: (input: CallableParsedInput<N>) => Promise<CallableOutput<N>> };

const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms));

function demoCar(carId: string) {
  const car = demoGet('cars', carId);
  if (!car) throw new Error('Car not found');
  return car as Record<string, unknown> & { id: string; year: number; make: string; model: string; variant?: string; slug: string };
}

function demoBooking(input: { carId: string; type: 'test-drive' | 'inspection'; startAt: string; customer: { name: string; phone: string; email: string }; notes?: string }, source: 'web' | 'staff') {
  const settings = withSettingsDefaults('booking', demoGetSettings('booking'));
  const start = new Date(input.startAt);
  const end = new Date(start.getTime() + settings.slotMinutes * 60_000);
  const car = demoCar(input.carId);
  const id = demoNewId('booking');
  const now = new Date();
  demoPut('bookings', {
    id,
    carId: car.id,
    carTitle: carTitle(car),
    stockNo: car.stockNo,
    type: input.type,
    startAt: start,
    endAt: end,
    customer: input.customer,
    licenceConfirmed: input.type === 'test-drive',
    status: 'confirmed',
    manageToken: 'demo',
    notes: input.notes ?? '',
    source,
    createdAt: now,
    createdBy: source === 'staff' ? 'demo-staff' : 'public',
    updatedAt: now,
    updatedBy: 'public',
    deletedAt: null,
  });
  return { bookingId: id, manageToken: `demo-token-${id}`, startAt: toIsoInTz(start), endAt: toIsoInTz(end) };
}

const demo: DemoHandlers = {
  async getAvailability({ carId, date }) {
    await wait(200);
    const settings = withSettingsDefaults('booking', demoGetSettings('booking'));
    const car = demoCar(carId);
    const taken = new Set(
      demoList('bookings')
        .filter((b) => b.carId === carId && b.status === 'confirmed')
        .map((b) => (b.startAt as Date).getTime()),
    );
    const slots =
      car.status === 'available' && car.published
        ? openSlotsForDate(settings, date).filter((s) => !taken.has(s.startAt.getTime())).map((s) => s.iso)
        : [];
    return { date, timezone: DEFAULT_TIMEZONE, slots };
  },
  async createBooking(input) {
    await wait();
    return demoBooking(input, 'web');
  },
  async staffCreateBooking(input) {
    await wait();
    return demoBooking(input, 'staff');
  },
  async cancelBooking() {
    await wait();
    return { ok: true };
  },
  async rescheduleBooking({ startAt }) {
    await wait();
    const settings = withSettingsDefaults('booking', demoGetSettings('booking'));
    const end = new Date(new Date(startAt).getTime() + settings.slotMinutes * 60_000);
    return { ok: true, startAt, endAt: toIsoInTz(end) };
  },
  async getManagedBooking({ bookingId }) {
    await wait(200);
    const b = demoGet('bookings', bookingId);
    if (!b) throw new Error('Booking not found');
    const car = demoGet('cars', String(b.carId));
    return {
      bookingId,
      carId: String(b.carId),
      carTitle: String(b.carTitle ?? ''),
      carSlug: (car?.slug as string) ?? null,
      type: b.type as 'test-drive' | 'inspection',
      status: b.status as 'confirmed',
      startAt: toIsoInTz(b.startAt as Date),
      endAt: toIsoInTz(b.endAt as Date),
      customer: b.customer as { name: string; email: string; phone: string },
    };
  },
  async createEnquiry() {
    await wait();
    return { enquiryId: demoNewId('enq') };
  },
  async getTradeInUploadUrls() {
    throw new DemoUnsupportedError('Photo upload');
  },
  async createDepositCheckout({ carId }) {
    await wait();
    const depositId = demoNewId('dep');
    return { depositId, url: `/reserve/success?session_id=demo_${depositId}&car=${encodeURIComponent(carId)}&demo=1` };
  },
  async getDepositStatus({ sessionId }) {
    await wait(200);
    const carId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('car') : null;
    const car = carId ? demoGet('cars', carId) : null;
    return {
      status: sessionId.startsWith('demo_') ? 'paid' : 'not-found',
      carTitle: car ? carTitle(car as never) : undefined,
      carSlug: (car?.slug as string) ?? null,
      amountCents: Number(withSettingsDefaults('deposit', demoGetSettings('deposit')).amountCents),
    };
  },
  async getImageUploadUrl() {
    throw new DemoUnsupportedError('Photo upload');
  },
  async deleteCarImage() {
    throw new DemoUnsupportedError('Deleting photos from Cloudflare');
  },
  async exportCarReport() {
    throw new DemoUnsupportedError('Server export');
  },
  async exportStockReport() {
    throw new DemoUnsupportedError('Server export');
  },
  async setUserRole({ uid, role }) {
    const u = demoGet('users', uid);
    if (u) demoPut('users', { ...u, role, updatedAt: new Date() });
    return { ok: true };
  },
  async inviteUser({ email, name, role }) {
    const uid = demoNewId('user');
    const now = new Date();
    demoPut('users', { id: uid, email, name, role, active: true, invitedAt: now, createdAt: now, createdBy: 'demo-admin', updatedAt: now, updatedBy: 'demo-admin', deletedAt: null });
    return { uid };
  },
  async deactivateUser({ uid }) {
    const u = demoGet('users', uid);
    if (u) demoPut('users', { ...u, active: false, updatedAt: new Date() });
    return { ok: true };
  },
};

/** Run a server action (callable in Firebase mode, simulated in demo mode). Validates input first. */
export async function runAction<N extends CallableName>(name: N, input: CallableInput<N>): Promise<CallableOutput<N>> {
  if (!DEMO_MODE) return callFunction(name, input);
  const parsed = callableSchemas[name].safeParse(input);
  if (!parsed.success) {
    throw new CallableValidationError(parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return (demo[name] as (i: unknown) => Promise<CallableOutput<N>>)(parsed.data);
}

export function actionErrorMessage(err: unknown): string {
  if (err instanceof DemoUnsupportedError) return err.message;
  return functionErrorMessage(err);
}

export function actionFieldIssues(err: unknown): FieldIssue[] {
  return functionFieldIssues(err);
}

export type { FieldIssue };
export { CallableValidationError };
