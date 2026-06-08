import { routeContext } from "@domain";
import { GetIdentitiesGWResponse } from "@schemas/identity";
import createHttpError from "http-errors";
import status from "http-status";

type PostRoute = "POST /v1/identity/:service";
type DeleteRoute = "DELETE /v1/identity/:service";
type GetAllRoute = "GET /v1/identity";

const _postCtx = routeContext<PostRoute>;
const _deleteCtx = routeContext<DeleteRoute>;
const _getCtx = routeContext<GetAllRoute>;

type UpdateRouteContext =
  | ReturnType<typeof _postCtx>
  | ReturnType<typeof _deleteCtx>;

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
 * The following function is used to append or remove identities from a user
 */
type IdentityAction = "append" | "remove";

export async function updateIdentityList(
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
