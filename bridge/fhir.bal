// Placeholder identifier systems for this demo (not official Sri Lankan URIs)
const PHN_SYSTEM = "urn:healthbridge:lk:phn";

// ---------- Small helpers ----------

// "14/03/1985" -> "1985-03-14"
function dmyToIso(string dmy) returns string {
    string[] p = re `/`.split(dmy);
    return string `${p[2]}-${p[1]}-${p[0]}`;
}

// "05/09/2026 08:30" -> "2026-09-05T08:30:00+05:30"
function dmyTimeToIso(string value) returns string {
    string[] parts = re ` `.split(value);
    string time = parts.length() > 1 ? parts[1] : "00:00";
    return string `${dmyToIso(parts[0])}T${time}:00+05:30`;
}

// Both hospitals' test names -> one LOINC code
function lookupLab(string name) returns LabCode {
    match name {
        "FBS"|"Fasting Blood Sugar" => {
            return {loinc: "1558-6", display: "Fasting glucose [Mass/volume] in Serum or Plasma"};
        }
        "HBA1C" => {
            return {loinc: "4548-4", display: "Hemoglobin A1c/Hemoglobin.total in Blood"};
        }
        "LIPID-TC"|"Total Cholesterol" => {
            return {loinc: "2093-3", display: "Cholesterol [Mass/volume] in Serum or Plasma"};
        }
        "Serum Creatinine" => {
            return {loinc: "2160-0", display: "Creatinine [Mass/volume] in Serum or Plasma"};
        }
    }
    return {loinc: "", display: name};
}

function roundOne(decimal x) returns decimal {
    return (x * 10d).round() / 10d;
}

// Convert mmol/L to mg/dL so results from both hospitals can be compared
function normalise(string loinc, decimal value, string unit) returns [decimal, string] {
    if unit == "mmol/L" && loinc == "1558-6" {
        return [roundOne(value * 18.016d), "mg/dL"];
    }
    if unit == "mmol/L" && loinc == "2093-3" {
        return [roundOne(value * 38.67d), "mg/dL"];
    }
    return [value, unit];
}

// ---------- FHIR resources ----------

function encounter(string hospital, string hospitalName, string localId, string phn, string date,
        string department, string doctor, string diagnosis) returns json {
    return {
        resourceType: "Encounter",
        id: hospital + "-" + localId,
        meta: {"source": "urn:healthbridge:" + hospital},
        status: "finished",
        "class": {system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory"},
        subject: {reference: "Patient/" + phn},
        period: {"start": date},
        serviceType: {text: department},
        participant: [{individual: {display: doctor}}],
        reasonCode: [{text: diagnosis}],
        serviceProvider: {display: hospitalName}
    };
}

function observation(string hospital, string localId, string phn, string date,
        string originalName, decimal value, string unit) returns json {
    LabCode lab = lookupLab(originalName);
    [decimal, string] [v, u] = normalise(lab.loinc, value, unit);
    json codeConcept = lab.loinc == ""
        ? {text: originalName}
        : {coding: [{system: "http://loinc.org", code: lab.loinc, display: lab.display}], text: originalName};
    return {
        resourceType: "Observation",
        id: hospital + "-" + localId,
        meta: {"source": "urn:healthbridge:" + hospital},
        status: "final",
        category: [{coding: [{system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory"}]}],
        code: codeConcept,
        subject: {reference: "Patient/" + phn},
        effectiveDateTime: date,
        valueQuantity: {value: v, unit: u, system: "http://unitsofmeasure.org", code: u}
    };
}

function medicationRequest(string hospital, string localId, string phn, string date,
        string medication, string dosage) returns json {
    return {
        resourceType: "MedicationRequest",
        id: hospital + "-" + localId,
        meta: {"source": "urn:healthbridge:" + hospital},
        status: "active",
        intent: "order",
        medicationCodeableConcept: {text: medication},
        subject: {reference: "Patient/" + phn},
        authoredOn: date,
        dosageInstruction: [{text: dosage}]
    };
}

// ---------- Merge both hospitals into one FHIR Bundle ----------

function buildBundle(string phn, APatientFull? a, BData? b) returns json {
    TimelineEntry[] items = [];
    json[] identifiers = [{system: PHN_SYSTEM, value: phn}];
    string name = "";
    string gender = "unknown";
    string birthDate = "";
    string[] allergies = [];

    if a is APatientFull {
        identifiers.push({system: "urn:healthbridge:hospital-a:barcode", value: a.barcode});
        name = a.fullName;
        gender = a.gender == "M" ? "male" : (a.gender == "F" ? "female" : "unknown");
        birthDate = dmyToIso(a.dob);
        foreach string al in a.allergies {
            allergies.push(al);
        }

        map<string> visitDates = {};
        foreach AVisit v in a.visits {
            string date = dmyToIso(v.date);
            visitDates[v.visitId] = date;
            items.push({date, res: encounter("hospital-a", "Hospital A", v.visitId, phn, date,
                v.department, v.doctor, v.diagnosis)});
        }
        foreach ALab l in a.labs {
            string date = dmyTimeToIso(l.takenAt);
            items.push({date, res: observation("hospital-a", l.labId, phn, date, l.testCode, l.value, l.unit)});
        }
        foreach APrescription rx in a.prescriptions {
            string date = visitDates[rx.visitId] ?: "";
            items.push({date, res: medicationRequest("hospital-a", rx.rxId, phn, date,
                string `${rx.drug} ${rx.dose}`, string `${rx.dose} ${rx.frequency} for ${rx.days} days`)});
        }
    }

    if b is BData {
        BPatientFull p = b.patient;
        identifiers.push({system: "urn:healthbridge:hospital-b:mrn", value: p.mrn});
        if name == "" {
            name = p.firstName + " " + p.lastName;
        }
        if gender == "unknown" {
            gender = p.sex;
        }
        if birthDate == "" {
            birthDate = p.birthDate;
        }
        foreach string al in re `,`.split(p.allergyList) {
            if al.trim() != "" {
                allergies.push(al.trim());
            }
        }

        map<string> encounterDates = {};
        foreach BEncounter e in b.encounters {
            encounterDates[e.encounterNo] = e.startedAt;
            items.push({date: e.startedAt, res: encounter("hospital-b", "Hospital B", e.encounterNo, phn,
                e.startedAt, e.unit, e.consultant, e.primaryDiagnosis)});
        }
        foreach int i in 0 ..< b.labs.length() {
            BLab l = b.labs[i];
            items.push({date: l.date, res: observation("hospital-b", "lab-" + i.toString(), phn, l.date,
                l.test, l.result, l.units)});
        }
        foreach BMedication m in b.medications {
            string date = encounterDates[m.encounterNo] ?: "";
            items.push({date, res: medicationRequest("hospital-b", m.orderId, phn, date, m.medication, m.instructions)});
        }
    }

    json patient = {
        resourceType: "Patient",
        id: phn,
        identifier: identifiers,
        name: [{text: name}],
        gender,
        birthDate
    };

    json[] entry = [{"resource": patient}];

    string[] seen = [];
    foreach string al in allergies {
        if seen.indexOf(al) is () {
            seen.push(al);
            entry.push({"resource": {
                resourceType: "AllergyIntolerance",
                id: "allergy-" + seen.length().toString(),
                patient: {reference: "Patient/" + phn},
                code: {text: al}
            }});
        }
    }

    json[] timeline = from TimelineEntry e in items
        order by e.date descending
        select e.res;
    foreach json r in timeline {
        entry.push({"resource": r});
    }

    return {resourceType: "Bundle", "type": "collection", total: entry.length(), entry};
}