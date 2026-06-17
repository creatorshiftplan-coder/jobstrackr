"""
Google Indexing API client.
─────────────────────────────
Notifies Google when a JobPosting URL is added/updated or removed so that
time-sensitive job pages get crawled within minutes/hours instead of waiting
for the sitemap to be recrawled. The Indexing API officially supports
JobPosting (and BroadcastEvent) pages — exactly our use case.

Auth: service-account JWT (OAuth2). The FULL service-account JSON key must be
stored in the GOOGLE_INDEXING_SA_KEY env var — either as raw JSON or as
base64-encoded JSON. The service account's client_email must also be added as
an Owner of the property in Google Search Console.

Requires: google-auth (see requirements.txt). All google-auth imports are
deferred into functions so importing this module never fails if the dependency
is missing. Every public call no-ops safely (never raises) so a misconfigured
or missing credential can never block job scraping/insertion.
"""

import base64
import json
import os
from typing import Optional

ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"
SCOPES = ["https://www.googleapis.com/auth/indexing"]

# Cached AuthorizedSession; reused across calls within a warm function instance.
_session = None
_session_loaded = False


def _load_credentials():
    """Parse GOOGLE_INDEXING_SA_KEY into service-account credentials, or None."""
    raw = os.environ.get("GOOGLE_INDEXING_SA_KEY")
    if not raw:
        return None
    raw = raw.strip()

    # Accept either raw JSON or base64-encoded JSON.
    if not raw.startswith("{"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except Exception:
            print("[indexing] GOOGLE_INDEXING_SA_KEY is neither JSON nor base64-encoded JSON")
            return None

    try:
        info = json.loads(raw)
    except Exception:
        print("[indexing] GOOGLE_INDEXING_SA_KEY could not be parsed as JSON")
        return None

    if not isinstance(info, dict) or "client_email" not in info or "private_key" not in info:
        print(
            "[indexing] GOOGLE_INDEXING_SA_KEY is missing client_email/private_key — "
            "it must contain the FULL service-account JSON, not just a key id"
        )
        return None

    try:
        from google.oauth2 import service_account
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    except Exception as e:
        print(f"[indexing] failed to build credentials: {e}")
        return None


def _get_session():
    """Return a cached AuthorizedSession, or None if credentials are unavailable."""
    global _session, _session_loaded
    if _session_loaded:
        return _session
    _session_loaded = True

    creds = _load_credentials()
    if creds is None:
        _session = None
        return None
    try:
        from google.auth.transport.requests import AuthorizedSession
        _session = AuthorizedSession(creds)
    except Exception as e:
        print(f"[indexing] failed to create authorized session: {e}")
        _session = None
    return _session


def notify_google_indexing(url: str, action: str = "URL_UPDATED") -> dict:
    """
    Notify Google's Indexing API about a JobPosting URL.

    action: "URL_UPDATED" when a page is added or changed,
            "URL_DELETED" when a page is removed/expired.

    Returns a status dict and never raises, so callers are never blocked by an
    indexing failure.
    """
    if not url:
        return {"status": "skipped", "reason": "no url"}
    if action not in ("URL_UPDATED", "URL_DELETED"):
        return {"status": "skipped", "reason": f"invalid action {action!r}"}

    session = _get_session()
    if session is None:
        return {"status": "skipped", "reason": "indexing credentials unavailable"}

    try:
        resp = session.post(ENDPOINT, json={"url": url, "type": action}, timeout=10)
        if resp.status_code == 200:
            return {"status": "ok", "url": url, "action": action}
        body = (resp.text or "")[:300]
        print(f"[indexing] {action} {url} -> HTTP {resp.status_code}: {body}")
        return {"status": "error", "url": url, "http_status": resp.status_code, "body": body}
    except Exception as e:
        print(f"[indexing] request failed for {url}: {e}")
        return {"status": "error", "url": url, "error": str(e)}
