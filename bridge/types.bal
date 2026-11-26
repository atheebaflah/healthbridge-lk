// ---------- Hospital A ----------
type APatient record {
    string barcode;
    string phn;
};

type AVisit record {
    string visitId;
    string date;
    string department;
    string doctor;
    string diagnosis;
};

type ALab record {
    string labId;
    string visitId;
    string testCode;
    decimal value;
    string unit;
    string takenAt;
};

type APrescription record {
    string rxId;
    string visitId;
    string drug;
    string dose;
    string frequency;
    int days;
};

type APatientFull record {
    string barcode;
    string phn;
    string fullName;
    string dob;
    string gender;
    string[] allergies;
    AVisit[] visits;
    ALab[] labs;
    APrescription[] prescriptions;
    string bloodGroup?;
};

// ---------- Hospital B ----------
type BPatient record {
    string mrn;
    string personalHealthNo;
};

type BPatientList record {
    int count;
    BPatient[] items;
};

type BPatientFull record {
    string mrn;
    string personalHealthNo;
    string firstName;
    string lastName;
    string birthDate;
    string sex;
    string allergyList;
};

type BEncounter record {
    string encounterNo;
    string startedAt;
    string unit;
    string consultant;
    string primaryDiagnosis;
};

type BMedication record {
    string orderId;
    string encounterNo;
    string medication;
    string instructions;
};

type BLab record {|
    string mrn;
    string test;
    decimal result;
    string units;
    string date;
|};

type BData record {|
    BPatientFull patient;
    BEncounter[] encounters;
    BMedication[] medications;
    BLab[] labs;
|};

// ---------- Bridge ----------
type LabCode record {|
    string loinc;
    string display;
|};

type TimelineEntry record {|
    string date;
    json res;
|};