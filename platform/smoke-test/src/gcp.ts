import * as admin from "firebase-admin";
import {
  ExternalAccountClient,
  type ExternalAccountClientOptions,
} from "google-auth-library";

let isFirebaseInitialized = false;

function ensureFirebaseInitialized(
  credentialConfig: string,
  serviceAccountEmail: string,
): void {
  if (isFirebaseInitialized || admin.apps.length !== 0) {
    isFirebaseInitialized = true;
    return;
  }

  const config = JSON.parse(credentialConfig) as ExternalAccountClientOptions;
  const externalClient = ExternalAccountClient.fromJSON(config);
  if (!externalClient)
    throw new Error("Failed to create GCP external account client");

  const projectId = serviceAccountEmail.split("@")[1]?.split(".")[0];

  admin.initializeApp({
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
  });

  isFirebaseInitialized = true;
}

export async function getAttestationToken(
  credentialConfig: string,
  serviceAccountEmail: string,
  firebaseAppId: string,
): Promise<string> {
  ensureFirebaseInitialized(credentialConfig, serviceAccountEmail);

  const { token } = await admin.appCheck().createToken(firebaseAppId);
  return token;
}
