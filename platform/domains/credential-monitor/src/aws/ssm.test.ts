import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getParameterValue } from "./ssm";

const ssm = mockClient(SSMClient);

const name = "/staging/flex-param/auth/client-id";

describe("getParameterValue", () => {
  beforeEach(() => {
    ssm.reset();
  });

  afterAll(() => {
    ssm.restore();
  });

  it("returns the parameter's value", async () => {
    ssm
      .on(GetParameterCommand, { Name: name })
      .resolves({ Parameter: { Value: "client-123" } });

    await expect(getParameterValue(name)).resolves.toBe("client-123");
  });

  it("returns an empty string value as it is", async () => {
    ssm.on(GetParameterCommand).resolves({ Parameter: { Value: "" } });

    await expect(getParameterValue(name)).resolves.toBe("");
  });

  it("throws when the parameter has no value", async () => {
    ssm.on(GetParameterCommand).resolves({});

    await expect(getParameterValue(name)).rejects.toThrow(
      `Parameter ${name} has no value`,
    );
  });

  it("propagates a failure", async () => {
    ssm.on(GetParameterCommand).rejects(new Error("ParameterNotFound"));

    await expect(getParameterValue(name)).rejects.toThrow("ParameterNotFound");
  });
});
