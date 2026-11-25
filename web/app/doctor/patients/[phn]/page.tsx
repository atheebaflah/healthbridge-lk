import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { bridgeFetch, errorMessage, getAccessToken } from '@/lib/bridge';
import { describe, hospitalName, scopeLabels, type FhirBundle } from '@/lib/fhir';
import { prescribe } from './actions';

export default async function PatientRecordsPage({
    params,
    searchParams,
}: {
    params: Promise<{ phn: string }>;
    searchParams: Promise<{ rx?: string; error?: string }>;
}) {
    await connection();
    if (!(await getAccessToken())) redirect('/');
    const { phn } = await params;
    const { rx, error } = await searchParams;

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
            <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
                <h2 className="font-semibold">Write a prescription</h2>
                {rx && (
                    <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                        Prescription {rx} sent to the patient&apos;s app.
                    </p>
                )}
                {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <form action={prescribe} className="mt-3 grid gap-3 text-sm">
                    <input type="hidden" name="phn" value={phn} />
                    <label className="flex flex-col gap-1">
                        Medicine
                        <input name="medication" required placeholder="e.g. Metformin 500 mg" className="rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <label className="flex flex-col gap-1">
                        Dosage instructions
                        <input name="dosage" required placeholder="e.g. 1 tablet twice daily after meals" className="rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1">
                            Quantity
                            <input name="quantity" placeholder="e.g. 60 tablets" className="rounded-lg border border-slate-300 px-3 py-2" />
                        </label>
                        <label className="flex flex-col gap-1">
                            Valid for (days)
                            <input name="validDays" type="number" min="1" max="90" defaultValue="30" className="rounded-lg border border-slate-300 px-3 py-2" />
                        </label>
                    </div>
                    <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 font-medium text-white">Send prescription</button>
                </form>
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