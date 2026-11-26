import ballerina/sql;

const int EMERGENCY_HOURS = 2;

type EmergencyRow record {|
    int id;
    string phn;
    string staffName;
    string reason;
    string startedAt;
    string endsAt;
|};

// Break-glass: a reason is required, access lasts a short time, and it is always logged
function startEmergencyAccess(string phn, string staffId, string staffName, string reason)
        returns EmergencyRow|error {
    if reason.trim().length() < 10 {
        return error("Please describe the emergency (at least 10 characters)");
    }
    int known = check db->queryRow(`SELECT COUNT(*) FROM patient_index WHERE phn = ${phn}`);
    if known == 0 {
        return error("No patient found with that PHN");
    }
    int id = check db->queryRow(`
        INSERT INTO emergency_access (phn, staff_id, staff_name, reason, ends_at, family_notified)
        VALUES (${phn}, ${staffId}, ${staffName}, ${reason},
                now() + make_interval(hours => ${EMERGENCY_HOURS}::int), false)
        RETURNING id`);
    EmergencyRow? row = check findActiveEmergency(phn, staffId);
    if row is () || row.id != id {
        return error("Emergency access was not saved");
    }
    return row;
}

function findActiveEmergency(string phn, string staffId) returns EmergencyRow?|error {
    stream<EmergencyRow, sql:Error?> rows = db->query(`
        SELECT id, phn, COALESCE(staff_name, staff_id) AS "staffName", reason,
               started_at::text AS "startedAt", ends_at::text AS "endsAt"
        FROM emergency_access
        WHERE phn = ${phn} AND staff_id = ${staffId} AND ends_at > now()
        ORDER BY started_at DESC
        LIMIT 1`);
    EmergencyRow[] list = check from EmergencyRow r in rows select r;
    return list.length() > 0 ? list[0] : ();
}

// For the patient's warning banner: emergency access in the last 30 days
function listEmergencyForPatient(string phn) returns EmergencyRow[]|error {
    stream<EmergencyRow, sql:Error?> rows = db->query(`
        SELECT id, phn, COALESCE(staff_name, staff_id) AS "staffName", reason,
               started_at::text AS "startedAt", ends_at::text AS "endsAt"
        FROM emergency_access
        WHERE phn = ${phn} AND started_at > now() - interval '30 days'
        ORDER BY started_at DESC`);
    return from EmergencyRow r in rows select r;
}

// Critical information only: the Patient (with blood group), allergies and medicines
function emergencySummary(string phn) returns json|error {
    json[] resources = check readTimeline(phn);
    json patient = ();
    json[] allergies = [];
    json[] medications = [];
    foreach json r in resources {
        map<json> m = check r.ensureType();
        string rt = m["resourceType"].toString();
        if rt == "Patient" {
            patient = r;
        } else if rt == "AllergyIntolerance" {
            allergies.push(r);
        } else if rt == "MedicationRequest" {
            medications.push(r);
        }
    }

    PrescriptionRow[] rx = check listPatientPrescriptions(phn);
    json[] ePrescriptions = from PrescriptionRow p in rx
        where p.status != "expired"
        select {id: p.id, medication: p.medication, dosage: p.dosage, status: p.status, date: p.createdAt};

    return {patient, allergies, medications, ePrescriptions};
}