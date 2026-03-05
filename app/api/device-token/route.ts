import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { tenant = "consumers", clientId, deviceCode } = await request.json();

    if (!clientId || !deviceCode) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Missing clientId or deviceCode" },
        { status: 400 }
      );
    }

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: clientId,
      device_code: deviceCode,
    });

    const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : {};

    return response.ok
      ? NextResponse.json(json)
      : NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "server_error",
        error_description: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}
