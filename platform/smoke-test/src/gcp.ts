import {
  type App,
  type Credential,
  getApp,
  initializeApp,
} from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import {
  ExternalAccountClient,
  type ExternalAccountClientOptions,
} from "google-auth-library";

let app: App | undefined;

function createWifCredential(credentialConfig: string): Credential {
  const config = JSON.parse(credentialConfig) as ExternalAccountClientOptions;
  const externalClient = ExternalAccountClient.fromJSON(config);
  if (!externalClient)
    throw new Error("Failed to create GCP external account client");

  return {
    getAccessToken: async () => {
      const { token } = await externalClient.getAccessToken();
      if (!token) throw new Error("Failed to obtain GCP access token via WIF");

      const expiryDate = externalClient.credentials.expiry_date;
      const expiresIn = expiryDate
        ? Math.max(0, Math.floor((expiryDate - Date.now()) / 1000))
        : 3600;

      return { access_token: token, expires_in: expiresIn };
    },
  };
}

function ensureFirebaseApp(
  credentialConfig: string,
  serviceAccountEmail: string,
): App {
  if (app) return app;

  try {
    app = getApp();
    return app;
  } catch {
    // No default app
  }

  const projectId = serviceAccountEmail.split("@")[1]?.split(".")[0];

  app = initializeApp({
    projectId,
    credential: createWifCredential(credentialConfig),
    serviceAccountId: serviceAccountEmail,
  });

  return app;
}

export async function getAttestationToken(
  credentialConfig: string,
  serviceAccountEmail: string,
  firebaseAppId: string,
): Promise<string> {
  const firebaseApp = ensureFirebaseApp(credentialConfig, serviceAccountEmail);

  const { token } = await getAppCheck(firebaseApp).createToken(firebaseAppId);
  return token;
}
