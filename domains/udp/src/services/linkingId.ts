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

      // --- TEMPORARY WORKAROUND ---
      // Force any key with the specific kid (or all keys) to use PS256
      const patchedKeys = jwkSet.keys.map(key => {
        if (key.kid === "alias/nonprod-govuk-app-jwt-signing-key") {
          return { ...key, alg: "PS256" };
        }
        return key;
      });

      const patchedJwkSet = { ...jwkSet, keys: patchedKeys };
      // ----------------------------

      const JWKS = jose.createLocalJWKSet(patchedJwkSet);

      const { payload } = await jose.jwtVerify<DvlaJwtPayload>(token, JWKS, {
        currentDate: new Date(),
        clockTolerance: 0
      });

      return payload.linking_id ?? null;
    } catch (error) {
      ctx.logger.error("Failed to get extract linking id", {
        error: error
      });
      return null;
    }
  }

  return token;
}
