import ballerina/http;

service /bridge on new http:Listener(9090) {

    resource function get health() returns json {
        return {status: "ok", name: "HealthBridge bridge"};
    }

    // Live view straight from the hospitals (useful for debugging)
    resource function get patients/[string phn]/fhir() returns json|http:NotFound|error {
        APatientFull? a = check fetchHospitalA(phn);
        BData? b = check fetchHospitalB(phn);
        if a is () && b is () {
            return http:NOT_FOUND;
        }
        return buildBundle(phn, a, b);
    }

    // Pull fresh data from all hospitals into the database
    resource function post admin/sync() returns json|error {
        return syncAll();
    }

    // Fast timeline read from the database
    resource function get patients/[string phn]/timeline() returns json|http:NotFound|error {
        json[] resources = check readTimeline(phn);
        if resources.length() == 0 {
            return http:NOT_FOUND;
        }
        json[] entry = from json r in resources select {"resource": r};
        return {resourceType: "Bundle", "type": "collection", total: entry.length(), entry};
    }
}