#!/usr/bin/env python3
"""Build and test against the local CLI stack; never print its admin credentials."""
import json
import os
import subprocess
from urllib.parse import urlparse

status = subprocess.run(
    ["node_modules/.bin/supabase", "status", "--output", "json"],
    check=True, capture_output=True, text=True,
)
values = json.loads(status.stdout)
url = values["API_URL"]
parsed = urlparse(url)
if parsed.scheme != "http" or parsed.hostname not in ("localhost", "127.0.0.1", "::1") or not parsed.port:
    raise SystemExit("Refusing nonlocal integration database")
env = os.environ.copy()
env.update(
    TEST_LOCAL_SUPABASE="1", TEST_SUPABASE_URL=url,
    TEST_SUPABASE_SECRET_KEY=values["SECRET_KEY"],
    NEXT_PUBLIC_SUPABASE_URL=url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=values["PUBLISHABLE_KEY"],
    E2E_PRODUCTION="1",
)
subprocess.run(["npm", "run", "build"], env=env, check=True)
subprocess.run(["npm", "run", "test:e2e"], env=env, check=True)
