import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { bridgeFetch, errorMessage, getAccessToken } from '@/lib/bridge';
import QrCode from './QrCode';

type Rx = {
  id: string;
  doctorName: string;
  medication: string;
  dosage: string;
  quantity?: string | null;
  qrToken: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  dispensedAt?: string | null;
  pharmacyName?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-50 text-green-800',
  dispensed: 'bg-slate-100 text-slate-600',
  expired: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-700',
};

export default async function PrescriptionsPage() {
  await connection();
  if (!(await getAccessToken())) redirect('/');

  const res = await bridgeFetch('/api/me/prescriptions');
  if (!res.ok) {
    return <main className="mx-auto max-w-md p-6">{errorMessage(await res.text())}</main>;
  }
  const list: Rx[] = await res.json();

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/timeline" className="text-sm text-teal-700">← My timeline</Link>
      <h1 className="mt-2 text-2xl font-bold">My prescriptions</h1>
      <p className="text-sm text-slate-500">Show the QR code at any pharmacy. Each one can be used once.</p>

      {list.length === 0 && <p className="mt-4 text-sm text-slate-500">No prescriptions yet.</p>}
      <ul className="mt-4 flex flex-col gap-3">
        {list.map((rx) => (
          <li key={rx.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{rx.medication}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[rx.status] ?? ''}`}>{rx.status}</span>
            </div>
            <p className="text-sm text-slate-600">
              {rx.dosage}
              {rx.quantity ? ` · ${rx.quantity}` : ''}
            </p>
            <p className="text-xs text-slate-500">
              {rx.doctorName} · {rx.createdAt.slice(0, 10)} · {rx.id}
            </p>

            {rx.status === 'active' && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <QrCode value={rx.qrToken} />
                <p className="text-xs text-slate-500">Valid until {rx.expiresAt.slice(0, 10)}</p>
                <code className="break-all text-[10px] text-slate-400">{rx.qrToken}</code>
              </div>
            )}
            {rx.status === 'dispensed' && (
              <p className="mt-2 text-xs text-slate-500">
                Dispensed by {rx.pharmacyName} on {rx.dispensedAt?.slice(0, 16)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}