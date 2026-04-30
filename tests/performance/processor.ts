import { getStubTokenGenerator, getTokenGenerator } from "@flex/testing/e2e";
import { sanitiseStageName } from "@flex/utils";

let cachedJwt: string | undefined;

export async function generateJwt(context: {
  vars: Record<string, string>;
}): Promise<void> {
  if (!cachedJwt) {
    const stage = sanitiseStageName(process.env.STAGE) ?? "development";
    const gen =
      stage === "staging"
        ? await getTokenGenerator(stage)
        : await getStubTokenGenerator();
    cachedJwt = await gen.getToken();
  }
  context.vars["jwt"] = cachedJwt;
}
