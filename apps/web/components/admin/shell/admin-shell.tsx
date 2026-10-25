/**
 * Authenticated admin chrome: near-black sidebar (desktop), top bar, phone bottom bar + "More" drawer.
 * Auth guard: no user / no role claim → /admin/login. Staff hitting an admin-only route see a
 * "no access" state (pages also wrap themselves in <AdminOnly>, so nothing admin-only is ever fetched).
 */
import { MoreHorizontal } from 'lucide-react';
import Link from '@/components/link';
import { usePathname, useRouter } from '@/lib/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { DemoBanner } from '@/components/demo/demo-banner';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ConfirmProvider } from '../confirm';
import { useRepo } from '../use-data';
import { BrandMark } from './brand-mark';
import { isActive, type NavItem, navFor } from './nav-config';
import { UserMenu } from './user-menu';

function useNewEnquiryCount(enabled: boolean) {
  const { data } = useRepo(enabled ? (r) => r.listEnquiries() : null, [enabled]);
  return data?.filter((e) => e.status === 'new').length ?? 0;
}

function DemoRoleSwitch({ className }: { className?: string }) {
  const { demo, role, switchDemoRole } = useAuth();
  if (!demo || !role) return null;
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={role}
      onValueChange={(v) => v && switchDemoRole(v as 'admin' | 'staff')}
      aria-label="Preview as role"
      className={className}
    >
      <ToggleGroupItem value="admin" className="px-3 text-xs">
        Admin
      </ToggleGroupItem>
      <ToggleGroupItem value="staff" className="px-3 text-xs">
        Staff
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function NavList({ items, pathname, badge, onNavigate }: { items: NavItem[]; pathname: string; badge: number; onNavigate?: () => void }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={item.label}
              className={cn(
                'h-9 text-[13px] text-white/70 hover:text-white',
                active && 'text-white! relative before:absolute before:inset-y-2 before:-left-2 before:w-0.5 before:rounded-full before:bg-primary',
              )}
            >
              <Link href={item.href} onClick={onNavigate}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
            {item.href === '/admin/enquiries' && badge > 0 && (
              <SidebarMenuBadge className="bg-primary text-primary-foreground rounded-full px-1.5 text-[11px]">{badge}</SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function AppSidebar({ pathname, badge }: { pathname: string; badge: number }) {
  const { role } = useAuth();
  const items = navFor(role);
  const main = items.filter((i) => i.role === 'staff');
  const admin = items.filter((i) => i.role === 'admin');
  return (
    <Sidebar collapsible="icon" className="dark [&_[data-slot=sidebar-inner]]:bg-brand-black border-r-white/10!">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link href="/admin" className="flex items-center gap-2 overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandMark className="shrink-0 group-data-[collapsible=icon]:w-8" />
          <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block font-display text-sm font-bold tracking-tight text-white">Solid Drive</span>
            <span className="block text-[11px] text-white/50">Dealer admin</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavList items={main} pathname={pathname} badge={badge} />
          </SidebarGroupContent>
        </SidebarGroup>
        {admin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/40">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavList items={admin} pathname={pathname} badge={badge} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="px-3 pb-4 text-[11px] text-white/40 group-data-[collapsible=icon]:hidden">
        <a href="/" target="_blank" rel="noreferrer" className="hover:text-white/80">
          View public site ↗
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}

function BottomNav({ pathname, badge }: { pathname: string; badge: number }) {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const items = navFor(role);
  const primary = items.filter((i) => i.primary);
  const rest = items.filter((i) => !i.primary);
  const moreActive = rest.some((i) => isActive(pathname, i.href));

  return (
    <>
      <nav
        aria-label="Main"
        className="dark bg-brand-black/95 text-foreground pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-white/55 transition-colors',
                    active && 'text-white',
                  )}
                >
                  {active && <span className="bg-primary absolute top-0 h-0.5 w-8 rounded-full" />}
                  <span className="relative">
                    <item.icon className="size-5" />
                    {item.href === '/admin/enquiries' && badge > 0 && (
                      <span className="bg-primary absolute -top-1 -right-2 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 text-white">
                        {badge}
                      </span>
                    )}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                'relative flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-white/55',
                moreActive && 'text-white',
              )}
            >
              {moreActive && <span className="bg-primary absolute top-0 h-0.5 w-8 rounded-full" />}
              <MoreHorizontal className="size-5" />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="sda-admin">
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base">More</DrawerTitle>
          </DrawerHeader>
          <ul className="grid grid-cols-3 gap-2 px-4 pb-6">
            {rest.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'bg-muted/60 flex h-20 flex-col items-center justify-center gap-2 rounded-lg text-xs font-medium',
                    isActive(pathname, item.href) && 'ring-primary ring-2',
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t px-4 py-3 pb-safe">
            <span className="text-muted-foreground text-xs">Preview as</span>
            <DemoRoleSwitch />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="bg-brand-black hidden w-64 md:block" />
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, role, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const signedIn = !!user && !!role;
  const badge = useNewEnquiryCount(signedIn);

  useEffect(() => {
    if (loading) return;
    if (user && !role) {
      // Signed in but no role claim (deactivated / never invited) – treat as signed out.
      void signOut();
      router.replace('/admin/login?reason=no-access');
      return;
    }
    if (!user) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, role, pathname, router, signOut]);

  // Move focus to the page on route change (screen readers), without scrolling.
  useEffect(() => {
    document.getElementById('admin-main')?.focus({ preventScroll: true });
  }, [pathname]);

  if (loading || !signedIn) return <ShellSkeleton />;

  return (
    <ConfirmProvider>
    <SidebarProvider>
      <AppSidebar pathname={pathname} badge={badge} />
      <SidebarInset className="min-w-0">
        <DemoBanner />
        <header className="bg-background/90 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur md:px-4">
          <SidebarTrigger className="hidden md:inline-flex" />
          <Link href="/admin" className="dark bg-brand-black -ml-1 rounded-md px-1 md:hidden" aria-label="Overview">
            <BrandMark className="h-8 w-12" />
          </Link>
          <div className="flex-1" />
          <DemoRoleSwitch className="hidden sm:flex" />
          <UserMenu />
        </header>
        <div id="admin-main" tabIndex={-1} className="flex-1 px-4 pt-5 pb-24 outline-none md:px-6 md:pb-10 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </div>
      </SidebarInset>
      <BottomNav pathname={pathname} badge={badge} />
    </SidebarProvider>
    </ConfirmProvider>
  );
}
