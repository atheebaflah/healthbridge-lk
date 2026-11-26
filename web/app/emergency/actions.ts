'use server';

import { redirect } from 'next/navigation';
import { bridgeFetch, errorMessage } from '@/lib/bridge';

export async function startEmergency(formData: FormData) {
  const phn = String(formData.get('phn') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  const res = await bridgeFetch(`/api/emergency/${encodeURIComponent(phn)}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    redirect(`/emergency?error=${encodeURIComponent(errorMessage(await res.text()))}`);
  }
  redirect(`/emergency?phn=${encodeURIComponent(phn)}`);
}