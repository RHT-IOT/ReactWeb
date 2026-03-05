import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { tenant = "consumers", clientId, scope = "User.Read Files.Read" } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error_description: "Missing clientId" }, { status: 400 });
    }

    const body = new URLSearchParams({ client_id: clientId, scope });
    const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`, {
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
