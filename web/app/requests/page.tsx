import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { bridgeFetch, errorMessage, getAccessToken } from '@/lib/bridge';
import { scopeLabels } from '@/lib/fhir';
import { decide } from './actions';

type ConsentRow = {
  id: number;
  granteeName: string;
  scopes: string;
  status: string;
  durationDays: number;
  expiresAt?: string | null;
  createdAt: string;
};

function ActionButton({ id, action, label, style }: { id: number; action: string; label: string; style: string }) {
  return (
    <form action={decide}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={`rounded-lg px-4 py-2 text-sm font-medium ${style}`}>
        {label}
      </button>
    </form>
  );
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  if (!(await getAccessToken())) redirect('/');
  const { error } = await searchParams;

  const res = await bridgeFetch('/api/me/consents');
  if (!res.ok) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p>{errorMessage(await res.text())}</p>
        <Link href="/" className="text-teal-700">← Home</Link>
      </main>
    );
  }
  const consents: ConsentRow[] = await res.json();
  const pending = consents.filter((c) => c.status === 'pending');
  const active = consents.filter((c) => c.status === 'active');
  const past = consents.filter((c) => !['pending', 'active'].includes(c.status));

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/timeline" className="text-sm text-teal-700">← My timeline</Link>
      <h1 className="mt-2 text-2xl font-bold">Access requests</h1>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="mt-5">
        <h2 className="mb-2 font-semibold">Waiting for your answer ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-slate-500">No new requests.</p>}
        <ul className="flex flex-col gap-3">
          {pending.map((c) => (
            <li key={c.id} className="rounded-xl border-2 border-amber-200 bg-white p-4 shadow-sm">
              <p className="font-medium">{c.granteeName}</p>
              <p className="text-sm text-slate-600">
                wants to see your <strong>{scopeLabels(c.scopes).toLowerCase()}</strong> for {c.durationDays} days
              </p>
              <div className="mt-3 flex gap-2">
                <ActionButton id={c.id} action="approve" label="Approve" style="bg-teal-700 text-white" />
                <ActionButton id={c.id} action="deny" label="Deny" style="border border-slate-300" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">Who can see my records now</h2>
        {active.length === 0 && <p className="text-sm text-slate-500">Nobody has access right now.</p>}
        <ul className="flex flex-col gap-3">
          {active.map((c) => (
            <li key={c.id} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="font-medium">{c.granteeName}</p>
              <p className="text-sm text-slate-600">{scopeLabels(c.scopes)}</p>
              <p className="text-xs text-slate-500">Until {c.expiresAt?.slice(0, 16)}</p>
              <div className="mt-3">
                <ActionButton id={c.id} action="revoke" label="Revoke access" style="border border-red-300 text-red-700" />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold">History</h2>
          <ul className="flex flex-col gap-2">
            {past.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg bg-white px-4 py-2 text-sm shadow-sm">
                <span>{c.granteeName} · {scopeLabels(c.scopes)}</span>
                <span className="text-slate-500">{c.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/access-log" className="mt-6 inline-block text-sm font-medium text-teal-700">
        See who viewed my records →
      </Link>
    </main>
  );
}