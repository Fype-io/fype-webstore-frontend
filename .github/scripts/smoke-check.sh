#!/usr/bin/env bash
# Usage: smoke-check.sh <url>
# Passes when the URL answers with any status below 500 (a 404 for a host with no
# store is fine; a 5xx or no answer means the Worker is broken). Retries for ~1 minute
# while the new deployment rolls out.
set -uo pipefail

url="${1:?usage: smoke-check.sh <url>}"

for attempt in 1 2 3 4 5 6; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$url") || code=000
  echo "attempt $attempt: $url -> HTTP $code"
  if [ "$code" != "000" ] && [ "$code" -lt 500 ]; then
    exit 0
  fi
  sleep 10
done

echo "::error::$url did not answer below HTTP 500 after 6 attempts. Roll back with: npx wrangler rollback (add --env staging for staging)"
exit 1
