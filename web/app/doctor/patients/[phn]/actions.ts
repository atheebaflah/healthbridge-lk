'use server';

import { redirect } from 'next/navigation';
import { bridgeFetch, errorMessage } from '@/lib/bridge';

export async function prescribe(formData: FormData) {
  const phn = String(formData.get('phn') ?? '');
  const quantity = String(formData.get('quantity') ?? '').trim();

  const res = await bridgeFetch('/api/prescriptions', {
    method: 'POST',
    body: JSON.stringify({
      phn,
      medication: String(formData.get('medication') ?? '').trim(),
      dosage: String(formData.get('dosage') ?? '').trim(),
      quantity: quantity || null,
      validDays: Number(formData.get('validDays') ?? 30),
    }),
  });

  const back = `/doctor/patients/${encodeURIComponent(phn)}`;
  if (!res.ok) {
    redirect(`${back}?error=${encodeURIComponent(errorMessage(await res.text()))}`);
  }
  const created: { id: string } = await res.json();
  redirect(`${back}?rx=${encodeURIComponent(created.id)}`);
}