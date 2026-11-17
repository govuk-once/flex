import { afterEach, describe, expect, it, vi } from "vitest";

import { parseOptions, USAGE } from "./options";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseOptions", () => {
  it("applies the defaults", () => {
    vi.stubEnv("AWS_REGION", undefined);
    expect(parseOptions(["preflight"])).toEqual({
      command: "preflight",
      region: "eu-west-2",
      out: "otel-metrics-evidence",
      apply: false,
      mode: undefined,
      stage: undefined,
      account: undefined,
      hours: 3,
      days: 3,
      stopResourceTags: false,
      force: false,
      api: {
        apiName: "Api",
        apiStage: "prod",
        method: "GET",
        resource: "/app/dvla/v1/vehicle-enquiry/{reg}",
      },
    });
  });

  it("takes the region from AWS_REGION", () => {
    vi.stubEnv("AWS_REGION", "eu-west-1");
    expect(parseOptions(["preflight"]).region).toBe("eu-west-1");
  });

  it("falls back to eu-west-2 when AWS_REGION is empty", () => {
    vi.stubEnv("AWS_REGION", "");
    expect(parseOptions(["preflight"]).region).toBe("eu-west-2");
  });

  it("prefers --region over AWS_REGION", () => {
    vi.stubEnv("AWS_REGION", "eu-west-1");
    expect(parseOptions(["preflight", "--region", "us-east-1"]).region).toBe(
      "us-east-1",
    );
  });

  it("reads every flag", () => {
    expect(
      parseOptions([
        "collect",
        "--out",
        "/tmp/evidence",
        "--stage",
        "dev-1",
        "--hours",
        "1.5",
        "--days",
        "7",
        "--api-name",
        "PrivateGateway",
        "--api-stage",
        "beta",
        "--method",
        "POST",
        "--resource",
        "/x",
      ]),
    ).toMatchObject({
      command: "collect",
      out: "/tmp/evidence",
      stage: "dev-1",
      hours: 1.5,
      days: 7,
      api: {
        apiName: "PrivateGateway",
        apiStage: "beta",
        method: "POST",
        resource: "/x",
      },
    });
  });

  it("reads --apply, --account and --mode for enable", () => {
    expect(
      parseOptions([
        "enable",
        "--mode",
        "scoped",
        "--account",
        "123456789012",
        "--apply",
      ]),
    ).toMatchObject({
      command: "enable",
      mode: "scoped",
      account: "123456789012",
      apply: true,
    });
  });

  it("reads --stop-resource-tags and --force for disable", () => {
    expect(
      parseOptions(["disable", "--stop-resource-tags", "--force"]),
    ).toMatchObject({ stopResourceTags: true, force: true });
  });

  it("allows a dry run without --account", () => {
    expect(parseOptions(["disable"]).account).toBeUndefined();
  });

  it("accepts 120 hours", () => {
    expect(parseOptions(["preflight", "--hours", "120"]).hours).toBe(120);
  });

  it.each([
    [["status"], `Unknown or missing command "status"`],
    [[], `Unknown or missing command ""`],
    [["enable"], "enable needs --mode all or --mode scoped."],
    [
      ["enable", "--mode", "some"],
      `--mode must be one of all, scoped; received "some"`,
    ],
    [["collect"], "collect needs --stage <stage>"],
    [
      ["collect", "--stage", "dev_1"],
      `--stage may contain only letters, digits and hyphens; received "dev_1"`,
    ],
    [["collect", "--stage", "a b"], "--stage may contain only letters"],
    [["preflight", "--hours", "121"], "--hours can be at most 120"],
    [["enable", "--mode", "scoped", "--apply"], "--apply needs --account <id>"],
    [["disable", "--apply"], "--apply needs --account <id>"],
    [
      ["disable", "--account", "1234"],
      `--account must be a 12-digit AWS account ID; received "1234"`,
    ],
    [
      ["enable", "--mode", "scoped", "--profile", "dev"],
      "Unknown arguments: --profile dev. Choose the account with AWS_PROFILE",
    ],
    [
      ["disable", "--keep-resource-tags"],
      "Unknown arguments: --keep-resource-tags.",
    ],
    [["preflight", "extra"], "Unknown arguments: extra."],
    [
      ["preflight", "--hours", "0"],
      `--hours must be a positive number; received "0"`,
    ],
    [
      ["preflight", "--hours", "-1"],
      `--hours must be a positive number; received "-1"`,
    ],
    [
      ["preflight", "--days", "abc"],
      `--days must be a positive number; received "abc"`,
    ],
    [["preflight", "--region"], "--region requires a value"],
  ])("rejects %j", (argv, message) => {
    expect(() => parseOptions(argv)).toThrow(message);
  });

  it("appends the usage text to errors", () => {
    expect(() => parseOptions(["collect"])).toThrow(USAGE);
  });
});
