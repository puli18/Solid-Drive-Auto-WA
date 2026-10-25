/** Firestore collection / document paths – use these instead of string literals. */
export const COLLECTIONS = {
  cars: 'cars',
  carFinancials: 'carFinancials',
  expenses: 'expenses', // subcollection of cars/{carId}; also a collection-group name
  sales: 'sales',
  bookings: 'bookings',
  slotLocks: 'slotLocks',
  slotCounts: 'slotCounts',
  deposits: 'deposits',
  enquiries: 'enquiries',
  vendors: 'vendors',
  users: 'users',
  settings: 'settings',
  auditLog: 'auditLog',
  stripeEvents: 'stripeEvents', // webhook idempotency (functions only)
} as const;

export const SETTINGS_DOCS = {
  business: 'business',
  booking: 'booking',
  deposit: 'deposit',
  finance: 'finance',
  legal: 'legal',
} as const;
export type SettingsDocId = keyof typeof SETTINGS_DOCS;

export const paths = {
  car: (carId: string) => `cars/${carId}`,
  carFinancials: (carId: string) => `carFinancials/${carId}`,
  expenses: (carId: string) => `cars/${carId}/expenses`,
  expense: (carId: string, expenseId: string) => `cars/${carId}/expenses/${expenseId}`,
  settings: (id: SettingsDocId) => `settings/${id}`,
  user: (uid: string) => `users/${uid}`,
} as const;

/** Storage paths (Firebase Storage, private). */
export const storagePaths = {
  receipt: (carId: string, expenseId: string, fileName: string) =>
    `receipts/${carId}/${expenseId}/${fileName}`,
  saleDocument: (saleId: string, fileName: string) => `sales/${saleId}/${fileName}`,
  export: (uid: string, fileName: string) => `exports/${uid}/${fileName}`,
} as const;
