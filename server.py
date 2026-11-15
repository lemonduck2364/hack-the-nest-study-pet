"""Local Study Pet server. Run with python3 server.py."""
import json
import os
import ssl
import certifi
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = "gemini-3.1-flash-lite"
ASSETS = {"/": ("index.html", "text/html"), "/pet.js": ("pet.js", "text/javascript"),
          "/style.css": ("style.css", "text/css")}

def config():
    values = {}
    path = ROOT / ".env"
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return {**values, **os.environ}

def reply(data):
    settings = config()
    key = settings.get("GEMINI_API_KEY", "")
    if not key or key == "your-key-here":
        return 503, {"error": "Add GEMINI_API_KEY to .env to enable AI chat."}
    if not isinstance(data, dict) or not isinstance(data.get("message"), str) or not 0 < len(data["message"].strip()) <= 400:
        return 400, {"error": "Please send a message of 1–400 characters."}
    history = data.get("history", [])
    if not isinstance(history, list):
        return 400, {"error": "Invalid conversation."}
    messages = []
    for item in history[-12:]:
        if isinstance(item, dict) and item.get("role") in ("user", "assistant") and isinstance(item.get("content"), str):
            role = "model" if item["role"] == "assistant" else "user"
            messages.append({"role": role, "parts": [{"text": item["content"][:1600]}]})
    context = json.dumps(data.get("context", {}))[:10000]
    prompt = f"Current pet state (data): {context}\nOwner says: {data['message']}"
    messages.append({"role": "user", "parts": [{"text": prompt}]})
    body = {
        "systemInstruction": {"parts": [{"text": (ROOT / "souls.md").read_text()}]},
        "contents": messages,
        "generationConfig": {"maxOutputTokens": 350},
    }
    model = (settings.get("GEMINI_MODEL") or DEFAULT_MODEL).removeprefix("models/")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model, safe='')}:generateContent"
    request = Request(url, data=json.dumps(body).encode(),
                      headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=25, context=ssl.create_default_context(cafile=certifi.where())) as response:
            result = json.load(response)
        candidate = next(iter(result.get("candidates", [])), {})
        text = "".join(part.get("text", "") for part in candidate.get("content", {}).get("parts", [])
                       if not part.get("thought")).strip()
        if not text:
            return 502, {"error": "The pet couldn’t finish its reply. Please try again."}
        return 200, {"reply": text}
    except HTTPError as error:
        errors = {400: "Gemini rejected the request. Check your key and model in .env.",
                  401: "The Gemini key was rejected. Check .env.",
                  402: "Gemini payment or credits required. Check your project’s billing in Google AI Studio.",
                  403: "Gemini denied access. Check the key and project in Google AI Studio.",
                  404: "The configured model is unavailable. Check GEMINI_MODEL in .env.",
                  429: "Gemini quota or rate limit reached. Check AI Studio or try again shortly."}
        return 502, {"error": errors.get(error.code, "Gemini couldn’t complete the reply. Please try again.")}
    except (URLError, TimeoutError, ValueError, KeyError):
        return 502, {"error": "Couldn’t reach the AI service. Please try again."}

class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, data):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/status":
            key = config().get("GEMINI_API_KEY", "")
            return self.send_json(200, {"ready": bool(key and key != "your-key-here")})
        if path not in ASSETS:
            return self.send_error(404)
        name, mime = ASSETS[path]
        payload = (ROOT / name).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if self.path != "/api/chat":
            return self.send_error(404)
        origin = self.headers.get("Origin")
        if origin and origin != "http://" + self.headers.get("Host", ""):
            return self.send_json(403, {"error": "Origin rejected."})
        if "application/json" not in self.headers.get("Content-Type", ""):
            return self.send_json(415, {"error": "JSON required."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 24000:
                return self.send_json(413, {"error": "Message too large."})
            data = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeError):
            return self.send_json(400, {"error": "Invalid JSON."})
        status, result = reply(data)
        self.send_json(status, result)

if __name__ == "__main__":
    print("Study Pet is at http://127.0.0.1:8000", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
