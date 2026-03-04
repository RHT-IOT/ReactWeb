
"use client";

import React, { useState } from "react";

const clientId = "ac9f3d86-56e6-4e42-8fd2-4f6c07fc08b9";
const tenant = "consumers";

export default function OneDriveAuth() {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState(null);

  const startAuth = async () => {
    // Step 1: Get device code
    const resp = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/devicecode`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          scope: "User.Read Files.Read",
        }),
      }
    );
    const deviceCode = await resp.json();

    setMessage(deviceCode.message);

    // Step 2: Poll for token
    let accessToken = null;
    while (!accessToken) {
      const tokenResp = await fetch(
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            client_id: clientId,
            device_code: deviceCode.device_code,
          }),
        }
      );
      const result = await tokenResp.json();

      if (result.access_token) {
        accessToken = result.access_token;
      } else if (result.error === "authorization_pending") {
        await new Promise((resolve) => setTimeout(resolve, deviceCode.interval * 1000));
      } else {
        setMessage("Error: " + JSON.stringify(result));
        return;
      }
    }

    // Step 3: Use token to list OneDrive files
    const filesResp = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/children", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const filesJson = await filesResp.json();
    setFiles(filesJson);
  };

  return (
    <div>
      <button onClick={startAuth}>Login to OneDrive</button>
      <p>{message}</p>
      {files && <pre>{JSON.stringify(files, null, 2)}</pre>}
    </div>
  );
}