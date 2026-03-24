import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { baseUrl, token } = await request.json();

  if (!baseUrl || !token) {
    return NextResponse.json(
      { error: "baseUrl and token are required" },
      { status: 400 }
    );
  }

  const upstream = await fetch(`${baseUrl}/app/udp/v1/users`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await upstream.json().catch(() => null);

  return NextResponse.json(data ?? {}, { status: upstream.status });
}
