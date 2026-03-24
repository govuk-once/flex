import { NextResponse } from "next/server";

import { getJwtClient } from "@/lib/tokenGenerators";

const stage = process.env.STAGE ?? process.env.USER ?? "development";
const flexApiBaseUrl = process.env.FLEX_API_BASE_URL ?? "";

// Stub response used when the UNS gateway is not yet available (FLEX_UNS_ENABLED !== "true")
const STUB_RESPONSE = {
  fields: [
    { label: "Service", value: "GOV.UK Notify" },
    { label: "Channel", value: "Email · SMS" },
    { label: "Status", value: "Active" },
    { label: "Reference", value: "UNS-2024-00042" },
  ],
};

export async function GET() {
  if (process.env.FLEX_UNS_ENABLED !== "true" || !flexApiBaseUrl) {
    return NextResponse.json(STUB_RESPONSE);
  }

  try {
    const client = await getJwtClient(stage);
    const token = await client.getToken();

    const upstream = await fetch(`${flexApiBaseUrl}/app/uns/v1/preferences`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream UNS error: ${upstream.status}` },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `UNS request failed: ${message}` },
      { status: 500 },
    );
  }
}
