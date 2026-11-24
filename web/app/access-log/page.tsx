import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { bridgeFetch, errorMessage, getAccessToken } from '@/lib/bridge';
import { scopeLabels } from '@/lib/fhir';

type LogRow = {
  actorName: string;
  actorRole: string;
  action: string;
  resourceTypes?: string | null;
  decision: string;
  reason?: string | null;
  at: string;
};

export default async function AccessLogPage() {
  await connection();
  if (!(await getAccessToken())) redirect('/');

  const res = await bridgeFetch('/api/me/access-log');
  if (!res.ok) {
    return <main className="mx-auto max-w-md p-6">{errorMessage(await res.text())}</main>;
  }
  const rows: LogRow[] = await res.json();

  return (
    <main className="mx-auto max-w-md p-4">
      <Link href="/requests" className="text-sm text-teal-700">← Access requests</Link>
      <h1 className="mt-2 text-2xl font-bold">Who viewed my records</h1>
      <p className="text-sm text-slate-500">Every attempt is recorded, including blocked ones.</p>

      {rows.length === 0 && <p className="mt-4 text-sm text-slate-500">Nobody has tried to view your records yet.</p>}
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.actorName}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  r.decision === 'allow' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
                }`}
              >
                {r.decision === 'allow' ? 'Allowed' : 'Blocked'}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              {r.decision === 'allow' ? `Viewed: ${scopeLabels(r.resourceTypes ?? '')}` : r.reason ?? 'Access denied'}
            </p>
            <p className="text-xs text-slate-500">{r.at.slice(0, 16)}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}