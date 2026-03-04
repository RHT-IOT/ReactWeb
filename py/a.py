import requests, time

tenant = "consumers"   # personal/family accounts
client_id = "ac9f3d86-56e6-4e42-8fd2-4f6c07fc08b9"

# Step 1: Get device code
resp = requests.post(
    f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/devicecode",
    data={
        "client_id": client_id,
        "scope": "User.Read Files.Read"
    }
)

device_code = resp.json()

print("Go to:", device_code.get("verification_uri"))
print("Enter code:", device_code.get("user_code"))
print(device_code.get("message"))

# Step 2: Poll for token until success
while True:
    token_resp = requests.post(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        data={
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "client_id": client_id,
            "device_code": device_code["device_code"]
        }
    )
    result = token_resp.json()
    if "access_token" in result:
        print("Access token received!")
        access_token = result["access_token"]
        break
    elif result.get("error") == "authorization_pending":
        # wait for user to finish sign-in
        time.sleep(device_code.get("interval", 5))
    else:
        print("Error:", result)
        exit()

# Step 3: Use token to list OneDrive files
files_resp = requests.get(
    "https://graph.microsoft.com/v1.0/me/drive/root/children",
    headers={"Authorization": f"Bearer {access_token}"}
)
print("Your OneDrive files/folders:")
print(files_resp.json())
