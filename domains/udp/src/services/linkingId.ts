import * as jose from "jose";
import { routeContext } from "@domain";
import { JwkSet } from "@schemas/wellKnownJwks";
import createHttpError from "http-errors";

type PostRoute = "POST /v1/identity/:service";
const postCtx = routeContext<PostRoute>;

type PostRouteContext = ReturnType<typeof postCtx>;

interface DvlaJwtPayload extends jose.JWTPayload {
  linking_id?: string;
}

export async function extractServiceId(
  service: string,
  token: string,
  ctx: PostRouteContext,
): Promise<string | null> {

  if (service.toLowerCase() === "dvla") {
    const result = await ctx.integrations.dvlaGetWellKnownJwk({});

    if (!result.ok) {
      ctx.logger.error("Failed to fetch DVLA well-known JWKs", {
        error: result.error,
      });
      throw new createHttpError.BadGateway();
    }
    const jwkSet: JwkSet = result.data;

    try {
      const JWKS = jose.createLocalJWKSet(jwkSet);
      console.log(`JWKs ${JWKS}`)
      console.log(`JWT ${token}`)

      const { payload } = await jose.jwtVerify<DvlaJwtPayload>(token, JWKS);

      return payload.linking_id ?? null;
    } catch (error) {
      console.log(error);
      ctx.logger.error("Failed to get extract linking id", {
        error: error
      });
      return null;
    }
  }

  return token;
}
