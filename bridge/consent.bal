import ballerina/sql;

// ---------- Which record types each consent scope unlocks ----------
function scopeResourceType(string scope) returns string? {
    match scope {
        "labs" => {
            return "Observation";
        }
        "medications" => {
            return "MedicationRequest";
        }
        "visits" => {
            return "Encounter";
        }
        "allergies" => {
            return "AllergyIntolerance";
        }
    }
    return ();
}

type ConsentRow record {|
    int id;
    string phn;
    string granteeId;
    string granteeName;
    string scopes;
    string status;
    int durationDays;
    string? expiresAt;
    string createdAt;
|};

type AccessLogRow record {|
    string actorName;
    string actorRole;
    string action;
    string? resourceTypes;
    string decision;
    string? reason;
    string at;
|};

// ---------- Doctor asks for access ----------
function createConsentRequest(string phn, string doctorId, string doctorName, string[] scopes, int days)
        returns int|error {
    if scopes.length() == 0 {
        return error("Choose at least one type of record");
    }
    foreach string s in scopes {
        if scopeResourceType(s) is () {
            return error("Unknown scope: " + s);
        }
    }
    if days < 1 || days > 30 {
        return error("Duration must be between 1 and 30 days");
    }
    int known = check db->queryRow(`SELECT COUNT(*) FROM patient_index WHERE phn = ${phn}`);
    if known == 0 {
        return error("No patient found with that PHN");
    }
    string scopesCsv = string:'join(",", ...scopes);
    int id = check db->queryRow(`
        INSERT INTO consent (phn, grantee_type, grantee_id, grantee_name, scopes, duration_days)
        VALUES (${phn}, 'doctor', ${doctorId}, ${doctorName}, string_to_array(${scopesCsv}, ','), ${days})
        RETURNING id`);
    return id;
}

// Mark consents whose time has run out
function expireOldConsents() returns error? {
    _ = check db->execute(`
        UPDATE consent SET status = 'expired'
        WHERE status = 'active' AND expires_at <= now()`);
}

// ---------- Patient's view of requests and active access ----------
function listConsents(string phn) returns ConsentRow[]|error {
    check expireOldConsents();
    stream<ConsentRow, sql:Error?> rows = db->query(`
        SELECT id, phn, grantee_id AS "granteeId", COALESCE(grantee_name, grantee_id) AS "granteeName",
               array_to_string(scopes, ',') AS scopes, status, duration_days AS "durationDays",
               expires_at::text AS "expiresAt", created_at::text AS "createdAt"
        FROM consent
        WHERE phn = ${phn}
        ORDER BY created_at DESC`);
    return from ConsentRow r in rows select r;
}

// approve / deny a pending request, or revoke an active one; only the patient's own consents
function decideConsent(int id, string phn, string action) returns boolean|error {
    sql:ExecutionResult result;
    if action == "approve" {
        result = check db->execute(`
            UPDATE consent SET status = 'active', decided_at = now(),
                   expires_at = now() + make_interval(days => duration_days)
            WHERE id = ${id} AND phn = ${phn} AND status = 'pending'`);
    } else if action == "deny" {
        result = check db->execute(`
            UPDATE consent SET status = 'denied', decided_at = now()
            WHERE id = ${id} AND phn = ${phn} AND status = 'pending'`);
    } else if action == "revoke" {
        result = check db->execute(`
            UPDATE consent SET status = 'revoked', decided_at = now()
            WHERE id = ${id} AND phn = ${phn} AND status = 'active'`);
    } else {
        return error("Unknown action");
    }
    return (result.affectedRowCount ?: 0) > 0;
}

// ---------- The check that protects every doctor read ----------
function findActiveConsent(string phn, string doctorId) returns ConsentRow?|error {
    check expireOldConsents();
    stream<ConsentRow, sql:Error?> rows = db->query(`
        SELECT id, phn, grantee_id AS "granteeId", COALESCE(grantee_name, grantee_id) AS "granteeName",
               array_to_string(scopes, ',') AS scopes, status, duration_days AS "durationDays",
               expires_at::text AS "expiresAt", created_at::text AS "createdAt"
        FROM consent
        WHERE phn = ${phn} AND grantee_id = ${doctorId} AND grantee_type = 'doctor'
          AND status = 'active' AND expires_at > now()
        ORDER BY expires_at DESC
        LIMIT 1`);
    ConsentRow[] list = check from ConsentRow r in rows select r;
    return list.length() > 0 ? list[0] : ();
}

// Keep only the record types the patient approved (basic Patient info is always included)
function filterByScopes(json[] resources, string scopesCsv) returns json[]|error {
    string[] allowed = ["Patient"];
    foreach string s in re `,`.split(scopesCsv) {
        string? t = scopeResourceType(s);
        if t is string {
            allowed.push(t);
        }
    }
    json[] result = [];
    foreach json r in resources {
        map<json> m = check r.ensureType();
        if allowed.indexOf(m["resourceType"].toString()) !is () {
            result.push(r);
        }
    }
    return result;
}

// ---------- Access log ----------
function logAccess(string phn, string actorId, string actorName, string actorRole, string action,
        string? resourceTypes, string decision, string? reason) returns error? {
    _ = check db->execute(`
        INSERT INTO access_log (phn, actor_id, actor_name, actor_role, action, resource_types, decision, reason)
        VALUES (${phn}, ${actorId}, ${actorName}, ${actorRole}, ${action}, ${resourceTypes}, ${decision}, ${reason})`);
}

function listAccessLog(string phn) returns AccessLogRow[]|error {
    stream<AccessLogRow, sql:Error?> rows = db->query(`
        SELECT COALESCE(actor_name, actor_id) AS "actorName", actor_role AS "actorRole", action,
               resource_types AS "resourceTypes", decision, reason, at::text AS "at"
        FROM access_log
        WHERE phn = ${phn}
        ORDER BY at DESC
        LIMIT 100`);
    return from AccessLogRow r in rows select r;
}
// ---------- Doctor's own requests ----------
function listDoctorConsents(string doctorId) returns ConsentRow[]|error {
    check expireOldConsents();
    stream<ConsentRow, sql:Error?> rows = db->query(`
        SELECT id, phn, grantee_id AS "granteeId", COALESCE(grantee_name, grantee_id) AS "granteeName",
               array_to_string(scopes, ',') AS scopes, status, duration_days AS "durationDays",
               expires_at::text AS "expiresAt", created_at::text AS "createdAt"
        FROM consent
        WHERE grantee_id = ${doctorId}
        ORDER BY created_at DESC
        LIMIT 50`);
    return from ConsentRow r in rows select r;
}