import ballerina/http;

listener http:Listener bridgeListener = new (9090);

// ---------- Development service (no login; we'll lock this down later) ----------
service /bridge on bridgeListener {

    resource function get health() returns json {
        return {status: "ok", name: "HealthBridge bridge"};
    }

    resource function get patients/[string phn]/fhir() returns json|http:NotFound|error {
        APatientFull? a = check fetchHospitalA(phn);
        BData? b = check fetchHospitalB(phn);
        if a is () && b is () {
            return http:NOT_FOUND;
        }
        return buildBundle(phn, a, b);
    }

    resource function post admin/sync() returns json|error {
        return syncAll();
    }

    resource function get patients/[string phn]/timeline() returns json|http:NotFound|error {
        return timelineBundle(phn);
    }
}

// ---------- Public API: every request needs a valid Asgardeo token ----------
// ---------- Public API: every request needs a valid Asgardeo token ----------
// ---------- Public API: every request needs a valid Asgardeo token ----------
@http:ServiceConfig {
    auth: [
        {
            jwtValidatorConfig: {
                issuer: asgardeoIssuer,
                audience: asgardeoClientId,
                signatureConfig: {jwksConfig: {url: asgardeoJwksUrl}}
            }
        }
    ]
}
service /api on bridgeListener {

    // ===== Any logged-in user =====
    resource function get me(@http:Header {name: "Authorization"} string? authHeader)
            returns json|http:Unauthorized|error {
        if authHeader is () {
            return http:UNAUTHORIZED;
        }
        UserContext user = check userFromToken(authHeader);
        return user.toJson();
    }

    // ===== Patient =====
    resource function get me/timeline(@http:Header {name: "Authorization"} string? authHeader)
            returns json|http:NotFound|http:Forbidden|http:Unauthorized|error {
        string|http:Unauthorized|http:Forbidden phn = check patientPhn(authHeader);
        if phn !is string {
            return phn;
        }
        return timelineBundle(phn);
    }

    resource function get me/consents(@http:Header {name: "Authorization"} string? authHeader)
            returns ConsentRow[]|http:Forbidden|http:Unauthorized|error {
        string|http:Unauthorized|http:Forbidden phn = check patientPhn(authHeader);
        if phn !is string {
            return phn;
        }
        return listConsents(phn);
    }

    // action = approve | deny | revoke
    resource function post me/consents/[int id]/[string action](
            @http:Header {name: "Authorization"} string? authHeader)
            returns json|http:BadRequest|http:NotFound|http:Forbidden|http:Unauthorized|error {
        if ["approve", "deny", "revoke"].indexOf(action) is () {
            return <http:BadRequest>{body: {message: "Action must be approve, deny or revoke"}};
        }
        string|http:Unauthorized|http:Forbidden phn = check patientPhn(authHeader);
        if phn !is string {
            return phn;
        }
        boolean changed = check decideConsent(id, phn, action);
        if !changed {
            return <http:NotFound>{body: {message: "No matching request (it may already be decided)"}};
        }
        return {id, action, ok: true};
    }

    resource function get me/access\-log(@http:Header {name: "Authorization"} string? authHeader)
            returns AccessLogRow[]|http:Forbidden|http:Unauthorized|error {
        string|http:Unauthorized|http:Forbidden phn = check patientPhn(authHeader);
        if phn !is string {
            return phn;
        }
        return listAccessLog(phn);
    }

    // ===== Doctor =====
    resource function post consents(@http:Header {name: "Authorization"} string? authHeader,
            @http:Payload ConsentRequestBody body)
            returns http:Created|http:BadRequest|http:Forbidden|http:Unauthorized|error {
        UserContext|http:Unauthorized|http:Forbidden doctor = check requireRole(authHeader, "doctor");
        if doctor !is UserContext {
            return doctor;
        }
        string doctorName = doctor.name != "" ? doctor.name : "A doctor";
        int|error id = createConsentRequest(body.phn, doctor.sub, doctorName, body.scopes, body.durationDays);
        if id is error {
            return <http:BadRequest>{body: {message: id.message()}};
        }
        return <http:Created>{body: {id, status: "pending"}};
    }

    resource function get doctor/requests(@http:Header {name: "Authorization"} string? authHeader)
            returns ConsentRow[]|http:Forbidden|http:Unauthorized|error {
        UserContext|http:Unauthorized|http:Forbidden doctor = check requireRole(authHeader, "doctor");
        if doctor !is UserContext {
            return doctor;
        }
        return listDoctorConsents(doctor.sub);
    }

    // The protected read: only with active consent, only approved record types, always logged
    resource function get patients/[string phn]/records(@http:Header {name: "Authorization"} string? authHeader)
            returns json|http:Forbidden|http:Unauthorized|error {
        UserContext|http:Unauthorized|http:Forbidden doctor = check requireRole(authHeader, "doctor");
        if doctor !is UserContext {
            return doctor;
        }
        ConsentRow? consent = check findActiveConsent(phn, doctor.sub);
        if consent is () {
            check logAccess(phn, doctor.sub, doctor.name, "doctor", "view-records", (), "deny", "No active consent");
            return <http:Forbidden>{body: {message: "No active consent from this patient"}};
        }
        json[] all = check readTimeline(phn);
        json[] allowed = check filterByScopes(all, consent.scopes);
        check logAccess(phn, doctor.sub, consent.granteeName, "doctor", "view-records", consent.scopes, "allow", ());

        json[] entry = from json r in allowed
            select {"resource": r};
        return {
            resourceType: "Bundle",
            "type": "collection",
            total: entry.length(),
            entry,
            consent: {scopes: consent.scopes, expiresAt: consent.expiresAt}
        };
    }
}

// ---------- Helpers for the API ----------
type ConsentRequestBody record {|
    string phn;
    string[] scopes;
    int durationDays;

|};

function requireRole(string? authHeader, string role) returns UserContext|http:Unauthorized|http:Forbidden|error {
    if authHeader is () {
        return http:UNAUTHORIZED;
    }
    UserContext user = check userFromToken(authHeader);
    if user.roles.indexOf(role) is () {
        return <http:Forbidden>{body: {message: "This action needs the '" + role + "' role"}};
    }
    return user;
}

function patientPhn(string? authHeader) returns string|http:Unauthorized|http:Forbidden|error {
    UserContext|http:Unauthorized|http:Forbidden user = check requireRole(authHeader, "patient");
    if user !is UserContext {
        return user;
    }
    string? phn = user.phn;
    if phn is () {
        return <http:Forbidden>{body: {message: "Only patients with a PHN can do this"}};
    }
    return phn;
}

function timelineBundle(string phn) returns json|http:NotFound|error {
    json[] resources = check readTimeline(phn);
    if resources.length() == 0 {
        return http:NOT_FOUND;
    }
    json[] entry = from json r in resources
        select {"resource": r};
    return {resourceType: "Bundle", "type": "collection", total: entry.length(), entry};
}
