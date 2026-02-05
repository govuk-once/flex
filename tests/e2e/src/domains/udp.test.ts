import { it } from "@flex/testing/e2e";
import { beforeAll, describe, expect } from "vitest";

const tokenRefresh = async (): Promise<string> => {
  const data = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: "7r88bunbmdsvihr2cdb43lasun",
    refresh_token:
      "eyJjdHkiOiJKV1QiLCJlbmMiOiJBMjU2R0NNIiwiYWxnIjoiUlNBLU9BRVAifQ.LzCCclJP6vBgdPPnrGB_4qOZc1xSsLJPJG1tESeZumblIOZCxdDNG3-09GjzmJfpA73R6k74YXe67lOf2oax1WCU3wt4sxjL4I_go4NQB2vD84tEaIOC2Zz8Ul5qfzZk97KCRDJkst30leA6URU5DR8mkxbo9iPR4SD_L7Jl83_E-5tBHJDAlE4IAH05KqXmov5Th09jssRWbEN_jTaV342DsegyDAS0yIZ12pohLREQH4pYFMPPFmEe8fPx-RSEvnbOB1pZBjxpcFLAx6tKeKEuO84Mtx7zoE90IEFd5rXMKqcoWMUW0zML0kAHAq5TOPN5zJeGsCTG5nZzmoFRJA.qKfCwm5P7Q7LK5Tp.s0G_FqSskaxiP42J8XqCdrFnnRqLCvtjZep52AqWSL2cmd6Oeh7lBqiyjomyEQ0gGVScbqbVFGgtIx9P0lAwaJSYNBWM4aUXg-76gpvuyegayM7P7N_uFpfi41MCc-LFa17XowIa5v5xRDag9-0wMama64s3FORBad98IEztcx_sYwdVJF_KNvygJ52PGYsbhkHEt8K5BarW1bsxhI0lE9CCFQTgdgLhnkeWlEJMNwjVTf5RReH6IvO-wOOiIkNaHm-AhIkMSA55-vlj4o40pmfxRMGC7MT9t37UofJ2SOXWNpnhKzoo0MoOCDJldqiReaSJiAN-uSmMBduEE8SPaOFTpFBfzVCVYkG8bsAg89M5EBedkmsr-L_mHArSN2uQarEj4Jrtv5UnCu0YC16NKMe3FIfeksQ2znhloV5BOM2nRxznsIgzSEhOWIcQ0FWle1rL8xBYPRPjVYhcV3oJCrfahxjpYJhjyUrB2RPlA8CcVXRhNTdnHuYNKxvzs8n3bzdif-EmkcMmmQCjQ5BPLQAFfGJCw50oWgzksrgqWjox8NUydoCbcaIGE5ejJi_7jeV2Eg81-CvqM9S3ziyhIX0MES_91HyPKDthYcl-nxP33y76i-oMHqnbjYTTCUj4MGVr6NmoFocpqpxlkJ19WHfSqOJZbzeU8e3lvrnjqCr0oYHZjz7gc0bf0aPP4Q6AhBNL2OiKzkHHPOiBfieajIey8IDC3oOhax4HO_jxb1vN7eLeRMtOjRG3gZxf2NTKxMBeZFcizBn-MuTO1FKa-Q2fRrzjt2wzAHYnLD7P959Zg3qKLR5tEoGo6M3RBYTrBmp9VPkxph1FcJwh4BivJOkJVRehcVVpittwUwi_oCny8w5pyTmKcfFLPgt-X14lzLynA2na1tGPuvS7ZibVe1nVcG9pwqfvOEPt5FYQrfH1dU0Xhf7v6D3g7rUYwW7ZTtB6zKiSyfeELUeMNhFfDvRrwA35Xk5X64qdBoRSwIAsdc1VBrhX2ZMBCJbCsIE-NxB4QbRHQ__OAuhY3DIRJxg1M5V8O-w0EkzYOuivOVlDvK6GZJBGRC-bY9puCOyzqBLd-2zCeyBEtFajdTvsTHYJDFa6lr3cRXMB3eXpHIBlzsCXkU4NeN9RlP4f3ITnKpej9vMn97M-5t5DNhzHErACeGMZ__EvjrRT-I-brwIfZrDRo9dlYI6qpWexoxnAlt-oB781iCzuuNcwN3Y2KiJtE7WhsZOdG3mpTceC_Oh_336JeE1a9wCodK9GVC2B4-xe6D6z-RVCMpfZAEVPfiMmoQ.G4k5SAVaEqF7tSo-xJ40EQ",
  });

  const tokenResponse = await fetch(
    `https://4y369hyvja.execute-api.eu-west-2.amazonaws.com/staging/oauth2/token`,
    {
      method: "POST",
      body: data,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    },
  );
  const response = await tokenResponse.json();
  return response.access_token;
};

describe("UDP domain", () => {
  const ingressPath = "/app";
  const domainVersion = "v1";
  const endpoint = `${ingressPath}/${domainVersion}/user`;
  const user = { name: "John Doe" };
  let token: string;
  beforeAll(async () => {
    token = await tokenRefresh();
  });

  it("rejects request at CloudFront when unauthenticated", async ({
    cloudfront,
  }) => {
    const response = await cloudfront.client.post(endpoint, {
      body: user,
    });

    expect(response.headers.get("apigw-requestid")).toBeNull();
    expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
    expect(response).toMatchObject({
      status: 401,
      statusText: "Unauthorized",
      body: "Unauthorized: no authorization header provided",
    });
  });

  it("rejects request at CloudFront when Bearer token is empty", async ({
    cloudfront,
  }) => {
    const response = await cloudfront.client.post(endpoint, {
      body: user,
      headers: { Authorization: "Bearer " },
    });

    expect(response.headers.get("apigw-requestid")).toBeNull();
    expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
    expect(response).toMatchObject({
      status: 401,
      statusText: "Unauthorized",
      body: "Unauthorized: authentication header invalid",
    });
  });

  describe("/get user", () => {
    // TODO: Replace with valid test user token
    it("returns a 200 and notification ID", async ({ cloudfront }) => {
      // const token = "todo.valid.token";
      const response = await cloudfront.client.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response).toMatchObject({
        status: 200,
        body: {
          notificationId: expect.any(String) as string,
          preferences: {
            notificationsConsented: true,
            analyticsConsented: true,
            updatedAt: expect.any(String) as string,
          },
        },
      });
    });

    it("returns the same notification ID for the same user", async ({
      cloudfront,
    }) => {
      const token = "todo.valid.token";
      const request = cloudfront.client.get<{ notificationId: string }>(
        endpoint,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const [response1, response2] = await Promise.all([request, request]);

      expect(response1.body?.notificationId).toBe(
        response2.body?.notificationId,
      );
    });
  });

  describe.todo("/patch user", () => {
    // TODO: pending valid tokens
    it("returns user preferences updated successfully", async ({
      cloudfront,
    }) => {
      const token = "todo.valid.token";
      const response = await cloudfront.client.patch(endpoint, {
        body: {
          notificationsConsented: true,
          analyticsConsented: true,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        preferences: {
          notificationsConsented: true,
          analyticsConsented: true,
          updatedAt: expect.any(String) as string,
        },
      });
    });

    it("rejects invalid payloads", async ({ cloudfront }) => {
      const token = "todo.valid.token";
      const response = await cloudfront.client.patch(endpoint, {
        body: { notificationsConsented: "yes" },
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response).toMatchObject({
        status: 400,
      });
    });
  });
});
