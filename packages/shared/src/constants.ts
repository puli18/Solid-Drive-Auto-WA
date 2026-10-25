/**
 * Shared constants: enums, labels and PLACEHOLDER defaults from the build plan.
 * Every enum is exported as a readonly tuple (for z.enum) plus a label map for UI.
 */

export const REGION = 'australia-southeast1' as const;
export const DEFAULT_TIMEZONE = 'Australia/Perth' as const;
export const CURRENCY = 'AUD' as const;
export const LOCALE = 'en-AU' as const;

// ---- Roles -----------------------------------------------------------------
export const ROLES = ['admin', 'staff'] as const;
export type Role = (typeof ROLES)[number];

// ---- Cars ------------------------------------------------------------------
export const CAR_STATUSES = ['draft', 'available', 'reserved', 'sold', 'withdrawn'] as const;
export type CarStatus = (typeof CAR_STATUSES)[number];
export const CAR_STATUS_LABELS: Record<CarStatus, string> = {
  draft: 'Draft',
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  withdrawn: 'Withdrawn',
};

export const BODY_TYPES = [
  'sedan',
  'hatch',
  'wagon',
  'suv',
  'ute',
  'van',
  'coupe',
  'convertible',
  'people-mover',
  'cab-chassis',
] as const;
export type BodyType = (typeof BODY_TYPES)[number];
export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  sedan: 'Sedan',
  hatch: 'Hatchback',
  wagon: 'Wagon',
  suv: 'SUV',
  ute: 'Ute',
  van: 'Van',
  coupe: 'Coupe',
  convertible: 'Convertible',
  'people-mover': 'People mover',
  'cab-chassis': 'Cab chassis',
};

export const FUEL_TYPES = [
  'petrol',
  'diesel',
  'hybrid',
  'plug-in-hybrid',
  'electric',
  'lpg',
] as const;
export type FuelType = (typeof FUEL_TYPES)[number];
export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  hybrid: 'Hybrid',
  'plug-in-hybrid': 'Plug-in hybrid',
  electric: 'Electric',
  lpg: 'LPG',
};

export const TRANSMISSIONS = ['automatic', 'manual', 'cvt', 'dual-clutch'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];
export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  automatic: 'Automatic',
  manual: 'Manual',
  cvt: 'CVT',
  'dual-clutch': 'Dual-clutch',
};

export const PURCHASE_SOURCES = ['auction', 'trade-in', 'private', 'wholesale'] as const;
export type PurchaseSource = (typeof PURCHASE_SOURCES)[number];
export const PURCHASE_SOURCE_LABELS: Record<PurchaseSource, string> = {
  auction: 'Auction',
  'trade-in': 'Trade-in',
  private: 'Private',
  wholesale: 'Wholesale',
};

export const SYNDICATION_CHANNELS = ['carsales', 'gumtree', 'facebook'] as const;
export type SyndicationChannel = (typeof SYNDICATION_CHANNELS)[number];

// ---- Expenses --------------------------------------------------------------
export const EXPENSE_CATEGORIES = [
  'mechanical',
  'servicing',
  'tyres',
  'panel-paint',
  'detailing',
  'parts',
  'inspection',
  'registration',
  'transport',
  'auction-fees',
  'advertising',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  mechanical: 'Mechanical repairs',
  servicing: 'Servicing',
  tyres: 'Tyres & wheels',
  'panel-paint': 'Panel & paint',
  detailing: 'Detailing',
  parts: 'Parts & accessories',
  inspection: 'Inspection',
  registration: 'Registration & licensing',
  transport: 'Transport',
  'auction-fees': 'Auction fees',
  advertising: 'Advertising',
  other: 'Other',
};

// ---- Sales -----------------------------------------------------------------
export const PAYMENT_METHODS = [
  'bank-transfer',
  'finance',
  'card',
  'cash',
  'cheque',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  'bank-transfer': 'Bank transfer',
  finance: 'Finance',
  card: 'Card',
  cash: 'Cash',
  cheque: 'Bank cheque',
  other: 'Other',
};

// ---- Bookings --------------------------------------------------------------
export const BOOKING_TYPES = ['test-drive', 'inspection'] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];
export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
  'test-drive': 'Test drive',
  inspection: 'Inspection',
};
export const BOOKING_STATUSES = ['confirmed', 'cancelled', 'attended', 'no-show'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  attended: 'Attended',
  'no-show': 'No-show',
};
export const BOOKING_SOURCES = ['web', 'staff'] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

// ---- Deposits --------------------------------------------------------------
export const DEPOSIT_STATUSES = ['pending', 'paid', 'expired', 'conflict'] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];
export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  expired: 'Expired',
  conflict: 'Conflict',
};
/** Bump when the deposit terms wording changes; stored on each deposit. */
export const DEPOSIT_TERMS_VERSION = '2026-10-placeholder-v1';
export const DEPOSIT_CHECKOUT_EXPIRY_MINUTES = 30;

// ---- Enquiries -------------------------------------------------------------
export const ENQUIRY_TYPES = ['general', 'trade-in'] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];
export const ENQUIRY_STATUSES = ['new', 'contacted', 'booked', 'won', 'lost'] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  won: 'Won',
  lost: 'Lost',
};
export const TRADE_IN_CONDITIONS = ['excellent', 'good', 'fair', 'poor'] as const;
export type TradeInCondition = (typeof TRADE_IN_CONDITIONS)[number];

// ---- Audit log -------------------------------------------------------------
export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'restore',
  'status-change',
  'publish',
  'unpublish',
  'role-change',
  'invite',
  'deactivate',
  'export',
  'deposit-paid',
  'deposit-conflict',
  'deposit-expired',
  'booking-created',
  'booking-cancelled',
  'booking-rescheduled',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ---- Limits ----------------------------------------------------------------
export const MAX_CAR_PHOTOS = 30;
export const MAX_TRADE_IN_PHOTOS = 6;
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const;
export const FINANCE_TERM_MIN_MONTHS = 12;
export const FINANCE_TERM_MAX_MONTHS = 84;
export const EXPORT_URL_TTL_MINUTES = 15;

// ---- Cloudflare Images -----------------------------------------------------
export const IMAGE_VARIANTS = ['thumb', 'card', 'full'] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];
export const IMAGE_VARIANT_WIDTHS: Record<ImageVariant, number> = {
  thumb: 400,
  card: 800,
  full: 1600,
};
/** Image ids with this prefix are local files under apps/web/public/images (seed/dev only). */
export const LOCAL_IMAGE_PREFIX = 'local:';
/** Cloudflare Images custom-id prefix for trade-in photos. */
export const TRADE_IN_IMAGE_PREFIX = 'trade-in/';

// ---- PLACEHOLDER defaults (editable in admin settings) ----------------------
export const DEFAULT_GST_RATE_PCT = 10;
export const DEFAULT_DEPOSIT_AMOUNT_CENTS = 50_000;
export const DEFAULT_AGED_STOCK_DAYS = 60;
export const DEFAULT_FINANCE_RATE_PCT = 9.99;

export const DEFAULT_DEPOSIT_TERMS_TEXT =
  'PLACEHOLDER – for client review. The holding deposit secures this vehicle for you and removes it from sale. ' +
  'The deposit is NON-REFUNDABLE, including if you decide not to proceed with the purchase. ' +
  'It will be deducted from the purchase price when you complete the sale. ' +
  'The vehicle is held until the sale is completed or the dealership releases it. ' +
  'Payment of a deposit does not constitute finance approval.';

export const DEFAULT_FINANCE_DISCLAIMER =
  'Estimate only. Repayments are indicative, based on the rate shown and do not include fees or charges. ' +
  'This is not a quote or an offer of finance. Finance is subject to lender approval, terms and conditions.';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const DEFAULT_BOOKING_SETTINGS = {
  slotMinutes: 45,
  bufferMinutes: 15,
  weeklyHours: {
    mon: [{ start: '09:00', end: '17:00' }],
    tue: [{ start: '09:00', end: '17:00' }],
    wed: [{ start: '09:00', end: '17:00' }],
    thu: [{ start: '09:00', end: '17:00' }],
    fri: [{ start: '09:00', end: '17:00' }],
    sat: [{ start: '09:00', end: '13:00' }],
    sun: [] as { start: string; end: string }[],
  },
  blackoutDates: [] as string[],
  maxPerSlot: 2,
  minNoticeHours: 2,
  maxDaysAhead: 30,
} as const;

export const DEFAULT_BUSINESS_SETTINGS = {
  name: 'Solid Drive Auto WA',
  shortName: 'SDA WA',
  abn: '00 000 000 000',
  dealerLicenceNo: 'DL 00000 (placeholder)',
  address: {
    line1: '123 Lorem Ipsum Highway',
    line2: '',
    suburb: 'Osborne Park',
    state: 'WA',
    postcode: '6017',
    country: 'Australia',
  },
  phone: '(08) 9000 0000',
  email: 'sales@soliddrive.test',
  hours: 'Mon–Fri 9:00–17:00, Sat 9:00–13:00, Sun closed',
  timezone: DEFAULT_TIMEZONE,
  gstRate: DEFAULT_GST_RATE_PCT,
  logo: '/brand/logo-full-transparent.png',
} as const;

export const DEFAULT_LEGAL_SETTINGS = {
  privacyText:
    'PLACEHOLDER privacy policy – lorem ipsum dolor sit amet. To be supplied by the client.',
  termsText:
    'PLACEHOLDER website terms – lorem ipsum dolor sit amet. To be supplied by the client.',
  depositTermsText: DEFAULT_DEPOSIT_TERMS_TEXT,
  warrantyText: 'PLACEHOLDER warranty information – lorem ipsum dolor sit amet.',
} as const;

export const DEFAULT_APP_SETTINGS = {
  agedStockDays: DEFAULT_AGED_STOCK_DAYS,
  nextStockNo: 1001,
} as const;

export const STOCK_NO_PREFIX = 'SDA';

/**
 * Local Emulator Suite ports (must match firebase.json). Non-default ports so this project can run
 * alongside other Firebase projects' emulators on the same machine.
 */
export const EMULATOR_PORTS = {
  ui: 4010,
  hub: 4410,
  auth: 9109,
  firestore: 8188,
  functions: 5011,
  storage: 9209,
} as const;
export const EMULATOR_HOST = '127.0.0.1';
