/**
 * Demo / seed fixtures – the ONE source for sample data. Used by `scripts/seed.ts` (emulators) and by
 * the web app's demo adapter (NEXT_PUBLIC_DEMO_MODE=true). Test values only.
 */
import type { BodyType, CarStatus, ExpenseCategory, FuelType, PurchaseSource, Transmission } from '../constants';

/** Demo/seed login accounts (shown on the demo login screen; emulator seed uses the same). */
export const DEMO_ACCOUNTS = {
  admin: { uid: 'demo-admin', email: 'admin@soliddrive.test', password: 'Demo-Admin-2026', name: 'Alex Admin', role: 'admin' },
  staff: { uid: 'demo-staff', email: 'staff@soliddrive.test', password: 'Demo-Staff-2026', name: 'Sam Staff', role: 'staff' },
} as const;

export const DEMO_VENDORS = [
  { id: 'v-tyres', name: 'Osborne Park Tyre & Wheel', phone: '(08) 9201 1100', email: 'accounts@optyres.test', abn: '11 222 333 444' },
  { id: 'v-mech', name: 'Balcatta Mechanical Services', phone: '(08) 9344 2200', email: 'service@balcattamech.test', abn: '22 333 444 555' },
  { id: 'v-detail', name: 'Perth Prestige Detailing', phone: '0412 345 678', email: 'book@perthdetailing.test', abn: '' },
  { id: 'v-panel', name: 'Malaga Panel & Paint', phone: '(08) 9248 3300', email: 'quotes@malagapanel.test', abn: '33 444 555 666' },
  { id: 'v-auction', name: 'Westside Vehicle Auctions', phone: '(08) 9455 4400', email: 'invoices@westsideauctions.test', abn: '44 555 666 777' },
  { id: 'v-transport', name: 'Swan Valley Car Transport', phone: '0423 456 789', email: 'jobs@swancartransport.test', abn: '55 666 777 888' },
  { id: 'v-licensing', name: 'Department of Transport WA', phone: '13 11 56', email: '', abn: '' },
] as const;

export interface DemoCarFixture {
  make: string;
  model: string;
  variant: string;
  year: number;
  bodyType: BodyType;
  transmission: Transmission;
  fuel: FuelType;
  engine: string;
  colour: string;
  km: number;
  price: number; // dollars, drive-away list price (GST inclusive)
  status: CarStatus;
  published: boolean;
  /** Image file number (car-01 … car-12) – the first 12 cars define the model ↔ photo mapping. */
  img: number;
  daysInStock: number;
  source: PurchaseSource;
  features: string[];
}

const F = {
  ute: ['Tow bar', 'Tub liner', 'Reverse camera', 'Apple CarPlay', 'Android Auto', 'Cruise control', 'Side steps'],
  suv: ['Reverse camera', 'Apple CarPlay', 'Android Auto', 'Blind spot monitoring', 'Lane keep assist', 'Roof rails', 'Climate control'],
  car: ['Reverse camera', 'Apple CarPlay', 'Bluetooth', 'Cruise control', 'Alloy wheels', 'Keyless entry'],
};

export const DEMO_CAR_FIXTURES: DemoCarFixture[] = [
  { make: 'Toyota', model: 'Hilux', variant: 'SR5 4x4 Double Cab', year: 2021, bodyType: 'ute', transmission: 'automatic', fuel: 'diesel', engine: '2.8L 4cyl turbo diesel', colour: 'Glacier White', km: 68_400, price: 54_990, status: 'available', published: true, img: 1, daysInStock: 12, source: 'trade-in', features: [...F.ute, 'LED headlights'] },
  { make: 'Ford', model: 'Ranger', variant: 'XLT 3.2 (4x4) Double Cab', year: 2020, bodyType: 'ute', transmission: 'automatic', fuel: 'diesel', engine: '3.2L 5cyl turbo diesel', colour: 'Meteor Grey', km: 82_150, price: 47_990, status: 'available', published: true, img: 2, daysInStock: 25, source: 'auction', features: [...F.ute, 'SYNC 3 infotainment'] },
  { make: 'Mazda', model: 'CX-5', variant: 'Maxx Sport (FWD)', year: 2022, bodyType: 'suv', transmission: 'automatic', fuel: 'petrol', engine: '2.5L 4cyl', colour: 'Soul Red Crystal', km: 31_200, price: 36_990, status: 'available', published: true, img: 3, daysInStock: 8, source: 'trade-in', features: F.suv },
  { make: 'Hyundai', model: 'i30', variant: 'Active', year: 2019, bodyType: 'hatch', transmission: 'automatic', fuel: 'petrol', engine: '2.0L 4cyl', colour: 'Intense Blue', km: 74_800, price: 19_990, status: 'available', published: true, img: 4, daysInStock: 41, source: 'private', features: F.car },
  { make: 'Toyota', model: 'RAV4', variant: 'GX Hybrid (2WD)', year: 2021, bodyType: 'suv', transmission: 'cvt', fuel: 'hybrid', engine: '2.5L 4cyl hybrid', colour: 'Silver Sky', km: 52_300, price: 42_990, status: 'reserved', published: true, img: 5, daysInStock: 33, source: 'wholesale', features: [...F.suv, 'Hybrid drive modes'] },
  { make: 'Kia', model: 'Sportage', variant: 'SX+ AWD', year: 2020, bodyType: 'suv', transmission: 'automatic', fuel: 'diesel', engine: '2.0L 4cyl turbo diesel', colour: 'Black Pearl', km: 64_900, price: 33_990, status: 'available', published: true, img: 6, daysInStock: 67, source: 'auction', features: [...F.suv, 'Panoramic sunroof', 'Leather seats'] },
  { make: 'Mitsubishi', model: 'Triton', variant: 'GLS (4x4) Double Cab', year: 2019, bodyType: 'ute', transmission: 'automatic', fuel: 'diesel', engine: '2.4L 4cyl turbo diesel', colour: 'White Diamond', km: 96_500, price: 32_990, status: 'available', published: true, img: 7, daysInStock: 74, source: 'trade-in', features: F.ute },
  { make: 'Volkswagen', model: 'Golf', variant: '110TSI Highline', year: 2018, bodyType: 'hatch', transmission: 'dual-clutch', fuel: 'petrol', engine: '1.4L 4cyl turbo', colour: 'Pure White', km: 88_000, price: 22_990, status: 'sold', published: true, img: 8, daysInStock: 52, source: 'private', features: [...F.car, 'Digital cockpit'] },
  { make: 'Subaru', model: 'Outback', variant: '2.5i Premium AWD', year: 2020, bodyType: 'wagon', transmission: 'cvt', fuel: 'petrol', engine: '2.5L flat-4', colour: 'Autumn Green', km: 58_700, price: 37_990, status: 'available', published: true, img: 9, daysInStock: 19, source: 'auction', features: [...F.suv, 'EyeSight driver assist', 'Heated seats'] },
  { make: 'Nissan', model: 'Patrol', variant: 'Ti V8', year: 2019, bodyType: 'suv', transmission: 'automatic', fuel: 'petrol', engine: '5.6L V8', colour: 'Black Obsidian', km: 91_300, price: 69_990, status: 'available', published: true, img: 10, daysInStock: 5, source: 'wholesale', features: [...F.suv, '8 seats', 'Tow bar', 'Leather seats'] },
  { make: 'Toyota', model: 'Corolla', variant: 'Ascent Sport Hybrid', year: 2021, bodyType: 'hatch', transmission: 'cvt', fuel: 'hybrid', engine: '1.8L 4cyl hybrid', colour: 'Silver Pearl', km: 47_600, price: 28_990, status: 'available', published: true, img: 11, daysInStock: 15, source: 'trade-in', features: [...F.car, 'Lane trace assist'] },
  { make: 'Mazda', model: 'Mazda3', variant: 'G20 Evolve', year: 2022, bodyType: 'hatch', transmission: 'automatic', fuel: 'petrol', engine: '2.0L 4cyl', colour: 'Machine Grey', km: 29_900, price: 31_990, status: 'available', published: true, img: 12, daysInStock: 3, source: 'auction', features: [...F.car, 'Head-up display'] },
  { make: 'Toyota', model: 'Hilux', variant: 'Workmate (4x2) Single Cab', year: 2018, bodyType: 'cab-chassis', transmission: 'manual', fuel: 'petrol', engine: '2.7L 4cyl', colour: 'Glacier White', km: 121_000, price: 24_990, status: 'available', published: true, img: 1, daysInStock: 88, source: 'wholesale', features: ['Steel tray', 'Bluetooth', 'Towbar'] },
  { make: 'Ford', model: 'Ranger', variant: 'Wildtrak 2.0 (4x4)', year: 2022, bodyType: 'ute', transmission: 'automatic', fuel: 'diesel', engine: '2.0L bi-turbo diesel', colour: 'Conquer Grey', km: 28_500, price: 66_990, status: 'reserved', published: true, img: 2, daysInStock: 21, source: 'trade-in', features: [...F.ute, 'Roller shutter', 'Leather seats'] },
  { make: 'Hyundai', model: 'i30', variant: 'N Line', year: 2021, bodyType: 'hatch', transmission: 'dual-clutch', fuel: 'petrol', engine: '1.6L 4cyl turbo', colour: 'Intense Blue', km: 36_100, price: 29_990, status: 'available', published: true, img: 4, daysInStock: 30, source: 'private', features: [...F.car, 'Sports seats'] },
  { make: 'Kia', model: 'Sportage', variant: 'S 2WD', year: 2023, bodyType: 'suv', transmission: 'automatic', fuel: 'petrol', engine: '2.0L 4cyl', colour: 'Black Pearl', km: 18_900, price: 35_990, status: 'available', published: true, img: 6, daysInStock: 10, source: 'trade-in', features: F.suv },
  { make: 'Toyota', model: 'RAV4', variant: 'Cruiser AWD Hybrid', year: 2022, bodyType: 'suv', transmission: 'cvt', fuel: 'hybrid', engine: '2.5L 4cyl hybrid', colour: 'Silver Sky', km: 41_700, price: 52_990, status: 'draft', published: false, img: 5, daysInStock: 2, source: 'auction', features: [...F.suv, 'Leather seats', 'Wireless charging'] },
  { make: 'Mitsubishi', model: 'Triton', variant: 'GLX+ (4x4) Club Cab', year: 2021, bodyType: 'ute', transmission: 'manual', fuel: 'diesel', engine: '2.4L 4cyl turbo diesel', colour: 'White Diamond', km: 59_800, price: 36_990, status: 'draft', published: false, img: 7, daysInStock: 1, source: 'private', features: F.ute },
  { make: 'Subaru', model: 'Outback', variant: '2.5i AWD', year: 2017, bodyType: 'wagon', transmission: 'cvt', fuel: 'petrol', engine: '2.5L flat-4', colour: 'Autumn Green', km: 132_400, price: 18_990, status: 'withdrawn', published: false, img: 9, daysInStock: 95, source: 'trade-in', features: F.suv },
  { make: 'Volkswagen', model: 'Golf', variant: 'R Wagon 4MOTION', year: 2019, bodyType: 'wagon', transmission: 'dual-clutch', fuel: 'petrol', engine: '2.0L 4cyl turbo', colour: 'Pure White', km: 63_200, price: 41_990, status: 'available', published: true, img: 8, daysInStock: 48, source: 'auction', features: [...F.car, 'Digital cockpit', 'Adaptive cruise'] },
];

export const DEMO_EXPENSE_TEMPLATES: { category: ExpenseCategory; description: string; vendor: (typeof DEMO_VENDORS)[number]['id']; min: number; max: number }[] = [
  { category: 'detailing', description: 'Full detail – interior shampoo and cut & polish', vendor: 'v-detail', min: 250, max: 450 },
  { category: 'tyres', description: 'Supply and fit 4 tyres, wheel alignment', vendor: 'v-tyres', min: 700, max: 1400 },
  { category: 'servicing', description: 'Logbook service, oil and filters', vendor: 'v-mech', min: 350, max: 650 },
  { category: 'mechanical', description: 'Replace front brake pads and rotors', vendor: 'v-mech', min: 450, max: 900 },
  { category: 'panel-paint', description: 'Rear bumper scuff repair and paint', vendor: 'v-panel', min: 400, max: 1100 },
  { category: 'transport', description: 'Transport from auction yard to Osborne Park', vendor: 'v-transport', min: 150, max: 330 },
  { category: 'auction-fees', description: 'Buyer premium and admin fee', vendor: 'v-auction', min: 400, max: 750 },
  { category: 'registration', description: 'Transfer and 3-month registration', vendor: 'v-licensing', min: 180, max: 420 },
];

