import { NextResponse } from "next/server";

const DEVICE_TENANT = process.env.MS_DEVICE_TENANT ?? "consumers";
const DEVICE_CLIENT_ID = process.env.MS_DEVICE_CLIENT_ID ?? "ac9f3d86-56e6-4e42-8fd2-4f6c07fc08b9";

export async function POST(request: Request) {
  try {
    const { deviceCode } = await request.json();

    if (!deviceCode) {
      return NextResponse.json({ error: "deviceCode is required." }, { status: 400 });
    }

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: DEVICE_CLIENT_ID,
      device_code: deviceCode,
    });

    const azureResponse = await fetch(`https://login.microsoftonline.com/${DEVICE_TENANT}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const payload = await azureResponse.json();

    return NextResponse.json(payload, { status: azureResponse.status });
  } catch (error) {
    console.error("Device token request failed", error);
    return NextResponse.json({ error: "Failed to exchange device code." }, { status: 500 });
  }
}
