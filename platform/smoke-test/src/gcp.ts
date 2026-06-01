import * as admin from "firebase-admin";
import {
  ExternalAccountClient,
  type ExternalAccountClientOptions,
} from "google-auth-library";

export async function getAttestationToken(
  credentialConfig: string,
  serviceAccountEmail: string,
  firebaseAppId: string,
): Promise<string> {
  const config = JSON.parse(credentialConfig) as ExternalAccountClientOptions;
  const externalClient = ExternalAccountClient.fromJSON(config);
  if (!externalClient)
    throw new Error("Failed to create GCP external account client");

  const projectId = serviceAccountEmail.split("@")[1]?.split(".")[0];

  const app = admin.initializeApp(
    {
      projectId,
      credential: {
        getAccessToken: async () => {
          const { token } = await externalClient.getAccessToken();
          if (!token)
            throw new Error("Failed to obtain GCP access token via WIF");
          return { access_token: token, expires_in: 3600 };
        },
      },
      serviceAccountId: serviceAccountEmail,
    },
    `smoke-test-${Date.now().toString()}`,
  );

  const { token } = await admin.appCheck(app).createToken(firebaseAppId);
  return token;
}
