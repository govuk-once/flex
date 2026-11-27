/**
 * Example JWKS data for testing purposes, taken from google.com
 *
 * **Field order is important**: HttpResponse.json() seems to have some odd field reordering behavior.
 */
export const publicJWKS = {
  keys: [
    {
      alg: "RS256",
      e: "AQAB",
      key_ops: ["sign"],
      kty: "RSA",
      n: "zD5T9VQ4mirMnDOa-Z-Alg2X12NBDNxp1m9ZLTiiT08a7wMDfInDGh5wblIjwolPIDtryk25LfoUl2viVExeCD7AliCSlSBN8ttpLxYtDs0kKmAI3F5SMFrd7KiMB01_itWuDzTNtm4vqU_ZuqzEqzq3586tjD3lsN1vBjMlQZD0r5UdG423Q5qdwNyzBbspjw2zI3rres-FIPQVXWl3VLSmzkSeEIwNXaK5Z5yf9uE5PjZUjKHRgfgOBcfWI8xtmWy_HDvK5eL-3lyoAPYJ4mTNSQjGx7QOsmNKYJlLBilx5f3BdM-rDREhYuYKwj4bEik1_rp5PtoEpu2dC20I9qsPEtgf7r05JD5zhz84zZcZzrF1Sm1AoBsXmCOWIHlGbFql03CVP-JltxLSGNNI2jUosi5YN-78BEScSYnecq22U2wx9k4DT79R81K5ULqHTOcTIex1uy7fR8vGZb61TYDFKb3zHcxnH2P4SpIne5VydOm2fMjjMbJmpskhZv-F", // pragma: allowlist secret
      use: "sig",
      kid: "83fcafa6aad51fddd3c34ad1e9df90d8", // pragma: allowlist secret
    },
  ],
};

/**
 * The private key that signed these JWTs is deliberately not kept in the repo. To add or change a
 * fixture token, generate a new RSA key pair, sign the tokens with it, and replace the public key
 * in `publicJWKS` (and its `kid`) to match.
 *
 * JWT contents, signed with the private key matching `publicJWKS`:
 *
 * header: {
 *   "typ": "JWT",
 *   "alg": "RS256",
 *   "kid": "83fcafa6aad51fddd3c34ad1e9df90d8" // pragma: allowlist secret
 * }
 *
 * payload: {
 *   "sub": "d6a2b234-e011-7084-f347-912225bd2861",
 *   "cognito:groups": ["eu-west-2_testUserPoolId_onelogin"],
 *   "iss": "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId",
 *   "version": 2,
 *   "client_id": "testClientId",
 *   "origin_jti": "358bd56a-5bc8-42ef-91a4-c2b158848419",
 *   "token_use": "access",
 *   "scope": "openid email",
 *   "auth_time": 1768233127,
 *   "exp": 4768233427,
 *   "iat": 1768233127,
 *   "jti": "af6aa38a-83cf-43c0-8b4c-1beaca770184"
 *   "username": "onelogin_urn:fdc:gov.uk:2022:SwProvIeT-P_oLN2JHRrJvV2yaC2mM3vRI_NrlW2yt0"
 * }
 */

/**
 * Valid JWT
 */
export const validJwt =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjgzZmNhZmE2YWFkNTFmZGRkM2MzNGFkMWU5ZGY5MGQ4In0.eyJzdWIiOiJkNmEyYjIzNC1lMDExLTcwODQtZjM0Ny05MTIyMjViZDI4NjEiLCJjb2duaXRvOmdyb3VwcyI6WyJldS13ZXN0LTJfdGVzdFVzZXJQb29sSWRfb25lbG9naW4iXSwiaXNzIjoiaHR0cHM6Ly9jb2duaXRvLWlkcC5ldS13ZXN0LTIuYW1hem9uYXdzLmNvbS9ldS13ZXN0LTJfdGVzdFVzZXJQb29sSWQiLCJ2ZXJzaW9uIjoyLCJjbGllbnRfaWQiOiJ0ZXN0Q2xpZW50SWQiLCJvcmlnaW5fanRpIjoiMzU4YmQ1NmEtNWJjOC00MmVmLTkxYTQtYzJiMTU4ODQ4NDE5IiwidG9rZW5fdXNlIjoiYWNjZXNzIiwic2NvcGUiOiJvcGVuaWQgZW1haWwiLCJhdXRoX3RpbWUiOjE3NjgyMzMxMjcsImV4cCI6NDc2ODIzMzQyNywiaWF0IjoxNzY4MjMzMTI3LCJqdGkiOiJhZjZhYTM4YS04M2NmLTQzYzAtOGI0Yy0xYmVhY2E3NzAxODQiLCJ1c2VybmFtZSI6Im9uZWxvZ2luX3VybjpmZGM6Z292LnVrOjIwMjI6U3dQcm92SWVULVBfb0xOMkpIUnJKdlYyeWFDMm1NM3ZSSV9OcmxXMnl0MCJ9.yto81Gj9CNVsnx9hyAEFcn4LQVw3YiFY9h6QLUP-dUKaMVgFKpTtFTVcHLsAicqufMkhxYY5gBbc460MHbDW1wHUbGDsmz06kjeLK2Jw5S26WLev_ldM5Uq4ks56qtsEO8OHMFmGMSvXtJG8GmRR-ck8Gpn6wEz4GT_xyu0vms29yRKwJSN_wnY1A-e7o4FX5i3PxV-eOXkquI-1PjWX0HRzY2qsbaMncJZpN994L_TaTjORPRTKYaCxvKYNl4coygaZVMlRs6OQjesDLkpKFnMmrVFr1uAZlbxKEKI06pRHiq8XPknyglcVGnM58ZTG-buk-MT2wjaEEB7PpCuQIGtkDhSjYjaebSAhKmKEvsHKN7E_m5vBZuIhPtxkMWa2EUIETl8t9zA22mGsa1UWcm5HYcRoiJDpOhxoPgRE2-9UrYxrRq5PdQuhRuY4vTY4ACCqbe7CpiYrNVtQiyTuiq8_xaGt29bAY1i6tTyPkjNQpWjOVrs9zGq40RAoVY-i"; // pragma: allowlist secret

export const invalidJwt = "invalid.jwt.token";

export const expiredJwt =
  "eyJ0eXBlIjoiSldUIiwiYWxnIjoiUlMyNTYiLCJraWQiOiIwNWFjZDc2YjU1MzRlMzVlNDIyZDZmYTJhOTMzMTdiNCIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNmEyYjIzNC1lMDExLTcwODQtZjM0Ny05MTIyMjViZDI4NjEiLCJjb2duaXRvOmdyb3VwcyI6WyJldS13ZXN0LTJfdGVzdFVzZXJQb29sSWRfb25lbG9naW4iXSwiaXNzIjoiaHR0cHM6Ly9jb2duaXRvLWlkcC5ldS13ZXN0LTIuYW1hem9uYXdzLmNvbS9ldS13ZXN0LTJfdGVzdFVzZXJQb29sSWQiLCJ2ZXJzaW9uIjoyLCJjbGllbnRfaWQiOiJ0ZXN0Q2xpZW50SWQiLCJvcmlnaW5fanRpIjoiMzU4YmQ1NmEtNWJjOC00MmVmLTkxYTQtYzJiMTU4ODQ4NDE5IiwidG9rZW5fdXNlIjoiYWNjZXNzIiwic2NvcGUiOiJvcGVuaWQgZW1haWwiLCJhdXRoX3RpbWUiOjE3NjgyMzMxMjcsImV4cCI6MTc2ODIzMzEyOCwiaWF0IjoxNzY4MjMzMTI3LCJqdGkiOiJhZjZhYTM4YS04M2NmLTQzYzAtOGI0Yy0xYmVhY2E3NzAxODQiLCJ1c2VybmFtZSI6Im9uZWxvZ2luX3VybjpmZGM6Z292LnVrOjIwMjI6U3dQcm92SWVULVBfb0xOMkpIUnJKdlYyeWFDMm1NM3ZSSV9OcmxXMnl0MCJ9.A_VCG2c5HlHKjVrR0jUXOfuAqJBBxE2R3Ah-TOR_FEk7J4q6vXLSXBQ8rTbQamKaLeMH_AxYFmgHQy5p2GN3gAe1YKQrYMgVFwaM_n3ggTMN9CaqXwYh0DGejyw66_i_RbdNUSB4C_XKKrmkuzrzSf0eGGelcrvOQt-r4z7LLs90LmW63TL2qBR_RDjwgtLb0T_Cqn2kHWeIPgmnjNroxyaPUBfqwiNTA6V1_ByEnQ7U0RPWia9bsXpXwrgGEe9arAX8igvUfzlo1p5AME9w7_taTsYA-0ue2w9H_-o9I9hR4wCUJPW7PYtWxrDWJFDeN8BCfyLapSwDSCB8X5kihvxDe6l_X8hdPSPrOr-Qc6YrSmSu-EY3Q0lYjfu9n4zLHJRDOzF7L7gi4-oFOAyO9X_bo6SCly7OTeVzCQKuEzE4mBaVv9DK5R81GqBeqC_s4_Wq9eOKpB5BKGJ_5vpKqkgivRRBFhniVjq7AVkoE4-zW2JBtqall3mEQ1ZE1lNz"; // pragma: allowlist secret

export const validJwtUsername =
  "onelogin_urn:fdc:gov.uk:2022:SwProvIeT-P_oLN2JHRrJvV2yaC2mM3vRI_NrlW2yt0";

/**
 * JWT contents, signed with the private key matching `publicJWKS`:
 *
 * header: {
 *   "typ": "at+jwt",
 *   "alg": "RS256",
 *   "kid": "d27874f4304835544c315b62d5a29c9c" // pragma: allowlist secret
 * }
 *
 * payload: {
 *   "sub": "d6a2b234-e011-7084-f347-912225bd2861",
 *   "cognito:groups": ["eu-west-2_testUserPoolId_onelogin"],
 *   "iss": "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId",
 *   "version": 2,
 *   "client_id": "testClientId",
 *   "origin_jti": "358bd56a-5bc8-42ef-91a4-c2b158848419",
 *   "token_use": "access",
 *   "scope": "openid email",
 *   "auth_time": 1768233127,
 *   "exp": 4768233427,
 *   "iat": 1768233127,
 *   "jti": "af6aa38a-83cf-43c0-8b4c-1beaca770184"
 *   // Missing username field <------------------------------
 * }
 */
export const jwtMissingUsername =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjgzZmNhZmE2YWFkNTFmZGRkM2MzNGFkMWU5ZGY5MGQ4IiwidHlwIjoiSldUIn0.eyJzdWIiOiJkNmEyYjIzNC1lMDExLTcwODQtZjM0Ny05MTIyMjViZDI4NjEiLCJjb2duaXRvOmdyb3VwcyI6WyJldS13ZXN0LTJfdGVzdFVzZXJQb29sSWRfb25lbG9naW4iXSwiaXNzIjoiaHR0cHM6Ly9jb2duaXRvLWlkcC5ldS13ZXN0LTIuYW1hem9uYXdzLmNvbS9ldS13ZXN0LTJfdGVzdFVzZXJQb29sSWQiLCJ2ZXJzaW9uIjoyLCJjbGllbnRfaWQiOiJ0ZXN0Q2xpZW50SWQiLCJvcmlnaW5fanRpIjoiMzU4YmQ1NmEtNWJjOC00MmVmLTkxYTQtYzJiMTU4ODQ4NDE5IiwidG9rZW5fdXNlIjoiYWNjZXNzIiwic2NvcGUiOiJvcGVuaWQgZW1haWwiLCJhdXRoX3RpbWUiOjE3NjgyMzMxMjcsImV4cCI6NDc2ODIzMzQyNywiaWF0IjoxNzY4MjMzMTI3LCJqdGkiOiJhZjZhYTM4YS04M2NmLTQzYzAtOGI0Yy0xYmVhY2E3NzAxODQifQ.TCnobLK59tXof1x_W1lQLYVYrrdEMCFr9BnWK0odcAT2xr4kw_-DRj_c0UGmonYZBPm2bBT01p8omXdZEeyeomEQTOy6N6HT_5VcMUsd76kDiScVPgeAEAmNFFx9ZVmuIeQIz52M-nq0hqX-pFYjBtF96CNQwEuAyEWdNEWvJg3jUnSyNEY9p0sDolzziHyLXIMs8TSDl1ZXBbUFPKW4sEHdULq4RuC6zAmA4g-DxNu1fLUk_9tKjFMBEhJK-Ym9HD2lGXnyeSddELBNpaffBFSqa_mZPUtUsoXFd51C_Egyh1_ubTz7XxqDQpsFvJx_9ge95K-DKz0EgP8HJYT3jstqsfr0DfM0KBCWfIYtdoVHe8NCn7VaeSZmwFoR0hlLDfgVLN8DvHOf0oscyGPZ4tvYAUDhQ5ipiXIDgeDA_sXJHcr0G-0ja6e_HV_4OOZLDZYXx0u48GoTxm_kYpXiyj8BYZ6RbOuIfAzmiPdLrMcTROaRm-0Pt_IzPWTcU9gb"; // pragma: allowlist secret
