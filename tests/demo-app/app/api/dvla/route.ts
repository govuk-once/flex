import { NextResponse } from "next/server";

import { getJwtClient } from "@/lib/tokenGenerators";

const stage = process.env.STAGE ?? process.env.USER ?? "development";
const flexApiBaseUrl = process.env.FLEX_API_BASE_URL ?? "";

interface DvlaResponse {
  driver?: {
    drivingLicenceNumber?: string;
    firstNames?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  licence?: {
    type?: string;
    status?: string;
  };
  entitlement?: Array<{ categoryCode?: string }>;
  token?: {
    validToDate?: string;
  };
}

function mapToFields(data: DvlaResponse) {
  const fields: Array<{ label: string; value: string }> = [];

  const licenceNumber = data.driver?.drivingLicenceNumber;
  if (licenceNumber) fields.push({ label: "Licence No.", value: licenceNumber });

  const firstName = data.driver?.firstNames ?? "";
  const lastName = data.driver?.lastName ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ");
  if (name) fields.push({ label: "Name", value: name });

  const dob = data.driver?.dateOfBirth;
  if (dob) fields.push({ label: "Date of birth", value: dob });

  const licenceType = data.licence?.type;
  if (licenceType) fields.push({ label: "Licence type", value: licenceType });

  const status = data.licence?.status;
  if (status) fields.push({ label: "Status", value: status });

  const categories = (data.entitlement ?? [])
    .map((e) => e.categoryCode)
    .filter(Boolean)
    .join(", ");
  if (categories) fields.push({ label: "Categories", value: categories });

  const expiry = data.token?.validToDate;
  if (expiry) fields.push({ label: "Expiry", value: expiry });

  return fields;
}

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

    const upstream = await fetch(
      `${flexApiBaseUrl}/app/dvla/v1/driving-licence`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data: DvlaResponse = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream DVLA error: ${upstream.status}` },
        { status: upstream.status },
      );
    }

    return NextResponse.json({ fields: mapToFields(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `DVLA request failed: ${message}` },
      { status: 500 },
    );
  }
}
