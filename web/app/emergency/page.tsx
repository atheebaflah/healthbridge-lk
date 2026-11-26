import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { bridgeFetch, errorMessage, getAccessToken } from '@/lib/bridge';
import { bloodGroup, hospitalName, type FhirResource } from '@/lib/fhir';
import { startEmergency } from './actions';

type EmergencyData = {
  access: { staffName: string; reason: string; startedAt: string; endsAt: string };
  summary: {
    patient: FhirResource | null;
    allergies: FhirResource[];
    medications: FhirResource[];
    ePrescriptions: { id: string; medication: string; dosage: string; status: string; date: string }[];
  };
};

export default async function EmergencyPage({
  searchParams,
}: {
  searchParams: Promise<{ phn?: string; error?: string }>;
}) {
  await connection();
  if (!(await getAccessToken())) redirect('/');

  const meRes = await bridgeFetch('/api/me');
  const me: { name?: string; roles?: string[] } = meRes.ok ? await meRes.json() : {};
  if (!me.roles?.includes('emergency')) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p>This page is only for emergency staff.</p>
        <Link href="/" className="text-teal-700">← Home</Link>
      </main>
    );
  }

  const { phn, error } = await searchParams;
  let data: EmergencyData | null = null;
  let loadError = '';
  if (phn) {
    const res = await bridgeFetch(`/api/emergency/${encodeURIComponent(phn)}`);
    if (res.ok) data = await res.json();
    else loadError = errorMessage(await res.text());
  }

  const patient = data?.summary.patient ?? undefined;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-teal-700">← Home</Link>
      <h1 className="mt-2 text-2xl font-bold text-red-700">Emergency access</h1>
      <p className="text-sm text-slate-500">Signed in as {me.name || 'emergency staff'}</p>

      {!data && (
        <section className="mt-6 rounded-xl border-2 border-red-200 bg-white p-5 shadow-sm">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            Use only when the patient cannot give consent. Access lasts 2 hours, shows critical information only,
            and is recorded and shown to the patient.
          </p>
          {(error || loadError) && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{error || loadError}</p>
          )}
          <form action={startEmergency} className="mt-4 flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              Patient PHN
              <input
                name="phn"
                required
                pattern="[0-9]{11}"
                title="11 digits"
                defaultValue={phn}
                placeholder="e.g. 09900000011"
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              Reason (required)
              <textarea
                name="reason"
                required
                minLength={10}
                rows={3}
                placeholder="e.g. Unconscious after road accident, admitted to ETU"
                className="rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-lg bg-red-700 px-4 py-2 font-medium text-white">
              Start emergency access
            </button>
          </form>
        </section>
      )}

      {data && (
        <>
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            Emergency access until {data.access.endsAt.slice(0, 16)} · Reason: {data.access.reason}
          </p>

          <section className="mt-4 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">{patient?.name?.[0]?.text}</h2>
            <p className="text-sm text-slate-500">
              PHN {phn} · Born {patient?.birthDate} · {patient?.gender}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Blood group</p>
                <p className="text-2xl font-bold">{bloodGroup(patient) ?? 'Unknown'}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs text-red-700">Allergies</p>
                <p className="text-lg font-bold text-red-800">
                  {data.summary.allergies.length > 0
                    ? data.summary.allergies.map((a) => a.code?.text).join(', ')
                    : 'None recorded'}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Medicines</h2>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {data.summary.ePrescriptions.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span><strong>{p.medication}</strong> · {p.dosage}</span>
                  <span className="text-slate-500">e-prescription · {p.date.slice(0, 10)}</span>
                </li>
              ))}
              {data.summary.medications.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span>
                    <strong>{m.medicationCodeableConcept?.text}</strong> · {m.dosageInstruction?.[0]?.text}
                  </span>
                  <span className="text-slate-500">{hospitalName(m)} · {m.authoredOn?.slice(0, 10)}</span>
                </li>
              ))}
              {data.summary.ePrescriptions.length === 0 && data.summary.medications.length === 0 && (
                <li className="text-slate-500">No medicines recorded.</li>
              )}
            </ul>
          </section>

          <Link href="/emergency" className="mt-4 inline-block text-sm font-medium text-teal-700">
            Another patient →
          </Link>
        </>
      )}
    </main>
  );
}