'use server';

import { redirect } from 'next/navigation';
import { bridgeFetch, errorMessage } from '@/lib/bridge';

export async function dispense(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const res = await bridgeFetch(`/api/pharmacy/prescriptions/${encodeURIComponent(token)}/dispense`, {
    method: 'POST',
  });
  const back = `/pharmacy?token=${encodeURIComponent(token)}`;
  if (!res.ok) {
    redirect(`${back}&error=${encodeURIComponent(errorMessage(await res.text()))}`);
  }
  redirect(`${back}&done=1`);
}