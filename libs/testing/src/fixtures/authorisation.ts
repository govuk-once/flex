// Field order is important. HttpResponse.json() seems to have some odd field reordering behavior
/**
 * Example JWKS data for testing purposes.
 * taken from google.com
 */
export const examplePublicJWKS = {
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

// Private JWKS for signing the example JWTs
/*
{
  "alg": "RS256",
  "d": "KX5-KyjVqQiJ8jAPy6gKhTG0yAb7p8O94tlTWjsXypoNJELN-ga48vz9JYSdjD--KhO4ZezdcshMV6kM3ch4EB_Dm5x5ez-JZo4J9A2C0O9_afaBxleJRhan4JUrga5Oe6PGzYMSSf5fw3ucBe9ks07mHvufyY6ntAOAs1c_ue7brzJRrA_iDCOE6jJMUp1AJ7aGTu6Bmb1AVD4SexxaqIRdISnSnRT_ACd3mGO7IfqG2StLiRi1Cj0diDIdwL8epfzfCcpob4cl9bEM4vY9z2YQWfkNfMPRGE5ewK_YPE_JBbCZyz60k3yKdw0NhMqQ7JSBd0DcBJRQ2MHyZCipjRppf0GKe-AlZ0kSa96qhPh-oHPQbTO3-uCRQOPsQVlHCrOm23_QhiU-aAijLVssNRXm3he_TJLIrKHIIEgR1pMDaW31YN_zxAFckzCH73avmBpB-GN6AM_eYpgpx5GT_6H1f3GfFNwmRHam9Q72OrW5sifZzzcP3i-TBT53thFf", // pragma: allowlist secret
  "dp": "5Bd98hcz95mlP-72VQkqEFeSPaRMBkVO91iCzV_ADZMkJal2Cs4xdsdWVFCJ6nkUviCrDmCHWmNDMg2FPYJk71b7UudIbIaNbR34mAN2pT-hihgPYp6I9Ga7eCN20_gkVICeGS_IUv93qYHZTvdZ0Z-Krc7OMXJh-B8Rfeh_woG2HS5ix7quP7Iy079PpN7dqL0j3eK0mWdg7tyuZRY0DCzabzB-ujN_RBlLMc_VtD6daTn8CTn78x9Bs_y8kOwL", // pragma: allowlist secret
  "dq": "hOxrn8wkPKkgaG3fHipww1MKCVpR8FJwdo4y6qLKdQzIoxECSUlxt-Ac1kyZqpQgRS6SQZZH4L-bZor5hoaZN-6FWrlRI8GmJVAahSmDbqZXLUzPjKM4W-ypzKcrvgSFp0Zu6w3AmLmyMM7jMbHdF1CoTV-uSluMFSvtYKhZnfGNDAm9bnmsuIxEdlqEBUvDcOZMhPVraCUHNcqXulL2yb_fn8l2rWAMLHiHY52JQSRXfRqstr6mxo7Bi4GqKYYh", // pragma: allowlist secret
  "e": "AQAB",
  "key_ops": [
    "sign"
  ],
  "kty": "RSA",
  "n": "zD5T9VQ4mirMnDOa-Z-Alg2X12NBDNxp1m9ZLTiiT08a7wMDfInDGh5wblIjwolPIDtryk25LfoUl2viVExeCD7AliCSlSBN8ttpLxYtDs0kKmAI3F5SMFrd7KiMB01_itWuDzTNtm4vqU_ZuqzEqzq3586tjD3lsN1vBjMlQZD0r5UdG423Q5qdwNyzBbspjw2zI3rres-FIPQVXWl3VLSmzkSeEIwNXaK5Z5yf9uE5PjZUjKHRgfgOBcfWI8xtmWy_HDvK5eL-3lyoAPYJ4mTNSQjGx7QOsmNKYJlLBilx5f3BdM-rDREhYuYKwj4bEik1_rp5PtoEpu2dC20I9qsPEtgf7r05JD5zhz84zZcZzrF1Sm1AoBsXmCOWIHlGbFql03CVP-JltxLSGNNI2jUosi5YN-78BEScSYnecq22U2wx9k4DT79R81K5ULqHTOcTIex1uy7fR8vGZb61TYDFKb3zHcxnH2P4SpIne5VydOm2fMjjMbJmpskhZv-F", // pragma: allowlist secret
  "p": "9MmmPJS2HgfcDhYeZJEYAZVFafmK8RPUZ5wz_XqJkNA0WsH3z0ng-Vm4WvKKQqATrtAgdbI1vyz5uLY8mwXgATCxuFnTa5P4DOR19S0bEky8Xg-gQ2aIf87VlWghzYfuPrFhHjIAY5H-RL-omy2b_RI7l6fy41uQ4sf2XLrGMNPa_ML3gMikm_cj2t3nKITZtA8YGtLU_DKZqtCHkE7Ic6wzv2dDmc42UduM_4OK2xb5vZG18FJSQymrPZi71J9f", // pragma: allowlist secret
  "q": "1ZlDEIT_JsABt5P7qBT7xJGCPLAgm0tt1ACpe8R532e7NBWGpJSbee91WCNAUj1U0pkBAVv0Syt2cogvg3c17CnDMk7QE2aaTnnsP3-AZxqmo4cPhph8h502FzStx3Vtcan4E0MPm4hap7o5pr-D7JpCrJdsbbulhARvW228WUDY6sBJELdbm4ZCGbQ9QxZADeuyVi6z9UGtnRYUUWqqT68ca4TPoopaqvbI1sDoysGV9A_uCBsZ1_Zo0IQaYh-b", // pragma: allowlist secret
  "qi": "LLP9I6XaOg1dBt3C0yKgRep48r9qiTTEDUcmLgk-Q3Ai-yUjQo7Fny5QAtc1LBMTY9BpkpP7BYSjHRZkrScIxqginbTbsvibvqCqbn0yIvGchoN5zaovYGpj7lVtqI0iPk4unviKdJRb86_-ay1lVmqsb50Hkt-qpTYW3fh_5o0oLBH6nWI9sCx4aHPceriOi42GvfbPRQzcpHxqfhe6_AWlBCFW-sDp_X6Dz5rlnz_oBUGSG80yXnNiL3b-q6me", // pragma: allowlist secret
  "use": "sig",
  "kid": "83fcafa6aad51fddd3c34ad1e9df90d8" // pragma: allowlist secret
}
*/

/**
 *  JWT contents. JWT generated using https://www.jwt.io signed with the above JWK:
 *  header: {
      "typ": "JWT",
      "alg": "RS256",
      "kid": "83fcafa6aad51fddd3c34ad1e9df90d8" // pragma: allowlist secret
    }
 *  payload: {
      "sub": "d6a2b234-e011-7084-f347-912225bd2861",
      "cognito:groups": [
        "eu-west-2_testUserPoolId_onelogin"
      ],
      "iss": "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId",
      "version": 2,
      "client_id": "testClientId",
      "origin_jti": "358bd56a-5bc8-42ef-91a4-c2b158848419",
      "token_use": "access",
      "scope": "openid email",
      "auth_time": 1768233127,
      "exp": 4768233427,
      "iat": 1768233127,
      "jti": "af6aa38a-83cf-43c0-8b4c-1beaca770184"
      "username": "onelogin_urn:fdc:gov.uk:2022:SwProvIeT-P_oLN2JHRrJvV2yaC2mM3vRI_NrlW2yt0"
    }
 */

export const exampleValidJWT =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjgzZmNhZmE2YWFkNTFmZGRkM2MzNGFkMWU5ZGY5MGQ4In0.eyJzdWIiOiJkNmEyYjIzNC1lMDExLTcwODQtZjM0Ny05MTIyMjViZDI4NjEiLCJjb2duaXRvOmdyb3VwcyI6WyJldS13ZXN0LTJfdGVzdFVzZXJQb29sSWRfb25lbG9naW4iXSwiaXNzIjoiaHR0cHM6Ly9jb2duaXRvLWlkcC5ldS13ZXN0LTIuYW1hem9uYXdzLmNvbS9ldS13ZXN0LTJfdGVzdFVzZXJQb29sSWQiLCJ2ZXJzaW9uIjoyLCJjbGllbnRfaWQiOiJ0ZXN0Q2xpZW50SWQiLCJvcmlnaW5fanRpIjoiMzU4YmQ1NmEtNWJjOC00MmVmLTkxYTQtYzJiMTU4ODQ4NDE5IiwidG9rZW5fdXNlIjoiYWNjZXNzIiwic2NvcGUiOiJvcGVuaWQgZW1haWwiLCJhdXRoX3RpbWUiOjE3NjgyMzMxMjcsImV4cCI6NDc2ODIzMzQyNywiaWF0IjoxNzY4MjMzMTI3LCJqdGkiOiJhZjZhYTM4YS04M2NmLTQzYzAtOGI0Yy0xYmVhY2E3NzAxODQiLCJ1c2VybmFtZSI6Im9uZWxvZ2luX3VybjpmZGM6Z292LnVrOjIwMjI6U3dQcm92SWVULVBfb0xOMkpIUnJKdlYyeWFDMm1NM3ZSSV9OcmxXMnl0MCJ9.yto81Gj9CNVsnx9hyAEFcn4LQVw3YiFY9h6QLUP-dUKaMVgFKpTtFTVcHLsAicqufMkhxYY5gBbc460MHbDW1wHUbGDsmz06kjeLK2Jw5S26WLev_ldM5Uq4ks56qtsEO8OHMFmGMSvXtJG8GmRR-ck8Gpn6wEz4GT_xyu0vms29yRKwJSN_wnY1A-e7o4FX5i3PxV-eOXkquI-1PjWX0HRzY2qsbaMncJZpN994L_TaTjORPRTKYaCxvKYNl4coygaZVMlRs6OQjesDLkpKFnMmrVFr1uAZlbxKEKI06pRHiq8XPknyglcVGnM58ZTG-buk-MT2wjaEEB7PpCuQIGtkDhSjYjaebSAhKmKEvsHKN7E_m5vBZuIhPtxkMWa2EUIETl8t9zA22mGsa1UWcm5HYcRoiJDpOhxoPgRE2-9UrYxrRq5PdQuhRuY4vTY4ACCqbe7CpiYrNVtQiyTuiq8_xaGt29bAY1i6tTyPkjNQpWjOVrs9zGq40RAoVY-i"; // pragma: allowlist secret

export const exampleValidJWTUsername =
  "onelogin_urn:fdc:gov.uk:2022:SwProvIeT-P_oLN2JHRrJvV2yaC2mM3vRI_NrlW2yt0";

/**
 *  JWT contents. JWT generated using https://www.jwt.io signed with the above JWKS:
 *  header: {
      "typ": "at+jwt",
      "alg": "RS256",
      "kid": "d27874f4304835544c315b62d5a29c9c" // pragma: allowlist secret
    }
 *  payload: {
      "sub": "d6a2b234-e011-7084-f347-912225bd2861",
      "cognito:groups": [
        "eu-west-2_testUserPoolId_onelogin"
      ],
      "iss": "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId",
      "version": 2,
      "client_id": "testClientId",
      "origin_jti": "358bd56a-5bc8-42ef-91a4-c2b158848419",
      "token_use": "access",
      "scope": "openid email",
      "auth_time": 1768233127,
      "exp": 4768233427,
      "iat": 1768233127,
      "jti": "af6aa38a-83cf-43c0-8b4c-1beaca770184"
      // Missing username field <------------------------------
    }
*/
export const exampleInvalidJWTMissingUsername =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjgzZmNhZmE2YWFkNTFmZGRkM2MzNGFkMWU5ZGY5MGQ4IiwidHlwIjoiSldUIn0.eyJzdWIiOiJkNmEyYjIzNC1lMDExLTcwODQtZjM0Ny05MTIyMjViZDI4NjEiLCJjb2duaXRvOmdyb3VwcyI6WyJldS13ZXN0LTJfdGVzdFVzZXJQb29sSWRfb25lbG9naW4iXSwiaXNzIjoiaHR0cHM6Ly9jb2duaXRvLWlkcC5ldS13ZXN0LTIuYW1hem9uYXdzLmNvbS9ldS13ZXN0LTJfdGVzdFVzZXJQb29sSWQiLCJ2ZXJzaW9uIjoyLCJjbGllbnRfaWQiOiJ0ZXN0Q2xpZW50SWQiLCJvcmlnaW5fanRpIjoiMzU4YmQ1NmEtNWJjOC00MmVmLTkxYTQtYzJiMTU4ODQ4NDE5IiwidG9rZW5fdXNlIjoiYWNjZXNzIiwic2NvcGUiOiJvcGVuaWQgZW1haWwiLCJhdXRoX3RpbWUiOjE3NjgyMzMxMjcsImV4cCI6NDc2ODIzMzQyNywiaWF0IjoxNzY4MjMzMTI3LCJqdGkiOiJhZjZhYTM4YS04M2NmLTQzYzAtOGI0Yy0xYmVhY2E3NzAxODQifQ.TCnobLK59tXof1x_W1lQLYVYrrdEMCFr9BnWK0odcAT2xr4kw_-DRj_c0UGmonYZBPm2bBT01p8omXdZEeyeomEQTOy6N6HT_5VcMUsd76kDiScVPgeAEAmNFFx9ZVmuIeQIz52M-nq0hqX-pFYjBtF96CNQwEuAyEWdNEWvJg3jUnSyNEY9p0sDolzziHyLXIMs8TSDl1ZXBbUFPKW4sEHdULq4RuC6zAmA4g-DxNu1fLUk_9tKjFMBEhJK-Ym9HD2lGXnyeSddELBNpaffBFSqa_mZPUtUsoXFd51C_Egyh1_ubTz7XxqDQpsFvJx_9ge95K-DKz0EgP8HJYT3jstqsfr0DfM0KBCWfIYtdoVHe8NCn7VaeSZmwFoR0hlLDfgVLN8DvHOf0oscyGPZ4tvYAUDhQ5ipiXIDgeDA_sXJHcr0G-0ja6e_HV_4OOZLDZYXx0u48GoTxm_kYpXiyj8BYZ6RbOuIfAzmiPdLrMcTROaRm-0Pt_IzPWTcU9gb"; // pragma: allowlist secret
