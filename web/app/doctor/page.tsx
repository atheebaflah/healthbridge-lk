import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { bridgeFetch, getAccessToken } from '@/lib/bridge';
import { SCOPES, scopeLabels } from '@/lib/fhir';
import { requestAccess } from './actions';

type ConsentRow = {
  id: number;
  phn: string;
  scopes: string;
  status: string;
  durationDays: number;
  expiresAt?: string | null;
  createdAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800',
  active: 'bg-green-50 text-green-800',
  denied: 'bg-red-50 text-red-700',
  revoked: 'bg-slate-100 text-slate-600',
  expired: 'bg-slate-100 text-slate-600',
};

export default async function DoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  await connection();
  if (!(await getAccessToken())) redirect('/');

  const meRes = await bridgeFetch('/api/me');
  const me: { name?: string; roles?: string[] } = meRes.ok ? await meRes.json() : {};
  if (!me.roles?.includes('doctor')) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p>This page is only for doctors.</p>
        <Link href="/" className="text-teal-700">← Home</Link>
      </main>
    );
  }

  const { error, sent } = await searchParams;
  const reqRes = await bridgeFetch('/api/doctor/requests');
  const requests: ConsentRow[] = reqRes.ok ? await reqRes.json() : [];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-teal-700">← Home</Link>
      <h1 className="mt-2 text-2xl font-bold">Doctor portal</h1>
      <p className="text-sm text-slate-500">Signed in as {me.name || 'doctor'}</p>

      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Request access to a patient&apos;s records</h2>

        {sent && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            Request sent. The patient will see it in their app.
          </p>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <form action={requestAccess} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Patient PHN
            <input
              name="phn"
              required
              pattern="[0-9]{11}"
              title="11 digits"
              placeholder="e.g. 09900000011"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <fieldset className="text-sm">
            <legend className="mb-1">Records needed</legend>
            <div className="grid grid-cols-2 gap-2">
              {SCOPES.map((s) => (
                <label key={s.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={s.value}
                    defaultChecked={s.value === 'labs' || s.value === 'medications'}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            For how long
            <select name="durationDays" defaultValue="7" className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </label>

          <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white">
            Send request
          </button>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 font-semibold">My requests</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-500">No requests yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">PHN {r.phn}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[r.status] ?? ''}`}>{r.status}</span>
                </div>
                <p className="text-sm text-slate-600">
                  {scopeLabels(r.scopes)} · {r.durationDays} days
                </p>
                {r.status === 'active' && (
                  <>
                    <p className="text-xs text-slate-500">Access until {r.expiresAt?.slice(0, 16)}</p>
                    <Link href={`/doctor/patients/${r.phn}`} className="mt-2 inline-block text-sm font-medium text-teal-700">
                      View records →
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}