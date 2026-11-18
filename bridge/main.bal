import ballerina/http;

configurable string hospitalAUrl = "http://localhost:8081";
configurable string hospitalBUrl = "http://localhost:8082";

final http:Client hospitalA = check new (hospitalAUrl);
final http:Client hospitalB = check new (hospitalBUrl);

// Only the fields we need for matching; other fields are kept automatically
type APatient record {
    string barcode;
    string phn;
};

type BPatient record {
    string mrn;
    string personalHealthNo;
};

type BPatientList record {
    int count;
    BPatient[] items;
};

service /bridge on new http:Listener(9090) {

    resource function get health() returns json {
        return {status: "ok", name: "HealthBridge bridge"};
    }

    // Step 1: everything both hospitals hold for one PHN, not converted yet
    resource function get patients/[string phn]/raw() returns json|http:NotFound|error {

        // Hospital A: find the patient by PHN, then get their full record by barcode
        APatient[] aPatients = check hospitalA->get("/patients");
        APatient[] aMatch = from APatient p in aPatients
            where p.phn == phn
            select p;

        // Hospital B: the PHN field has a different name here
        BPatientList bList = check hospitalB->get("/api/v1/patients");
        BPatient[] bMatch = from BPatient p in bList.items
            where p.personalHealthNo == phn
            select p;

        if aMatch.length() == 0 && bMatch.length() == 0 {
            return http:NOT_FOUND;
        }

        json hospitalAData = ();
        if aMatch.length() > 0 {
            hospitalAData = check hospitalA->get("/patients/" + aMatch[0].barcode);
        }

        json hospitalBData = ();
        if bMatch.length() > 0 {
            string mrn = bMatch[0].mrn;
            json patient = check hospitalB->get("/api/v1/patients/" + mrn);
            json encounters = check hospitalB->get(string `/api/v1/patients/${mrn}/encounters`);
            json medications = check hospitalB->get(string `/api/v1/patients/${mrn}/medications`);
            string labsCsv = check hospitalB->get("/exports/labs.csv?mrn=" + mrn);
            hospitalBData = {patient, encounters, medications, labsCsv};
        }

        return {phn, hospitalA: hospitalAData, hospitalB: hospitalBData};
    }
}