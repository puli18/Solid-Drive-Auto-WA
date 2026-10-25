import { useLocation } from 'react-router';
import { ReceiptRedirect } from '@/components/admin/receipts/receipt-redirect';

const PREFIX = '/admin/receipts/';

export default function AdminReceiptPage() {
  const { pathname } = useLocation();
  const path = pathname.startsWith(PREFIX) ? pathname.slice(PREFIX.length).split('/').filter(Boolean) : [];
  return <ReceiptRedirect path={path.map(decodeURIComponent).join('/')} />;
}
