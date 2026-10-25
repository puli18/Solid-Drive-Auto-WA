/**
 * Client providers for everything under /admin: theme (light/dark/system, admin-only storage key),
 * auth, and toasts (theme: local provider in ./theme). The `dark` class lives on <html> so portals (sheets, popovers) theme correctly;
 * it is removed again when the admin unmounts so the public site keeps its own look.
 */
import { useEffect, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from './theme';
import './admin.css';

function ThemeCleanup() {
  useEffect(() => () => document.documentElement.classList.remove('dark'), []);
  return null;
}

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider storageKey="sda-admin-theme" defaultTheme="system">
      <ThemeCleanup />
      <AuthProvider>
        <div className="sda-admin">{children}</div>
        <Toaster position="top-center" closeButton />
      </AuthProvider>
    </ThemeProvider>
  );
}
