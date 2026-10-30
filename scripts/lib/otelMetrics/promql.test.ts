import { afterEach, describe, expect, it, vi } from "vitest";

import type { Result } from "./awsCli";
import { tryRun } from "./awsCli";
import type { PromqlReply } from "./promql";
import {
  curlConfig,
  describeReply,
  isSuccess,
  listOf,
  matrixOf,
  promql,
  vectorOf,
} from "./promql";

vi.mock("./awsCli", () => ({ tryRun: vi.fn() }));

const stubSigningValue = "SIGNING";
const credentials = { AccessKeyId: "AKID", SecretAccessKey: stubSigningValue };

function reply(
  httpStatus: number,
  body?: object,
  raw = "",
): Result<PromqlReply> {
  return {
    ok: true,
    value: { httpStatus, body: body as PromqlReply["body"], raw },
  };
}

afterEach(() => {
  vi.mocked(tryRun).mockReset();
});

describe("curlConfig", () => {
  it("signs a form POST for the monitoring service", () => {
    expect(
      curlConfig("eu-west-2", credentials, "query", [["query", "up"]]),
    ).toBe(
      [
        `url = "https://monitoring.eu-west-2.amazonaws.com/api/v1/query"`,
        `aws-sigv4 = "aws:amz:eu-west-2:monitoring"`,
        `user = "AKID:SIGNING"`,
        `header = "Content-Type: application/x-www-form-urlencoded"`,
        `request = "POST"`,
        `data-urlencode = "query=up"`,
        String.raw`write-out = "\n__HTTP_STATUS__:%{http_code}"`,
        "silent",
        "show-error",
        "",
      ].join("\n"),
    );
  });

  it("adds the session token header when there is one", () => {
    expect(
      curlConfig(
        "eu-west-2",
        { ...credentials, SessionToken: "TOKEN" },
        "labels",
        [],
      ),
    ).toContain(
      `user = "AKID:SIGNING"\nheader = "x-amz-security-token: TOKEN"\n`,
    );
  });

  it("leaves the token header out when there is none", () => {
    expect(curlConfig("eu-west-2", credentials, "labels", [])).not.toContain(
      "x-amz-security-token",
    );
  });

  it("sends an empty body when there are no parameters", () => {
    expect(curlConfig("eu-west-2", credentials, "labels", [])).toContain(
      `request = "POST"\ndata = ""\n`,
    );
  });

  it("writes one data-urlencode line per parameter, in order", () => {
    const config = curlConfig("eu-west-2", credentials, "query_range", [
      ["query", "sum(x)"],
      ["start", "1"],
      ["end", "2"],
      ["step", "300"],
    ]);
    expect(config).toContain(
      [
        `data-urlencode = "query=sum(x)"`,
        `data-urlencode = "start=1"`,
        `data-urlencode = "end=2"`,
        `data-urlencode = "step=300"`,
      ].join("\n"),
    );
  });

  it("escapes quotes, backslashes and newlines so each option stays on one line", () => {
    const config = curlConfig("eu-west-2", credentials, "query", [
      ["query", `{"a"="b\\c"}\nx`],
    ]);
    expect(config).toContain(
      String.raw`data-urlencode = "query={\"a\"=\"b\\c\"}\nx"`,
    );
    expect(config.split("\n")).toHaveLength(10);
  });
});

describe("promql", () => {
  it("passes the config on stdin and keeps credentials out of the arguments", () => {
    vi.mocked(tryRun).mockReturnValue({
      ok: true,
      value: `{"status":"success","data":[]}\n__HTTP_STATUS__:200`,
    });
    promql("eu-west-2", credentials, "labels", []);
    const [command, args, input] = vi.mocked(tryRun).mock.calls[0] ?? [];
    expect(command).toBe("curl");
    expect(args).toEqual(["-K", "-"]);
    expect(input).toContain("AKID:SIGNING");
  });

  it("splits the body from the status code", () => {
    vi.mocked(tryRun).mockReturnValue({
      ok: true,
      value: `{"status":"success","data":["a"]}\n__HTTP_STATUS__:200`,
    });
    expect(promql("eu-west-2", credentials, "labels", [])).toEqual({
      ok: true,
      value: {
        httpStatus: 200,
        body: { status: "success", data: ["a"] },
        raw: `{"status":"success","data":["a"]}`,
      },
    });
  });

  it("keeps a body that is not JSON as raw text", () => {
    vi.mocked(tryRun).mockReturnValue({
      ok: true,
      value: "<html>denied</html>\n__HTTP_STATUS__:403",
    });
    expect(promql("eu-west-2", credentials, "labels", [])).toEqual({
      ok: true,
      value: { httpStatus: 403, body: undefined, raw: "<html>denied</html>" },
    });
  });

  it("reports status 0 when the marker is missing", () => {
    vi.mocked(tryRun).mockReturnValue({ ok: true, value: "partial" });
    expect(promql("eu-west-2", credentials, "labels", [])).toEqual({
      ok: true,
      value: { httpStatus: 0, body: undefined, raw: "partial" },
    });
  });

  it("passes a curl failure through", () => {
    vi.mocked(tryRun).mockReturnValue({ ok: false, error: "curl: (6)" });
    expect(promql("eu-west-2", credentials, "labels", [])).toEqual({
      ok: false,
      error: "curl: (6)",
    });
  });
});

describe("isSuccess", () => {
  it("needs HTTP 200 and status success", () => {
    expect(isSuccess(reply(200, { status: "success" }))).toBe(true);
  });

  it.each([
    ["an error status", reply(200, { status: "error" })],
    ["a non-200 code", reply(400, { status: "success" })],
    ["no body", reply(200)],
    ["a failed request", { ok: false, error: "x" } as const],
  ])("rejects %s", (_, value) => {
    expect(isSuccess(value)).toBe(false);
  });
});

describe("matrixOf, vectorOf and listOf", () => {
  const series = [{ metric: { a: "b" }, values: [[1, "2"]] }];
  const samples = [{ metric: { a: "b" }, value: [1, "2"] }];

  it("returns the matrix result", () => {
    expect(
      matrixOf(reply(200, { status: "success", data: { result: series } })),
    ).toEqual(series);
  });

  it("returns the vector result", () => {
    expect(
      vectorOf(reply(200, { status: "success", data: { result: samples } })),
    ).toEqual(samples);
  });

  it("returns a list result", () => {
    expect(listOf(reply(200, { status: "success", data: ["a", "b"] }))).toEqual(
      ["a", "b"],
    );
  });

  it("returns an empty list when data is not an array", () => {
    expect(listOf(reply(200, { status: "success", data: {} }))).toEqual([]);
  });

  it("returns an empty result when data has no result", () => {
    expect(matrixOf(reply(200, { status: "success", data: {} }))).toEqual([]);
    expect(vectorOf(reply(200, { status: "success" }))).toEqual([]);
  });

  it("returns empty results for a failed reply", () => {
    const failed = reply(400, { status: "error", data: { result: series } });
    expect(matrixOf(failed)).toEqual([]);
    expect(vectorOf(failed)).toEqual([]);
    expect(listOf(failed)).toEqual([]);
  });
});

describe("describeReply", () => {
  it("describes a success", () => {
    expect(describeReply(reply(200, { status: "success" }))).toBe(
      "HTTP 200 success",
    );
  });

  it("includes warnings", () => {
    expect(
      describeReply(
        reply(200, { status: "success", warnings: ["one", "two"] }),
      ),
    ).toBe("HTTP 200 success (warnings: one; two)");
  });

  it("describes an API error", () => {
    expect(
      describeReply(
        reply(400, {
          status: "error",
          errorType: "bad_data",
          error: "parse error",
        }),
      ),
    ).toBe("HTTP 400 bad_data: parse error");
  });

  it("falls back to the first 300 characters of the raw body", () => {
    const raw = "x".repeat(400);
    expect(describeReply(reply(403, undefined, raw))).toBe(
      `HTTP 403 error: ${"x".repeat(300)}`,
    );
  });

  it("describes a curl failure", () => {
    expect(describeReply({ ok: false, error: "curl: (6)" })).toBe(
      "curl failed: curl: (6)",
    );
  });
});
