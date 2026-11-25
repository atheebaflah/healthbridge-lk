import ballerina/sql;
import ballerina/uuid;

type PrescriptionRow record {|
    string id;
    string phn;
    string doctorName;
    string medication;
    string dosage;
    string? quantity;
    string qrToken;
    string status;
    string createdAt;
    string expiresAt;
    string? dispensedAt;
    string? pharmacyName;
|};

// Doctor writes a prescription. The QR token is a random UUID, so it can't be guessed.
function createPrescription(string phn, string doctorId, string doctorName, string medication,
        string dosage, string? quantity, int validDays) returns PrescriptionRow|error {
    if medication.trim() == "" || dosage.trim() == "" {
        return error("Medicine and dosage are required");
    }
    if validDays < 1 || validDays > 90 {
        return error("Valid days must be between 1 and 90");
    }
    string id = "RX-" + uuid:createType4AsString().substring(0, 8).toUpperAscii();
    string token = uuid:createType4AsString();

    _ = check db->execute(`
        INSERT INTO e_prescription (id, phn, doctor_id, doctor_name, medication, dosage, quantity, qr_token, expires_at)
        VALUES (${id}, ${phn}, ${doctorId}, ${doctorName}, ${medication}, ${dosage}, ${quantity}, ${token},
                now() + make_interval(days => ${validDays}::int))`);

    PrescriptionRow? row = check getPrescriptionByToken(token);
    if row is () {
        return error("Prescription was not saved");
    }
    return row;
}

// "expired" is worked out on the fly from expires_at
function getPrescriptionByToken(string token) returns PrescriptionRow?|error {
    stream<PrescriptionRow, sql:Error?> rows = db->query(`
        SELECT id, phn, doctor_name AS "doctorName", medication, dosage, quantity, qr_token AS "qrToken",
               CASE WHEN status = 'active' AND expires_at <= now() THEN 'expired' ELSE status END AS status,
               created_at::text AS "createdAt", expires_at::text AS "expiresAt",
               dispensed_at::text AS "dispensedAt", pharmacy_name AS "pharmacyName"
        FROM e_prescription
        WHERE qr_token = ${token}`);
    PrescriptionRow[] list = check from PrescriptionRow r in rows select r;
    return list.length() > 0 ? list[0] : ();
}

function listPatientPrescriptions(string phn) returns PrescriptionRow[]|error {
    stream<PrescriptionRow, sql:Error?> rows = db->query(`
        SELECT id, phn, doctor_name AS "doctorName", medication, dosage, quantity, qr_token AS "qrToken",
               CASE WHEN status = 'active' AND expires_at <= now() THEN 'expired' ELSE status END AS status,
               created_at::text AS "createdAt", expires_at::text AS "expiresAt",
               dispensed_at::text AS "dispensedAt", pharmacy_name AS "pharmacyName"
        FROM e_prescription
        WHERE phn = ${phn}
        ORDER BY created_at DESC`);
    return from PrescriptionRow r in rows select r;
}

function listDoctorPrescriptions(string doctorId) returns PrescriptionRow[]|error {
    stream<PrescriptionRow, sql:Error?> rows = db->query(`
        SELECT id, phn, doctor_name AS "doctorName", medication, dosage, quantity, qr_token AS "qrToken",
               CASE WHEN status = 'active' AND expires_at <= now() THEN 'expired' ELSE status END AS status,
               created_at::text AS "createdAt", expires_at::text AS "expiresAt",
               dispensed_at::text AS "dispensedAt", pharmacy_name AS "pharmacyName"
        FROM e_prescription
        WHERE doctor_id = ${doctorId}
        ORDER BY created_at DESC
        LIMIT 50`);
    return from PrescriptionRow r in rows select r;
}

// One SQL statement with "status = 'active'" in the WHERE clause:
// even if two pharmacies click Dispense at the same moment, only one succeeds
function dispensePrescription(string token, string pharmacyId, string pharmacyName) returns boolean|error {
    sql:ExecutionResult result = check db->execute(`
        UPDATE e_prescription
        SET status = 'dispensed', dispensed_at = now(), pharmacy_id = ${pharmacyId}, pharmacy_name = ${pharmacyName}
        WHERE qr_token = ${token} AND status = 'active' AND expires_at > now()`);
    return (result.affectedRowCount ?: 0) > 0;
}

// So the pharmacist can confirm they're serving the right person
function patientName(string phn) returns string {
    string|sql:Error name = db->queryRow(`
        SELECT data->'name'->0->>'text' FROM fhir_resource
        WHERE phn = ${phn} AND resource_type = 'Patient'`);
    return name is string ? name : "Unknown patient";
}