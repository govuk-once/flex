import { NextResponse } from "next/server";

import { getJwtClient } from "@/lib/tokenGenerators";

const stage = process.env.STAGE ?? process.env.USER ?? "development";
const flexApiBaseUrl = process.env.FLEX_API_BASE_URL ?? "";

export async function GET() {
  if (!flexApiBaseUrl) {
    return NextResponse.json(
      { error: "FLEX_API_BASE_URL is not configured" },
      { status: 503 },
    );
  }

  try {
    const client = await getJwtClient(stage);
    const token = await client.getToken();

    const upstream = await fetch(`${flexApiBaseUrl}/app/dvla/v1/licence`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream DVLA error: ${upstream.status}` },
        { status: upstream.status },
      );
    }

    return NextResponse.json(data ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `DVLA request failed: ${message}` },
      { status: 500 },
    );
  }
}
