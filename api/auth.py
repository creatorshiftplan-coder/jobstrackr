import os
import requests
from urllib.parse import urlparse

# Allowed domains for scraping to prevent SSRF
ALLOWED_DOMAINS = [
    "freejobalert.com",
    "www.freejobalert.com"
]

def is_request_authorized(auth_header: str) -> bool:
    """
    Verifies that the request is authorized.
    Allows either:
      1. The database/system service role key.
      2. A valid user JWT belonging to an user with admin privileges (role check via RPC).
    """
    if not auth_header:
        return False
        
    if not auth_header.startswith("Bearer "):
        return False
        
    token = auth_header.split(" ")[1].strip()
    if not token:
        return False

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("[auth] Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.")
        return False

    # 1. Trusted trigger/cron check
    if token == supabase_key:
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
        rpc_response = requests.post(
            f"{supabase_url}/rest/v1/rpc/has_any_admin_role",
            headers={
                "Authorization": f"Bearer {supabase_key}",
                "apikey": supabase_key,
                "Content-Type": "application/json"
            },
            json={"_user_id": user_id},
            timeout=5
        )
        if rpc_response.status_code != 200:
            print(f"[auth] Admin role RPC check failed: status code {rpc_response.status_code}")
            return False

        return rpc_response.json() is True

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
