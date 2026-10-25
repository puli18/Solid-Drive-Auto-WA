/**
 * Client providers for everything under /admin: theme (light/dark/system, admin-only storage key),
 * auth, and toasts. The `dark` class lives on <html> so portals (sheets, popovers) theme correctly;
 * it is removed again when the admin unmounts so the public site keeps its own look.
 */
import { ThemeProvider } from 'next-themes';
import { useEffect, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/auth';
import './admin.css';

function ThemeCleanup() {
  useEffect(() => () => document.documentElement.classList.remove('dark'), []);
  return null;
}

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" storageKey="sda-admin-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ThemeCleanup />
      <AuthProvider>
        <div className="sda-admin">{children}</div>
        <Toaster position="top-center" closeButton />
      </AuthProvider>
    </ThemeProvider>
  );
}
