import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { bridgeFetch, errorMessage, getAccessToken } from '@/lib/bridge';
import QrScanner from './QrScanner';
import { dispense } from './actions';

type Rx = {
  id: string;
  doctorName: string;
  medication: string;
  dosage: string;
  quantity?: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  dispensedAt?: string | null;
  pharmacyName?: string | null;
};

export default async function PharmacyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  await connection();
  if (!(await getAccessToken())) redirect('/');

  const meRes = await bridgeFetch('/api/me');
  const me: { name?: string; roles?: string[] } = meRes.ok ? await meRes.json() : {};
  if (!me.roles?.includes('pharmacist')) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p>This page is only for pharmacies.</p>
        <Link href="/" className="text-teal-700">← Home</Link>
      </main>
    );
  }

  const { token, done, error } = await searchParams;
  let rx: Rx | null = null;
  let patient = '';
  let lookupError = '';
  if (token) {
    const res = await bridgeFetch(`/api/pharmacy/prescriptions/${encodeURIComponent(token)}`);
    if (res.ok) {
      const data: { prescription: Rx; patientName: string } = await res.json();
      rx = data.prescription;
      patient = data.patientName;
    } else {
      lookupError = errorMessage(await res.text());
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-teal-700">← Home</Link>
      <h1 className="mt-2 text-2xl font-bold">Pharmacy</h1>
      <p className="text-sm text-slate-500">Signed in as {me.name || 'pharmacist'}</p>

      {!token && (
        <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Scan the patient&apos;s prescription QR code</h2>
          <QrScanner />
          <form action="/pharmacy" className="mt-4 flex gap-2 text-sm">
            <input name="token" required placeholder="…or paste the code" className="flex-1 rounded-lg border border-slate-300 px-3 py-2" />
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white">Look up</button>
          </form>
        </section>
      )}

      {token && (
        <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
          {lookupError && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{lookupError}</p>}

          {rx && (
            <>
              <p className="text-sm text-slate-500">Patient</p>
              <p className="text-lg font-semibold">{patient}</p>

              <p className="mt-4 text-sm text-slate-500">Prescription {rx.id}</p>
              <p className="text-xl font-bold">{rx.medication}</p>
              <p className="text-slate-700">
                {rx.dosage}
                {rx.quantity ? ` · ${rx.quantity}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                By {rx.doctorName} on {rx.createdAt.slice(0, 10)} · valid until {rx.expiresAt.slice(0, 10)}
              </p>

              {done && <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-green-800">Dispensed. ✓</p>}
              {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}

              {rx.status === 'active' ? (
                <form action={dispense} className="mt-4">
                  <input type="hidden" name="token" value={token} />
                  <button type="submit" className="w-full rounded-lg bg-teal-700 px-4 py-3 font-medium text-white">
                    Dispense
                  </button>
                </form>
              ) : (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                  {rx.status === 'dispensed'
                    ? `Already dispensed by ${rx.pharmacyName} on ${rx.dispensedAt?.slice(0, 16)}. Do not dispense again.`
                    : `This prescription is ${rx.status}.`}
                </p>
              )}
            </>
          )}

          <Link href="/pharmacy" className="mt-4 inline-block text-sm font-medium text-teal-700">Scan another →</Link>
        </section>
      )}
    </main>
  );
}