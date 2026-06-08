import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { updateIdentityList } from "@services/identities";
import {
  deleteServiceIdentity,
  getServiceIdentityLink,
  postServiceIdentity,
} from "@services/identity";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route("POST /v1/identity/:service/:id", async (ctx) => {
  const { pathParams, auth, logger } = ctx;
  // TODO pass linkingToken through via headers
  const { service, id: linkingToken } = pathParams;

  const serviceId = extractServiceId(service, linkingToken);
  if (serviceId === null) {
    logger.error(`Failed to get linking id`, {
      service,
      serviceId,
    });
    throw new createHttpError.BadRequest();
  }

  // TODO: SDK auth alias
  const userId = auth.pairwiseId as UserId;
  const identity = await getServiceIdentityLink(userId);

  if (identity) {
    if (identity.serviceId === serviceId) {
      return { status: status.NO_CONTENT };
    }

    /** Remove old link if user is already linked and has a new linking ID */
    await deleteServiceIdentity(identity.serviceName, identity.serviceId);
  }

  await Promise.all([
    postServiceIdentity(serviceId),
    updateIdentityList(ctx, pathParams.service, "append"),
  ]);

  return { status: status.CREATED };
});

// TODO needs to verify JWT signature and decrypt
function extractServiceId(service: string, token: string): string | null {
  if (service.toLowerCase() === "dvla") {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const [, payloadB64 = ""] = parts;
      const payload = JSON.parse(
        Buffer.from(payloadB64, "base64").toString("utf-8"),
      );

      return payload.linking_id || null;
    } catch {
      return null;
    }
  }

  return token;
}
