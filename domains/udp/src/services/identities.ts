import { routeContext } from "@domain";
import { UserId } from "@flex/utils";
import { GetIdentitiesGWResponse } from "@schemas/identity";
import createHttpError from "http-errors";
import status from "http-status";

import { deleteServiceIdentity, postServiceIdentity } from "./identity";

type PostRoute = "POST /v1/identity/:service";
type DeleteRoute = "DELETE /v1/identity/:service";
type GetAllRoute = "GET /v1/identity";

const _postCtx = routeContext<PostRoute>;
const _deleteCtx = routeContext<DeleteRoute>;
const _getCtx = routeContext<GetAllRoute>;

type UpdateRouteContext =
  | ReturnType<typeof _postCtx>
  | ReturnType<typeof _deleteCtx>;

interface LinkIdentityArgs {
  ctx: ReturnType<typeof _postCtx>;
  userId: UserId;
  service: string;
  serviceId: string;
}

interface DeleteIdentityArgs {
  ctx: ReturnType<typeof _deleteCtx>;
  userId: UserId;
  service: string;
  serviceId: string;
}

type GetRouteContext = UpdateRouteContext | ReturnType<typeof _getCtx>;

export async function getAllIdentities(ctx: GetRouteContext) {
  const { auth, integrations, logger } = ctx;

  const response = await integrations.udpGetIdentities({
    path: `/${auth.pairwiseId}`,
  });

  if (!response.ok) {
    logger.error("Failed to get user identities", {
      status: response.error.status,
    });

    if (response.error.status === status.NOT_FOUND) {
      return status.NOT_FOUND;
    }

    throw new createHttpError.BadGateway();
  }

  return response.data;
}

export async function postIdentities(
  ctx: UpdateRouteContext,
  body: GetIdentitiesGWResponse,
) {
  const { auth, integrations, logger } = ctx;

  const response = await integrations.udpPostIdentities({
    path: `/${auth.pairwiseId}`,
    body,
  });

  if (!response.ok) {
    logger.error("Failed to update user identities", {
      status: response.error.status,
    });

    throw new createHttpError.BadGateway();
  }

  return response.data;
}

/**
 * Handles the dual-write orchestration required by UDP to link an identity.
 * Uses a sequential approach with an automated rollback to protect against data drift.
 */
export async function postOrchestrateIdentityLink({
  ctx,
  userId,
  service,
  serviceId,
}: LinkIdentityArgs): Promise<void> {
  await postServiceIdentity(serviceId, service);

  try {
    await updateIdentityList(ctx, service, "append");
  } catch (error) {
    ctx.logger.error(
      "Data drift detected: Failed to update master identity list after KV creation. Rolling back mapping.",
      { userId, service, serviceId, error },
    );

    /**
     * Rollback:
     *  - Attempt to remove the orphaned key-value link if the array listing failed
     */
    try {
      await deleteServiceIdentity(service, serviceId);
    } catch (rollbackError) {
      ctx.logger.error(
        "CRITICAL: Failed to rollback orphaned service identity link",
        {
          userId,
          service,
          rollbackError,
        },
      );
    }

    throw new createHttpError.BadGateway();
  }
}

/**
 * Handles the dual-delete orchestration required by UDP to unlink an identity.
 * Removes the master list reference first. If clearing the specific key-value link
 * fails, it catches the error and attempts to re-append the identity to the master list.
 */
export async function deleteOrchestrateIdentityUnlink({
  ctx,
  userId,
  service,
  serviceId,
}: DeleteIdentityArgs): Promise<void> {
  const listResult = await updateIdentityList(ctx, service, "remove");

  try {
    await deleteServiceIdentity(service, serviceId);
  } catch (error) {
    ctx.logger.error(
      "Data drift detected: Failed to delete key-value identity link after array removal. Initiating rollback.",
      { userId, service, serviceId, error },
    );

    /**
     * Rollback Guard:
     * Only attempt to add it back if it actually existed in the array
     * in the first place (i.e., listResult was not a 404).
     */
    if (listResult !== status.NOT_FOUND) {
      try {
        await updateIdentityList(ctx, service, "append");
      } catch (rollbackError) {
        ctx.logger.error(
          "CRITICAL: Failed to rollback master identity list array after KV deletion failure",
          { userId, service, serviceId, rollbackError },
        );
      }
    }

    throw new createHttpError.BadGateway();
  }
}

/**
 * The following function is used to append or remove identities from a user
 */
type IdentityAction = "append" | "remove";

async function updateIdentityList(
  ctx: UpdateRouteContext,
  targetIdentity: string,
  action: IdentityAction,
) {
  const { logger } = ctx;

  const result = await getAllIdentities(ctx);

  let currentIdentities: string[];

  if (result === status.NOT_FOUND) {
    if (action === "remove") {
      logger.info("Identity list is already empty. Nothing to remove.");
      return status.NOT_FOUND;
    }
    currentIdentities = [];
  } else {
    currentIdentities = result.data.services;
  }

  let updatedList: string[];
  if (action === "append") {
    if (currentIdentities.includes(targetIdentity)) {
      logger.warn(
        `Identity "${targetIdentity}" already exists. Skipping append.`,
      );
      updatedList = currentIdentities;
    } else {
      updatedList = [...currentIdentities, targetIdentity];
    }
  } else {
    updatedList = currentIdentities.filter((id) => id !== targetIdentity);
  }

  const payload: GetIdentitiesGWResponse = {
    data: {
      services: updatedList,
    },
  };

  const response = await postIdentities(ctx, payload);

  return response;
}
