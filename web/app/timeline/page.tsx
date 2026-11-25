import { connection } from 'next/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asgardeo } from '@asgardeo/nextjs/server';

type FhirResource = {
    resourceType: string;
    id: string;
    meta?: { source?: string };
    name?: { text?: string }[];
    birthDate?: string;
    gender?: string;
    code?: { text?: string };
    effectiveDateTime?: string;
    valueQuantity?: { value?: number; unit?: string };
    authoredOn?: string;
    medicationCodeableConcept?: { text?: string };
    dosageInstruction?: { text?: string }[];
    period?: { start?: string };
    serviceType?: { text?: string };
    participant?: { individual?: { display?: string } }[];
    reasonCode?: { text?: string }[];
    identifier?: { system?: string; value?: string }[];
};

const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://localhost:9090';

function describe(r: FhirResource) {
    switch (r.resourceType) {
        case 'Encounter':
            return {
                label: 'Visit',
                date: r.period?.start,
                title: r.reasonCode?.[0]?.text ?? 'Visit',
                detail: [r.serviceType?.text, r.participant?.[0]?.individual?.display].filter(Boolean).join(' · '),
            };
        case 'Observation':
            return {
                label: 'Lab result',
                date: r.effectiveDateTime,
                title: r.code?.text ?? 'Lab test',
                detail: `${r.valueQuantity?.value ?? ''} ${r.valueQuantity?.unit ?? ''}`,
            };
        case 'MedicationRequest':
            return {
                label: 'Medicine',
                date: r.authoredOn,
                title: r.medicationCodeableConcept?.text ?? 'Medicine',
                detail: r.dosageInstruction?.[0]?.text ?? '',
            };
        default:
            return { label: r.resourceType, date: undefined, title: r.id, detail: '' };
    }
}

function hospitalName(r: FhirResource) {
    const src = r.meta?.source?.replace('urn:healthbridge:', '') ?? '';
    return src === 'hospital-a' ? 'Hospital A' : src === 'hospital-b' ? 'Hospital B' : src;
}

export default async function TimelinePage() {
    await connection();
    const client = await asgardeo();
    const sessionId = await client.getSessionId();
    if (!sessionId) redirect('/');

    let accessToken: string;
    try {
        accessToken = await client.getAccessToken(sessionId);
    } catch (e) {
        console.error('[timeline] getAccessToken failed:', e);
        return <main className="p-6">Your session expired. Please sign out and sign in again.</main>;
    }
    // A JWT always starts with "eyJ"; this prints only the first few characters, never the whole token
    console.log('[timeline] token starts with:', accessToken?.slice(0, 10));

    const res = await fetch(`${BRIDGE_URL}/api/me/timeline`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
    });
    const text = await res.text();
    console.log('[timeline] bridge status:', res.status, '| body length:', text.length);

    if (res.status === 403) {
        return (
            <main className="mx-auto max-w-md p-6">
                <p>Your account isn&apos;t linked to a patient record (no PHN or no patient role).</p>
                <Link href="/" className="text-teal-700">← Home</Link>
            </main>
        );
    }
    if (!res.ok || !text) {
        return <main className="p-6">Could not load records (bridge returned {res.status}): {text || '(empty response)'}</main>;
    }

    const bundle: { entry: { resource: FhirResource }[] } = JSON.parse(text);
    const resources = bundle.entry.map((e) => e.resource);
    const patient = resources.find((r) => r.resourceType === 'Patient');
    const allergies = resources.filter((r) => r.resourceType === 'AllergyIntolerance');
    const events = resources.filter((r) => !['Patient', 'AllergyIntolerance'].includes(r.resourceType));

    return (
        <main className="mx-auto max-w-md p-4">
            <Link href="/" className="text-sm text-teal-700">← Home</Link>

            <section className="mt-3 rounded-xl bg-white p-4 shadow-sm">
                <h1 className="text-xl font-bold">{patient?.name?.[0]?.text}</h1>
                <p className="text-sm text-slate-500">
                    PHN {patient?.identifier?.find((i) => i.system === 'urn:healthbridge:lk:phn')?.value} · Born {patient?.birthDate}
                </p>
                {allergies.length > 0 && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        Allergies: {allergies.map((a) => (a as { code?: { text?: string } }).code?.text).join(', ')}
                    </p>
                )}
            </section>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <Link href="/requests" className="font-medium text-teal-700">Access requests</Link>
            <Link href="/access-log" className="font-medium text-teal-700">Who viewed my records</Link>
            <Link href="/prescriptions" className="font-medium text-teal-700">My prescriptions</Link>
            </div>

            <h2 className="mt-6 mb-2 font-semibold">Timeline</h2>
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