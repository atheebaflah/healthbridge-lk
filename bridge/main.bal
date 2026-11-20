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

    // Debug helper: shows what the bridge read from your token
    resource function get me(@http:Header {name: "Authorization"} string? authHeader)
            returns json|http:Unauthorized|error {
        if authHeader is () {
            return http:UNAUTHORIZED;
        }
        UserContext user = check userFromToken(authHeader);
        return user.toJson();
    }

    // A patient's own timeline, using the PHN from their token (never from the URL)
    resource function get me/timeline(@http:Header {name: "Authorization"} string? authHeader)
            returns json|http:NotFound|http:Forbidden|http:Unauthorized|error {
        if authHeader is () {
            return http:UNAUTHORIZED;
        }
        UserContext user = check userFromToken(authHeader);
        string? phn = user.phn;
        if phn is () || user.roles.indexOf("patient") is () {
            return <http:Forbidden>{body: {message: "Only patients with a PHN can view a personal timeline", roles: user.roles, hasPhn: phn is string}};
        }
        return timelineBundle(phn);
    }
}

function timelineBundle(string phn) returns json|http:NotFound|error {
    json[] resources = check readTimeline(phn);
    if resources.length() == 0 {
        return http:NOT_FOUND;
    }
    json[] entry = from json r in resources select {"resource": r};
    return {resourceType: "Bundle", "type": "collection", total: entry.length(), entry};
}