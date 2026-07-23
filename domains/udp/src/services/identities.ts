import { routeContext } from "@domain";
import createHttpError from "http-errors";
import status from "http-status";

type PostRoute = "POST /v1/identity/:service";
type DeleteRoute = "DELETE /v1/identity/:service";
type GetAllRoute = "GET /v1/identity";

const _postCtx = routeContext<PostRoute>;
const _deleteCtx = routeContext<DeleteRoute>;
const _getCtx = routeContext<GetAllRoute>;

type UpdateRouteContext =
  ReturnType<typeof _postCtx> | ReturnType<typeof _deleteCtx>;

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
