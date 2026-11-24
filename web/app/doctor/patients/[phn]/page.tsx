import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { bridgeFetch, errorMessage, getAccessToken } from '@/lib/bridge';
import { describe, hospitalName, scopeLabels, type FhirBundle } from '@/lib/fhir';

export default async function PatientRecordsPage({ params }: { params: Promise<{ phn: string }> }) {
  await connection();
  if (!(await getAccessToken())) redirect('/');
  const { phn } = await params;

  const res = await bridgeFetch(`/api/patients/${encodeURIComponent(phn)}/records`);
  if (!res.ok) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link href="/doctor" className="text-sm text-teal-700">← Doctor portal</Link>
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-red-700">
          {res.status === 403
            ? "You don't have active consent to view this patient's records."
            : `Could not load records: ${errorMessage(await res.text())}`}
        </p>
      </main>
    );
  }

  const bundle: FhirBundle = await res.json();
  const resources = bundle.entry.map((e) => e.resource);
  const patient = resources.find((r) => r.resourceType === 'Patient');
  const allergies = resources.filter((r) => r.resourceType === 'AllergyIntolerance');
  const events = resources.filter((r) => !['Patient', 'AllergyIntolerance'].includes(r.resourceType));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/doctor" className="text-sm text-teal-700">← Doctor portal</Link>

      {bundle.consent && (
        <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          Shared by the patient: {scopeLabels(bundle.consent.scopes)} · until {bundle.consent.expiresAt?.slice(0, 16)}
        </p>
      )}

      <section className="mt-3 rounded-xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold">{patient?.name?.[0]?.text}</h1>
        <p className="text-sm text-slate-500">PHN {phn} · Born {patient?.birthDate}</p>
        {allergies.length > 0 && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Allergies: {allergies.map((a) => a.code?.text).join(', ')}
          </p>
        )}
      </section>

      <h2 className="mt-6 mb-2 font-semibold">Shared records</h2>
      {events.length === 0 && <p className="text-sm text-slate-500">No records of the shared types.</p>}
      <ul className="flex flex-col gap-3">
        {events.map((r) => {
          const d = describe(r);
          return (
            <li key={`${r.resourceType}-${r.id}`} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{d.label} · {d.date?.slice(0, 10)}</span>
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-800">{hospitalName(r)}</span>
              </div>
              <p className="mt-1 font-medium">{d.title}</p>
              {d.detail && <p className="text-sm text-slate-600">{d.detail}</p>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}