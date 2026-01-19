// Field order is important. HttpResponse.json() seems to have some odd field reordering behavior
/**
 * Example JWKS data for testing purposes.
 * taken from google.com
 */
export const exampleJWKS = {
  keys: [{
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
}]
}

/**
 *  JWT contents. JWT generated using https://www.scottbrady.io/tools/jwt with the above JWKS:
 *  header: {
      "typ": "at+jwt",
      "alg": "RS256",
      "kid": "d27874f4304835544c315b62d5a29c9c" // pragma: allowlist secret
    }
 *  payload: {
      "iss": "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_testUserPoolId",
      "aud": "testClientId",
      "sub": "5be86359073c434bad2da3932222dabe", // pragma: allowlist secret
      "client_id": "my_client_app",
      "exp": 4072434877,
      "iat": 1768744550,
      "jti": "4bc0f0ca2bb8d878b9919f0b81228c1f" // pragma: allowlist secret
    }
 */
export const exampleValidJWT = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjgzZmNhZmE2YWFkNTFmZGRkM2MzNGFkMWU5ZGY5MGQ4IiwidHlwIjoiSldUIn0.eyJzdWIiOiI1YmU4NjM1OTA3M2M0MzRiYWQyZGEzOTMyMjIyZGFiZSIsImp0aSI6IjIzNDE0MzUiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJjbGllbnRfaWQiOiJ0ZXN0Q2xpZW50SWQiLCIiOiIiLCJuYmYiOjE3Njg3NjU1OTgsImV4cCI6MTc2ODg1NTY3OSwiaWF0IjoxNzY4NzY1NTk4LCJpc3MiOiJodHRwczovL2NvZ25pdG8taWRwLmV1LXdlc3QtMi5hbWF6b25hd3MuY29tL2V1LXdlc3QtMl90ZXN0VXNlclBvb2xJZCIsImF1ZCI6InRlc3RDbGllbnRJZCJ9.lDT5Ms-RIAf3ywX7UWZxTFPKnuCk967eU-tsC8MRidqCrraJovUb2_xgxpHoYGTDISFZTzNOYzvcq8KQrd-9ALEAcctuqYb1a31pJw9t9yEBaT954JdCenOhDpb1mmFbkb-f50RskRM9yVGWO0zDdLErvRACpGtrDCkERr6tvtWICszFqlksm5tc-fomiAwLc4YvfTgnt20Gjc6WMsEFZ34ncIqXMe0sYAfCbgL8ZGcehcJgKvYLV8DgQmtYnjaOg1hAs52u8A3R9tUp93AbIGYc1mVB7KaGll21WOzjmy6_mL6NfIhgZj4L2om4ps0zUkLNAe3iPKdYQGO8MCsuRIh_HvqOlU54JhT6E7RvqR56ylXaLGeLOJykRTruCm_ctC6r8j8jd-f-31itTmNnkmnZ9nIEMDxFziP8ApbU8i-u-T_ScpCNe6MrJRG9lQw-3o1WLMN_QaleytEhBILXWW5L2nRc59-fEjEfCwj4l20yrJ0QkvB5EUYYyG3Vx2o9"; // pragma: allowlist secret
