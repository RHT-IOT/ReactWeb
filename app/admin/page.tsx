"use client";

import { useState } from "react";
import axios from "axios";
import { msalInstance, loginRequest, initializeMsal } from "../authConfig";

type DriveFile = {
  id: string;
  name: string;
};

export default function MicrosoftLoginPage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string>("");

  const signInAndGetFiles = async () => {
    try {
      setError("");
      await initializeMsal();
      const loginResponse = await msalInstance.loginPopup(loginRequest);
      console.log("Logged in:", loginResponse.account);

      const tokenResponse = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: loginResponse.account,
      });

      console.log("Access Token:", tokenResponse.accessToken);

      const { data } = await axios.get(
        "https://graph.microsoft.com/v1.0/me/drive/root/children",
        {
          headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
        }
      );

      setFiles(Array.isArray(data?.value) ? data.value : []);
    } catch (err) {
      console.error(err);
      setFiles([]);
      setError(err instanceof Error ? err.message : "Microsoft sign-in failed.");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>OneDrive Files (Personal Account)</h1>
      <button className="brand-button button-outline" onClick={signInAndGetFiles}>
        Sign In & Load Files
      </button>
      {error && (
        <p style={{ color: "red", marginTop: 12 }}>
          {error}
        </p>
      )}
      <ul style={{ marginTop: 16 }}>
        {files.map((file) => (
          <li key={file.id}>{file.name}</li>
        ))}
      </ul>
    </div>
  );
}
