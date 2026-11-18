import ballerina/http;

configurable string hospitalAUrl = "http://localhost:8081";
configurable string hospitalBUrl = "http://localhost:8082";

final http:Client hospitalA = check new (hospitalAUrl);
final http:Client hospitalB = check new (hospitalBUrl);

// Find the patient in Hospital A by PHN, then fetch the full record by barcode
function fetchHospitalA(string phn) returns APatientFull|error? {
    APatient[] list = check hospitalA->get("/patients");
    foreach APatient p in list {
        if p.phn == phn {
            APatientFull full = check hospitalA->get("/patients/" + p.barcode);
            return full;
        }
    }
    return ();
}

// Same for Hospital B, which uses MRNs, separate endpoints and a CSV lab export
function fetchHospitalB(string phn) returns BData|error? {
    BPatientList list = check hospitalB->get("/api/v1/patients");
    foreach BPatient p in list.items {
        if p.personalHealthNo == phn {
            string mrn = p.mrn;
            BPatientFull patient = check hospitalB->get("/api/v1/patients/" + mrn);
            BEncounter[] encounters = check hospitalB->get(string `/api/v1/patients/${mrn}/encounters`);
            BMedication[] medications = check hospitalB->get(string `/api/v1/patients/${mrn}/medications`);
            string csv = check hospitalB->get("/exports/labs.csv?mrn=" + mrn);
            BLab[] labs = check parseLabsCsv(csv);
            return {patient, encounters, medications, labs};
        }
    }
    return ();
}

// "mrn,test,result,units,date" -> BLab records (first line is the header)
function parseLabsCsv(string csv) returns BLab[]|error {
    BLab[] labs = [];
    string[] lines = re `\r?\n`.split(csv.trim());
    foreach int i in 1 ..< lines.length() {
        string[] f = re `,`.split(lines[i]);
        if f.length() < 5 {
            continue;
        }
        labs.push({mrn: f[0], test: f[1], result: check decimal:fromString(f[2]), units: f[3], date: f[4]});
    }
    return labs;
}