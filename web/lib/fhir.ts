export type FhirResource = {
  resourceType: string;
  id: string;
  meta?: { source?: string };
  identifier?: { system?: string; value?: string }[];
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
    extension?: { url?: string; valueString?: string }[];
};

export type FhirBundle = {
  entry: { resource: FhirResource }[];
  consent?: { scopes: string; expiresAt?: string | null };
};

export function describe(r: FhirResource) {
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

export function hospitalName(r: FhirResource) {
  const src = r.meta?.source?.replace('urn:healthbridge:', '') ?? '';
  return src === 'hospital-a' ? 'Hospital A' : src === 'hospital-b' ? 'Hospital B' : src;
}

export const SCOPES = [
  { value: 'labs', label: 'Lab results' },
  { value: 'medications', label: 'Medicines' },
  { value: 'visits', label: 'Visits & diagnoses' },
  { value: 'allergies', label: 'Allergies' },
];

export function scopeLabels(csv: string) {
  return csv
    .split(',')
    .map((s) => SCOPES.find((x) => x.value === s)?.label ?? s)
    .join(', ');
}
export function bloodGroup(patient?: FhirResource) {
  return patient?.extension?.find((e) => e.url === 'urn:healthbridge:blood-group')?.valueString;
}