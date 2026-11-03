/**
 * The dealer's real stock – SEED DATA used ONLY by scripts (`scripts/seed-stock.ts` for a real project,
 * `scripts/seed.ts` for the emulators). Never import this from apps/web or @sda/shared: the cars live in
 * Firestore, not in the app bundle. Docs are built by `buildStockCarDocs()` in `scripts/lib/stock-docs.ts`.
 */
import type { BodyType, CarStatus, FuelType, Transmission } from '@sda/shared';

/** One stock photo: a file in `apps/web/public/images/cars/<photoKey>/` and its alt text. */
export interface StockCarPhoto {
  file: string;
  alt: string;
}

export interface StockCarFixture {
  /** Stock number; the doc id is `car-<stockNo lowercased>` (e.g. car-sda1001). */
  stockNo: string;
  /** Folder under `apps/web/public/images/cars/` holding this car's photos. */
  photoKey: string;
  make: string;
  model: string;
  variant: string;
  /** 0 = not supplied yet (shown as "TBC"; the admin form asks for it on the next save). */
  year: number;
  bodyType: BodyType;
  transmission: Transmission;
  fuel: FuelType;
  engine: string;
  colour: string;
  /** 0 = not supplied yet (shown as "TBC"). */
  km: number;
  /** Dollars, drive-away list price (GST inclusive). 0 = price on application ("Call for price"). */
  price: number;
  status: CarStatus;
  published: boolean;
  /** Days before the seed run that the car counts as listed (createdAt; orders the newest-first lists). */
  daysListed: number;
  features: string[];
  description: string;
  /**
   * Photos in display order; the first is the cover. Copied from
   * `apps/web/public/images/cars/stock-photos.json` (keep the two in sync when photos change).
   */
  photos: StockCarPhoto[];
}

// Features are capped at 80 characters by the car schema.
const MULTI_INFO_DISPLAY = 'Multi-info display (trip computer, maintenance monitor, system preferences)';

export const STOCK_CARS: StockCarFixture[] = [
  {
    stockNo: 'SDA1001',
    photoKey: 'mazda3-2012',
    make: 'Mazda',
    model: 'Mazda3',
    variant: '',
    year: 2012,
    bodyType: 'sedan',
    transmission: 'automatic',
    fuel: 'petrol',
    engine: '',
    colour: 'Red',
    km: 225_000,
    price: 5_990,
    status: 'available',
    published: true,
    daysListed: 3,
    features: [
      MULTI_INFO_DISPLAY,
      'Bluetooth connectivity',
      'Smart key and power control',
      'Dual zone climate control',
      'Electric power steering',
      'Dynamic stability control (DSC)',
    ],
    description:
      'A 2012 Mazda3 sedan in red with a black interior, automatic transmission and a petrol engine. ' +
      'It has travelled 225,000 km.\n\n' +
      'Comfort and convenience features include Bluetooth connectivity, a smart key with power control, ' +
      'dual zone climate control and a multi-information display with trip computer and maintenance monitor. ' +
      'Electric power steering and dynamic stability control (DSC) round it out.\n\n' +
      'Come and see it at the yard or book a test drive online.',
    photos: [
      { file: '01.webp', alt: 'Red 2012 Mazda3 sedan, front three-quarter view' },
      { file: '02.webp', alt: 'Red 2012 Mazda3 sedan, side view' },
      { file: '03.webp', alt: 'Red 2012 Mazda3 sedan, rear three-quarter view' },
      { file: '04.webp', alt: 'Red 2012 Mazda3 sedan, front view' },
      { file: '05.webp', alt: 'Red 2012 Mazda3 sedan, front three-quarter view from the driver side' },
      { file: '06.webp', alt: 'Red 2012 Mazda3 sedan, dashboard and steering wheel' },
      { file: '07.webp', alt: 'Red 2012 Mazda3 sedan, front seats and dashboard from the passenger door' },
      { file: '08.webp', alt: 'Red 2012 Mazda3 sedan, rear seats' },
    ],
  },
  {
    stockNo: 'SDA1002',
    photoKey: 'nissan-patrol-dx',
    make: 'Nissan',
    model: 'Patrol',
    variant: 'DX CRD 4x4',
    // Year, odometer and price were not supplied by the dealer yet (0 = shown as TBC / Call for price).
    year: 0,
    bodyType: 'wagon',
    transmission: 'manual',
    fuel: 'diesel',
    engine: 'Common-rail turbo diesel',
    colour: 'White',
    km: 0,
    price: 0,
    status: 'available',
    published: true,
    daysListed: 2,
    features: [
      '5 speed manual',
      'New high-flow turbo',
      'New intercooler',
      'New radiator',
      'New alternator',
      'New idler pulley',
      'Catch can installed',
      '3 inch lift kit',
      'Brand new mud terrain tyres',
      '5 new tyres and new 15 inch steel rims',
      'Snorkel',
      'Bull bar',
      'New sport lights',
      'Roof rack with awning',
      'Rear-mounted spare wheel',
      'Tow hitch',
      '80L main tank',
      '40L sub tank',
      'UHF radio',
      'Window tint',
    ],
    description:
      'A GU series Nissan Patrol DX 4x4 wagon with the common-rail turbo diesel (CRD) and a 5 speed manual gearbox, ' +
      'finished in white with black flares, bumpers, steel wheels and bull bar.\n\n' +
      'This Patrol runs incredibly well, pulls hard with its new high-flow turbo set-up and has been mechanically ' +
      'refreshed. Whether you are after a reliable daily workhorse or a turn-key remote touring rig, this DX is ' +
      'ready to hit the tracks tomorrow.\n\n' +
      'Recent work includes a new radiator, intercooler, alternator and idler pulley, a catch can, a 3 inch lift kit ' +
      'and new mud terrain tyres on new 15 inch steel rims. It is set up for touring with a snorkel, bull bar, ' +
      'roof rack with awning, an 80L main tank plus a 40L sub tank, a UHF radio, new sport lights and window tint.\n\n' +
      'Call us for the price and full details.',
    photos: [
      { file: '01.webp', alt: 'White Nissan Patrol DX 4x4 with bull bar and roof rack, front three-quarter view' },
      { file: '02.webp', alt: 'White Nissan Patrol DX 4x4, side view' },
      { file: '03.webp', alt: 'White Nissan Patrol DX 4x4 with roof rack awning, rear three-quarter view' },
      { file: '04.webp', alt: 'White Nissan Patrol DX 4x4 with rear spare wheel, rear view' },
      { file: '05.webp', alt: 'White Nissan Patrol DX 4x4 with bull bar and driving lights, front view' },
      { file: '06.webp', alt: 'White Nissan Patrol DX 4x4 with snorkel, front three-quarter view from the passenger side' },
      { file: '07.webp', alt: 'White Nissan Patrol DX 4x4, rear three-quarter view from the driver side' },
      { file: '08.webp', alt: 'White Nissan Patrol DX 4x4, dashboard and steering wheel' },
      { file: '09.webp', alt: 'White Nissan Patrol DX 4x4, driver seat and manual gear lever' },
      { file: '10.webp', alt: 'White Nissan Patrol DX 4x4, rear seats' },
    ],
  },
  {
    stockNo: 'SDA1003',
    photoKey: 'mitsubishi-lancer-2007',
    make: 'Mitsubishi',
    model: 'Lancer',
    variant: 'ES',
    year: 2007,
    bodyType: 'sedan',
    transmission: 'automatic',
    fuel: 'petrol',
    engine: '2.0L petrol',
    colour: 'White',
    km: 150_000,
    price: 6_750,
    status: 'available',
    published: true,
    daysListed: 1,
    features: [
      MULTI_INFO_DISPLAY,
      'Logbook history with maintenance records',
      'Smart key and power control',
      '2.0L petrol engine',
      "Dual front airbags, plus a driver's knee airbag on select specifications",
    ],
    description:
      'A 2007 Mitsubishi Lancer ES sedan in white with a black interior, automatic transmission and a 2.0L petrol engine. ' +
      'It has travelled 150,000 km and comes with logbook history and maintenance records.\n\n' +
      'Features include a smart key with power control, a multi-information display with trip computer and ' +
      'maintenance monitor, and dual front airbags.\n\n' +
      'Come and see it at the yard or book a test drive online.',
    photos: [
      { file: '01.webp', alt: 'White 2007 Mitsubishi Lancer ES sedan, front three-quarter view' },
      { file: '02.webp', alt: 'White 2007 Mitsubishi Lancer ES sedan, side view' },
      { file: '03.webp', alt: 'White 2007 Mitsubishi Lancer ES sedan, rear three-quarter view' },
      { file: '04.webp', alt: 'White 2007 Mitsubishi Lancer ES sedan, rear view' },
      { file: '05.webp', alt: 'White 2007 Mitsubishi Lancer ES sedan, front three-quarter view from the driver side' },
      { file: '06.webp', alt: 'White 2007 Mitsubishi Lancer ES sedan, dashboard' },
      { file: '07.webp', alt: 'White 2007 Mitsubishi Lancer ES sedan, steering wheel and instrument cluster' },
      { file: '08.webp', alt: 'White 2007 Mitsubishi Lancer ES sedan, cabin from the rear seat' },
    ],
  },
];
