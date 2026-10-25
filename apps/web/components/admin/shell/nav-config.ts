import {
  CalendarDays,
  CarFront,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  Settings,
  Store,
  Users,
  Wallet,
} from 'lucide-react';
import type { Role } from '@sda/shared';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role. 'admin' items are hidden from staff AND route-guarded (see AdminOnly). */
  role: Role;
  /** Shown in the phone bottom bar (max 4 + More). */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, role: 'staff', primary: true },
  { href: '/admin/cars', label: 'Cars', icon: CarFront, role: 'staff', primary: true },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarDays, role: 'staff', primary: true },
  { href: '/admin/enquiries', label: 'Enquiries', icon: Inbox, role: 'staff', primary: true },
  { href: '/admin/sales', label: 'Sales', icon: Receipt, role: 'staff' },
  { href: '/admin/vendors', label: 'Vendors', icon: Store, role: 'staff' },
  { href: '/admin/deposits', label: 'Deposits', icon: Wallet, role: 'admin' },
  { href: '/admin/reports', label: 'Reports', icon: FileSpreadsheet, role: 'admin' },
  { href: '/admin/users', label: 'Users', icon: Users, role: 'admin' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, role: 'admin' },
];

/** Route prefixes only an admin may open (route guard + nav filter share this list). */
export const ADMIN_ONLY_PREFIXES = NAV_ITEMS.filter((i) => i.role === 'admin').map((i) => i.href);

export function navFor(role: Role | null): NavItem[] {
  return NAV_ITEMS.filter((i) => i.role === 'staff' || role === 'admin');
}

export function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}
