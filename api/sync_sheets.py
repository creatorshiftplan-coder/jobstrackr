"""
Admin-only proxy to trigger the `sync-sheets` Supabase edge function on demand.

The edge function authorizes with a shared secret / service-role key — neither of
which should live in the browser. This route verifies the caller is an admin
(via the same is_request_authorized used by the other scrape routes) and then
forwards the request to the edge function using the service-role key that is
already present in the server environment. The edge function and the Apps Script
are unchanged.

POST /api/sync-sheets   (Authorization: Bearer <admin user JWT>)
"""

import json
import os

import requests
from http.server import BaseHTTPRequestHandler

from api.auth import is_request_authorized


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

        supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not service_key:
            _json(self, 500, {"error": "Server not configured (SUPABASE_URL / SERVICE_ROLE_KEY)"})
            return

        # 2. Forward to the edge function with the service-role key (server-side only).
        try:
            resp = requests.post(
                f"{supabase_url}/functions/v1/sync-sheets",
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                },
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
