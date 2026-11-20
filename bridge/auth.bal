import ballerina/jwt;

configurable string asgardeoOrg = ?;
configurable string asgardeoClientId = ?;

final string asgardeoIssuer = string `https://api.asgardeo.io/t/${asgardeoOrg}/oauth2/token`;
final string asgardeoJwksUrl = string `https://api.asgardeo.io/t/${asgardeoOrg}/oauth2/jwks`;

type UserContext record {|
    string sub;
    string? phn;
    string[] roles;
|};

// The /api service has already verified the token signature; here we read the claims
function userFromToken(string authHeader) returns UserContext|error {
    string token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
    [jwt:Header, jwt:Payload] [_, payload] = check jwt:decode(token);

    anydata phnClaim = payload["phn"];
    string? phn = phnClaim is string ? phnClaim : ();

    string[] roles = [];
    foreach string claim in ["roles", "application_roles"] {
        anydata rolesClaim = payload[claim];
        if rolesClaim is string {
            foreach string r in re `,`.split(rolesClaim) {
                if r.trim() != "" && roles.indexOf(r.trim()) is () {
                    roles.push(r.trim());
                }
            }
        } else if rolesClaim is anydata[] {
            foreach anydata r in rolesClaim {
                if r is string && roles.indexOf(r) is () {
                    roles.push(r);
                }
            }
        }
    }
    return {sub: payload?.sub ?: "", phn, roles};
}