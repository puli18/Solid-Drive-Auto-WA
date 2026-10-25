import type { Metadata } from '@/lib/meta';
import { Suspense } from 'react';
import { LoginScreen } from '@/components/admin/login/login-screen';

export const metadata: Metadata = { title: 'Sign in' };

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
