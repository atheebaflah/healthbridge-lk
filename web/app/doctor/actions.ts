'use server';

import { redirect } from 'next/navigation';
import { bridgeFetch, errorMessage } from '@/lib/bridge';

export async function requestAccess(formData: FormData) {
  const phn = String(formData.get('phn') ?? '').trim();
  const scopes = formData.getAll('scopes').map(String);
  const durationDays = Number(formData.get('durationDays') ?? 7);

  const res = await bridgeFetch('/api/consents', {
    method: 'POST',
    body: JSON.stringify({ phn, scopes, durationDays }),
  });

  if (!res.ok) {
    redirect(`/doctor?error=${encodeURIComponent(errorMessage(await res.text()))}`);
  }
  redirect('/doctor?sent=1');
}