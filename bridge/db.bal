import ballerina/sql;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

// Dev defaults matching docker-compose.yml (we'll move these to Config.toml later)
configurable string dbHost = "127.0.0.1";
configurable int dbPort = 5433;
configurable string dbUser = "healthbridge";
configurable string dbPassword = "devpass";
configurable string dbName = "healthbridge";

final postgresql:Client db = check new (host = dbHost, username = dbUser, password = dbPassword,
    database = dbName, port = dbPort);

type DataRow record {|
    string data;
|};

// PHN <-> hospital's own ID
function upsertIndex(string hospital, string localId, string phn) returns error? {
    _ = check db->execute(`
        INSERT INTO patient_index (hospital, local_id, phn)
        VALUES (${hospital}, ${localId}, ${phn})
        ON CONFLICT (hospital, local_id) DO UPDATE SET phn = EXCLUDED.phn`);
}

// Replace a patient's stored FHIR resources with a fresh Bundle
function saveBundle(string phn, json bundle) returns int|error {
    map<json> b = check bundle.ensureType();
    json[] entries = check b["entry"].ensureType();

    _ = check db->execute(`DELETE FROM fhir_resource WHERE phn = ${phn}`);

    foreach json e in entries {
        map<json> entry = check e.ensureType();
        map<json> r = check entry["resource"].ensureType();
        string resourceType = r["resourceType"].toString();
        string id = r["id"].toString();
        string? src = sourceHospital(r);
        string? eff = effectiveDate(r);
        string data = r.toJsonString();

        _ = check db->execute(`
            INSERT INTO fhir_resource (phn, resource_type, id, source_hospital, effective_at, data)
            VALUES (${phn}, ${resourceType}, ${id}, ${src}, ${eff}, ${data}::jsonb)`);
    }
    return entries.length();
}

// Patient first, then allergies, then everything else newest first
function readTimeline(string phn) returns json[]|error {
    stream<DataRow, sql:Error?> rows = db->query(`
        SELECT data::text AS data FROM fhir_resource
        WHERE phn = ${phn}
        ORDER BY CASE resource_type WHEN 'Patient' THEN 0 WHEN 'AllergyIntolerance' THEN 1 ELSE 2 END,
                 effective_at DESC NULLS LAST`);
    DataRow[] list = check from DataRow row in rows select row;

    json[] result = [];
    foreach DataRow row in list {
        result.push(check row.data.fromJsonString());
    }
    return result;
}

// "urn:healthbridge:hospital-a" -> "hospital-a"
function sourceHospital(map<json> r) returns string? {
    json meta = r["meta"];
    if meta is map<json> {
        json s = meta["source"];
        if s is string {
            return s.substring(17);
        }
    }
    return ();
}

// The date that places a resource on the timeline
function effectiveDate(map<json> r) returns string? {
    json eff = r["effectiveDateTime"];
    if eff is string {
        return eff;
    }
    json authored = r["authoredOn"];
    if authored is string {
        return authored;
    }
    json period = r["period"];
    if period is map<json> {
        json s = period["start"];
        if s is string {
            return s;
        }
    }
    return ();
}