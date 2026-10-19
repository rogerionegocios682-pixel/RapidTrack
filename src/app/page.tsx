import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/** A raiz encaminha para o dashboard (ou login, se não houver sessão). */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? '/dashboard' : '/login');
}
