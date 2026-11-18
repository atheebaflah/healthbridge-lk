import ballerina/http;

service /bridge on new http:Listener(9090) {

    resource function get health() returns json {
        return {status: "ok", name: "HealthBridge bridge"};
    }

    // One PHN -> one FHIR Bundle with records from every hospital
    resource function get patients/[string phn]/fhir() returns json|http:NotFound|error {
        APatientFull? a = check fetchHospitalA(phn);
        BData? b = check fetchHospitalB(phn);
        if a is () && b is () {
            return http:NOT_FOUND;
        }
        return buildBundle(phn, a, b);
    }
}