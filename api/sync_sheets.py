"""
Admin-only proxy to trigger the `sync-sheets` Supabase edge function on demand.

The edge function accepts EITHER a shared secret (x-sync-secret header) OR the
service-role key as a bearer token. Neither belongs in the browser, so this route
verifies the caller is an admin (same is_request_authorized as the scrape routes)
and forwards to the edge function from the server.

Prefers the shared secret (SHEETS_SYNC_SECRET) because it's the same secret the
Apps Script Web App and the pg_cron job already use, and keeps the service-role
key out of this proxy. Falls back to the service-role key if the shared secret
isn't configured.

POST /api/sync-sheets   (Authorization: Bearer <admin user JWT>)
"""

import json
import os

import requests
from http.server import BaseHTTPRequestHandler

from api.lib.auth import is_request_authorized


def _json(handler, status_code: int, data: dict):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        # 1. Require an admin user (cached admin-role check).
        if not is_request_authorized(self.headers.get("Authorization", "")):
            _json(self, 401, {"error": "Unauthorized"})
            return

        supabase_url = (
            os.environ.get("SUPABASE_URL")
            or os.environ.get("VITE_SUPABASE_URL")
        )
        sync_secret = os.environ.get("SHEETS_SYNC_SECRET")
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url:
            _json(self, 500, {"error": "Server not configured: SUPABASE_URL (or VITE_SUPABASE_URL) is missing"})
            return
        if not sync_secret and not service_key:
            _json(self, 500, {"error": "Server not configured: SHEETS_SYNC_SECRET or SUPABASE_SERVICE_ROLE_KEY is required"})
            return

        # 2. Forward to the edge function. Prefer the shared secret (header auth)
        #    so this proxy doesn't need the service-role key.
        headers = {"Content-Type": "application/json"}
        if sync_secret:
            headers["x-sync-secret"] = sync_secret
            # Edge functions on Supabase still expect a Bearer for the platform-level
            # check; the publishable/anon key satisfies it without granting privileges.
            anon = (
                os.environ.get("SUPABASE_ANON_KEY")
                or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
                or service_key
            )
            if anon:
                headers["Authorization"] = f"Bearer {anon}"
        else:
            headers["Authorization"] = f"Bearer {service_key}"

        try:
            resp = requests.post(
                f"{supabase_url}/functions/v1/sync-sheets",
                headers=headers,
                json={"trigger": "manual"},
                timeout=120,
            )
            try:
                data = resp.json()
            except ValueError:
                data = {"raw": resp.text[:500]}
            _json(self, resp.status_code, data)
        except requests.RequestException as e:
            _json(self, 502, {"error": f"Could not reach sync-sheets function: {e}"})
