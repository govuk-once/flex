import { getJwtClient } from "@/lib/tokenGenerators";
import { NextResponse } from "next/server";

const stage = process.env.STAGE ?? process.env.USER ?? "development";

export async function GET() {
  try {
    const client = await getJwtClient(stage);
    const token = await client.getToken();
    return NextResponse.json({ token, stage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate token: ${message}` },
      { status: 500 }
    );
  }
}
