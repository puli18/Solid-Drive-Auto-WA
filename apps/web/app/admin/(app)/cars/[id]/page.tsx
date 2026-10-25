import { useParams } from 'react-router';
import { CarEditor } from '@/components/admin/cars/car-editor';

export default function AdminCarPage() {
  const { id = '' } = useParams();
  return <CarEditor key={id} id={id} />;
}
