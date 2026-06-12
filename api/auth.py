import hashlib
import os
import time
import requests
from urllib.parse import urlparse

# Allowed domains for scraping to prevent SSRF
ALLOWED_DOMAINS = [
    "freejobalert.com",
    "www.freejobalert.com"
]

# Short-lived in-memory cache of positive admin-auth results, keyed by a hash of the
# bearer token. During a "Scrape All"/"Save All" batch the same admin token is validated
# on every request; without this each call makes two blocking Supabase round-trips
# (GoTrue /auth/v1/user + has_any_admin_role RPC), flooding Auth and the DB pool.
# Only successful authorizations are cached; failures always fall through to a live check.
_AUTH_CACHE_TTL_SECONDS = 60
_auth_cache: dict[str, float] = {}


def _token_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def is_request_authorized(auth_header: str) -> bool:
    """
    Verifies that the request is authorized.
    Allows either:
      1. The database/system service role key.
      2. A valid user JWT belonging to an user with admin privileges (role check via RPC).

    Positive results are cached in-process for a short TTL to avoid re-hitting Supabase
    Auth on every request during scrape/save batches.
    """
    if not auth_header:
        return False

    if not auth_header.startswith("Bearer "):
        return False

    token = auth_header.split(" ")[1].strip()
    if not token:
        return False

    # Fast path: this token was authorized very recently — skip the Supabase round-trips.
    cache_key = _token_key(token)
    expires_at = _auth_cache.get(cache_key)
    now = time.time()
    if expires_at is not None:
        if expires_at > now:
            return True
        # Expired entry — drop it and re-validate below.
        _auth_cache.pop(cache_key, None)

    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    
    # Check for service role key first, then fallback to publishable key
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    supabase_key = service_role_key or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("[auth] Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_PUBLISHABLE_KEY is missing from environment variables.")
        return False

    # 1. Trusted trigger/cron check
    if service_role_key and token == service_role_key:
        return True

    # 2. Frontend JWT validation via Supabase Auth API
    try:
        user_response = requests.get(
            f"{supabase_url}/auth/v1/user",
            headers={
                "Authorization": auth_header,
                "apikey": supabase_key
            },
            timeout=5
        )
        if user_response.status_code != 200:
            print(f"[auth] User authentication failed: status code {user_response.status_code}")
            return False

        user_data = user_response.json()
        user_id = user_data.get("id")
        if not user_id:
            return False

        # 3. Role check via database RPC has_any_admin_role
        # Pass user's own token (auth_header) for execution context to authorize RPC check properly
        rpc_response = requests.post(
            f"{supabase_url}/rest/v1/rpc/has_any_admin_role",
            headers={
                "Authorization": auth_header,
                "apikey": supabase_key,
                "Content-Type": "application/json"
            },
            json={"_user_id": user_id},
            timeout=5
        )
        if rpc_response.status_code != 200:
            print(f"[auth] Admin role RPC check failed: status code {rpc_response.status_code}")
            return False

        is_admin = rpc_response.json() is True
        if is_admin:
            # Cache only successful authorizations for a short TTL.
            _auth_cache[cache_key] = now + _AUTH_CACHE_TTL_SECONDS
        return is_admin

    except Exception as e:
        print(f"[auth] Verification error exception: {e}")
        return False


def is_domain_allowed(url: str) -> bool:
    """
    Validates that the given URL hostname belongs to the allowed domain list
    to protect the serverless routes against SSRF attacks.
    """
    if not url:
        return False
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return False
        hostname = hostname.lower()
        
        # Check against allowed list
        for domain in ALLOWED_DOMAINS:
            if hostname == domain or hostname.endswith("." + domain):
                return True
        return False
    except Exception as e:
        print(f"[auth] Domain check exception for URL {url}: {e}")
        return False
