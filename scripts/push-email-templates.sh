#!/usr/bin/env bash
# Pushes the auth email templates in supabase/templates/ to the hosted
# project via the Management API. Deliberately NOT `supabase config push`:
# that would overwrite the hosted auth config (site_url, confirmations …)
# with local dev values. This touches only subjects and template bodies.
#
# Needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID (the project ref) —
# the same secrets CI already uses for `supabase db push`.
set -euo pipefail

cd "$(dirname "$0")/.."

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${SUPABASE_PROJECT_ID:?SUPABASE_PROJECT_ID is required}"

payload=$(python3 - <<'PY'
import json
from pathlib import Path

# Subjects must match [auth.email.template.*] in supabase/config.toml.
templates = {
    "confirmation": "Confirm your email address",
    "magic_link": "Your sign-in link",
    "recovery": "Reset your password",
    "email_change": "Confirm your new email address",
}

config = {}
for name, subject in templates.items():
    config[f"mailer_subjects_{name}"] = subject
    config[f"mailer_templates_{name}_content"] = Path(
        f"supabase/templates/{name}.html"
    ).read_text()

print(json.dumps(config))
PY
)

curl -fsS -X PATCH \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload" > /dev/null

echo "Email templates pushed."
