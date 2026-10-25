/**
 * Cloud Functions entry point (2nd gen, region australia-southeast1, Node 20).
 * Every exported const here is deployed. Add new functions by exporting them below.
 */
// Bookings
export { getAvailability } from './bookings/getAvailability';
export { createBooking } from './bookings/createBooking';
export { cancelBooking } from './bookings/cancelBooking';
export { rescheduleBooking } from './bookings/rescheduleBooking';
export { getManagedBooking } from './bookings/getManagedBooking';
export { staffCreateBooking } from './bookings/staffCreateBooking';
export { sendBookingReminders } from './bookings/sendBookingReminders';
export { onBookingStatusChange } from './bookings/onBookingStatusChange';
// Enquiries
export { createEnquiry } from './enquiries/createEnquiry';
export { getTradeInUploadUrls } from './enquiries/getTradeInUploadUrls';
// Deposits
export { createDepositCheckout } from './deposits/createDepositCheckout';
export { getDepositStatus } from './deposits/getDepositStatus';
export { stripeWebhook } from './deposits/stripeWebhook';
// Images
export { getImageUploadUrl } from './images/getImageUploadUrl';
export { deleteCarImage } from './images/deleteCarImage';
// Cars
export { onCarWrite } from './cars/onCarWrite';
// Exports
export { exportCarReport } from './exports/exportCarReport';
export { exportStockReport } from './exports/exportStockReport';
export { cleanupExports } from './exports/cleanupExports';
// Users
export { setUserRole } from './users/setUserRole';
export { inviteUser } from './users/inviteUser';
export { deactivateUser } from './users/deactivateUser';
// Feed (M8)
export { stockFeed } from './feed/stockFeed';
