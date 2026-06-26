import { parseResponseBody } from "@flex/utils";
import { z } from "zod";

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: { status: number; message: string; body?: unknown } };

export async function typedFetch<T>(
  requestPromise: Promise<Response>,
  responseSchema?: z.ZodType<T>,
): Promise<ApiResult<T>> {
  const res = await requestPromise;

  if (!res.ok) {
    const body = await parseResponseBody<{ message?: string }>(res);
    return {
      ok: false,
      error: {
        status: res.status,
        message: body?.message ?? res.statusText,
        body,
      },
    };
  }

  const rawBody = await parseResponseBody<unknown>(res);
  const parsed = responseSchema?.safeParse(rawBody) ?? {
    success: true,
    data: rawBody as T,
  };

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        status: 422,
        message: "Response validation failed",
        body: z.treeifyError(parsed.error),
      },
    };
  }

  return { ok: true, status: res.status, data: parsed.data };
}
