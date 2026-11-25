-- Links one PHN to each hospital's own ID (barcode, MRN)
CREATE TABLE patient_index (
    hospital    VARCHAR(50) NOT NULL,
    local_id    VARCHAR(50) NOT NULL,
    phn         VARCHAR(20) NOT NULL,
    PRIMARY KEY (hospital, local_id)
);
CREATE INDEX idx_patient_index_phn ON patient_index (phn);

-- FHIR resources produced by the bridge
CREATE TABLE fhir_resource (
    phn             VARCHAR(20)  NOT NULL,
    resource_type   VARCHAR(50)  NOT NULL,
    id              VARCHAR(100) NOT NULL,
    source_hospital VARCHAR(50),
    effective_at    VARCHAR(40),
    data            JSONB        NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (phn, resource_type, id)
);

-- Who may see what, until when
CREATE TABLE consent (
    id           BIGSERIAL PRIMARY KEY,
    phn          VARCHAR(20)  NOT NULL,
    grantee_type VARCHAR(20)  NOT NULL CHECK (grantee_type IN ('doctor', 'pharmacy', 'agent')),
    grantee_id   VARCHAR(100) NOT NULL,
    grantee_name VARCHAR(200),
    scopes       TEXT[]       NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'denied', 'revoked', 'expired')),
    duration_days INT         NOT NULL DEFAULT 7,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    decided_at   TIMESTAMPTZ
);
CREATE INDEX idx_consent_phn ON consent (phn);

-- Every read, allowed or denied
CREATE TABLE access_log (
    id             BIGSERIAL PRIMARY KEY,
    phn            VARCHAR(20)  NOT NULL,
    actor_id       VARCHAR(100) NOT NULL,
    actor_name     VARCHAR(200),
    actor_role     VARCHAR(20)  NOT NULL,
    action         VARCHAR(50)  NOT NULL,
    resource_types TEXT,
    decision       VARCHAR(10)  NOT NULL CHECK (decision IN ('allow', 'deny')),
    reason         TEXT,
    at             TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_log_phn ON access_log (phn);

-- Break-glass emergency access
CREATE TABLE emergency_access (
    id              BIGSERIAL PRIMARY KEY,
    phn             VARCHAR(20)  NOT NULL,
    staff_id        VARCHAR(100) NOT NULL,
    reason          TEXT         NOT NULL,
    started_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ends_at         TIMESTAMPTZ  NOT NULL,
    family_notified BOOLEAN      NOT NULL DEFAULT false
);

-- A prescription can only be dispensed once
CREATE TABLE prescription_dispense (
    medication_request_id VARCHAR(100) PRIMARY KEY,
    pharmacy_id           VARCHAR(100) NOT NULL,
    dispensed_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- E-prescriptions written by doctors; dispensed once by a pharmacy
CREATE TABLE e_prescription (
    id            VARCHAR(40)  PRIMARY KEY,
    phn           VARCHAR(20)  NOT NULL,
    doctor_id     VARCHAR(100) NOT NULL,
    doctor_name   VARCHAR(200) NOT NULL,
    medication    VARCHAR(200) NOT NULL,
    dosage        VARCHAR(300) NOT NULL,
    quantity      VARCHAR(50),
    qr_token      VARCHAR(80)  NOT NULL UNIQUE,
    status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'dispensed', 'cancelled')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ  NOT NULL,
    dispensed_at  TIMESTAMPTZ,
    pharmacy_id   VARCHAR(100),
    pharmacy_name VARCHAR(200)
);