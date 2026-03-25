import urllib.request
import urllib.parse
import urllib.error
import ssl
import json


def extract_file_url(input_data):
    if isinstance(input_data, str):
        return input_data
    if isinstance(input_data, dict):
        files = input_data.get("files", [])
        if files and isinstance(files[0], dict):
            return files[0].get("url")
        return None
    if isinstance(input_data, list):
        if input_data and isinstance(input_data[0], dict):
            return input_data[0].get("url")
        return None
    return None


def download_file_bytes(file_url: str, ssl_context):
    req = urllib.request.Request(
        file_url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
        },
    )
    try:
        with urllib.request.urlopen(req, context=ssl_context) as response:
            return response.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        raise RuntimeError(
            json.dumps(
                {
                    "stage": "download_source_file",
                    "status": e.code,
                    "reason": e.reason,
                    "url": file_url,
                    "hint": "Source URL denied access (often expired signed URL or host policy). Generate a fresh URL and retry.",
                    "response_body": body,
                }
            )
        ) from e


def main(input, filename: str, ACCESS_TOKEN: str, folder_id: str = ""):
    if not filename.lower().endswith(".xlsx"):
        filename = filename + ".xlsx"

    file_url = extract_file_url(input)
    if not file_url:
        return {"error": "No file URL found in input"}

    ssl_context = ssl._create_unverified_context()

    try:
        file_bytes = download_file_bytes(file_url, ssl_context)
    except RuntimeError as e:
        try:
            return {"error": "Source file download failed", **json.loads(str(e))}
        except json.JSONDecodeError:
            return {"error": "Source file download failed", "details": str(e)}

    safe_name = urllib.parse.quote(filename, safe="")
    if folder_id:
        upload_url = f"https://graph.microsoft.com/v1.0/me/drive/items/{folder_id}:/{safe_name}:/content"
    else:
        upload_url = f"https://graph.microsoft.com/v1.0/me/drive/root:/{safe_name}:/content"


    req = urllib.request.Request(upload_url, data=file_bytes, method="PUT")
    req.add_header("Authorization", f"Bearer {ACCESS_TOKEN}")
    req.add_header("Content-Type", "application/octet-stream")

    try:
        with urllib.request.urlopen(req, context=ssl_context) as resp:
            result = resp.read().decode("utf-8")
            return {"message": f"File {filename} uploaded", "onedrive_response": json.loads(result)}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        return {
            "error": "Graph upload failed",
            "status": e.code,
            "reason": e.reason,
            "response_body": err_body,
            "www_authenticate": e.headers.get("WWW-Authenticate"),
            "request_url": upload_url
        }