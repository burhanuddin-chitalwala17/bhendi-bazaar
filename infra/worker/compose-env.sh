#!/usr/bin/env bash
# Builds the worker's env file from GitHub secrets, one secret per variable.
#
#   SECRETS_JSON='${{ toJSON(secrets) }}' BASE_ENV_FILE="..." ./compose-env.sh WORKER_ENV_
#
# Every secret named <PREFIX><NAME> becomes NAME=value. <PREFIX>FILE, when set, is the base: its
# lines are kept unless an individual secret names the same variable. So a value is changed by
# editing one secret, never by re-pasting the whole file. Prints the file; never echoes a value.
set -euo pipefail

prefix="${1:?usage: compose-env.sh PREFIX}"
base="${BASE_ENV_FILE:-}"

overrides=$(printf '%s' "${SECRETS_JSON:-{\}}" | jq -r --arg p "$prefix" '
  to_entries[]
  | select(.key | startswith($p))
  | select(.key != ($p + "FILE"))
  | "\(.key | ltrimstr($p))=\(.value)"')

filtered="$base"
while IFS= read -r line; do
  [ -z "$line" ] && continue
  name="${line%%=*}"
  filtered=$(printf '%s\n' "$filtered" | grep -v -E "^[[:space:]]*${name}[[:space:]]*=" || true)
done <<< "$overrides"

{
  [ -n "$filtered" ] && printf '%s\n' "$filtered"
  [ -n "$overrides" ] && printf '%s\n' "$overrides"
} | sed '/^$/d'
