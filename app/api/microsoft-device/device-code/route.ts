import { NextResponse } from "next/server";

const DEVICE_TENANT = process.env.MS_DEVICE_TENANT ?? "consumers";
const DEVICE_CLIENT_ID = process.env.MS_DEVICE_CLIENT_ID ?? "ac9f3d86-56e6-4e42-8fd2-4f6c07fc08b9";
const DEVICE_SCOPE = process.env.MS_DEVICE_SCOPE ?? "User.Read Files.Read";

export async function POST() {
  try {
    const body = new URLSearchParams({
      client_id: DEVICE_CLIENT_ID,
      scope: DEVICE_SCOPE,
    });

    const azureResponse = await fetch(
      `https://login.microsoftonline.com/${DEVICE_TENANT}/oauth2/v2.0/devicecode`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }
    );
    const payload = await azureResponse.json();

    return NextResponse.json(payload, { status: azureResponse.status });
  } catch (error) {
    console.error("Device code request failed", error);
    return NextResponse.json({ error: "Failed to request device code." }, { status: 500 });
  }
}
