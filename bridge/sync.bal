import ballerina/time;

// Pull every patient from both hospitals and store their FHIR records
function syncAll() returns json|error {
    map<boolean> phns = {};

    APatient[] aList = check hospitalA->get("/patients");
    foreach APatient p in aList {
        phns[p.phn] = true;
        check upsertIndex("hospital-a", p.barcode, p.phn);
    }

    BPatientList bList = check hospitalB->get("/api/v1/patients");
    foreach BPatient p in bList.items {
        phns[p.personalHealthNo] = true;
        check upsertIndex("hospital-b", p.mrn, p.personalHealthNo);
    }

    int total = 0;
    foreach string phn in phns.keys() {
        APatientFull? a = check fetchHospitalA(phn);
        BData? b = check fetchHospitalB(phn);
        total += check saveBundle(phn, buildBundle(phn, a, b));
    }

    return {patients: phns.length(), resources: total, syncedAt: time:utcToString(time:utcNow())};
}