'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { bridgeFetch, errorMessage } from '@/lib/bridge';

// action = approve | deny | revoke
export async function decide(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const action = String(formData.get('action') ?? '');

  const res = await bridgeFetch(`/api/me/consents/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
    method: 'POST',
  });
  if (!res.ok) {
    redirect(`/requests?error=${encodeURIComponent(errorMessage(await res.text()))}`);
  }
  revalidatePath('/requests');
  redirect('/requests');
}