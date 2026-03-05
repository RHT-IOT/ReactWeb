import { NextResponse } from "next/server";
import https from "node:https";

const WEBHOOK_URL = "https://trigger.ai-plugin.io/triggers/webhook/ri2mqr6sW35pJh3HjshWMV4i";

export const runtime = "nodejs";

function postWebhookWithBody(accessToken: string, fileName: string) {
  const payload = JSON.stringify({
    access_token: accessToken,
    file_name: fileName,
  });

  return new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const request = https.request(
      WEBHOOK_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "*/*",
          "User-Agent": "Mozilla/5.0",
          Connection: "keep-alive",
          "Content-Length": Buffer.byteLength(payload).toString(),
        },
      },
      (response) => {
        let responseBody = "";
        response.on("data", (chunk) => {
          responseBody += chunk.toString();
        });
        response.on("end", () => {
          resolve({ statusCode: response.statusCode ?? 500, body: responseBody });
        });
      }
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

export async function POST(request: Request) {
  try {
    const body: any = await request.json();
    const normalizedAccessToken = typeof body?.access_token === "string" ? body.access_token.trim() : "";
    const normalizedFileName = typeof body?.file_name === "string" ? body.file_name.trim() : "";

    if (!normalizedAccessToken || !normalizedFileName) {
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "Missing required body fields: access_token and/or file_name",
        },
        { status: 400 }
      );
    }

    const response = await postWebhookWithBody(normalizedAccessToken, normalizedFileName);

    const text = response.body;
    let payload: unknown = { message: text };
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    return response.statusCode >= 200 && response.statusCode < 300
      ? NextResponse.json(payload)
      : NextResponse.json(payload, { status: response.statusCode });
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
