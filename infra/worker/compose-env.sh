#!/usr/bin/env bash
# Builds the worker's env file from GitHub secrets, one secret per variable.
#
#   WORKER_ENV_DATABASE_URL=... BASE_ENV_FILE="..." ./compose-env.sh WORKER_ENV_
#
# Every non-empty environment variable named <PREFIX><NAME> becomes NAME=value. <PREFIX>FILE, when
# set, is the base: its lines are kept unless an individual variable names the same one. The
# workflow passes each secret by name, never `toJSON(secrets)`, so a step sees only what it needs
# (docs/GTM-READINESS.md B8). Prints the file; never echoes a value.
set -euo pipefail

prefix="${1:?usage: compose-env.sh PREFIX}"
base="${BASE_ENV_FILE:-}"

overrides=""
while IFS= read -r var; do
  [ -z "$var" ] && continue
  [ "$var" = "${prefix}FILE" ] && continue
  value="${!var}"
  # An unset secret reaches the step as an empty string; it names nothing.
  [ -z "$value" ] && continue
  overrides+="${var#"$prefix"}=${value}"$'\n'
done < <(compgen -e | grep -E "^${prefix}[A-Za-z0-9_]+$" | sort || true)

filtered="$base"
while IFS= read -r line; do
  # A continuation line of a multi-line value names no variable; as a pattern it could empty the base.
  [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
  name="${line%%=*}"
  filtered=$(printf '%s\n' "$filtered" | grep -v -E "^[[:space:]]*${name}[[:space:]]*=" || true)
done <<< "$overrides"

{
  if [ -n "$filtered" ]; then printf '%s\n' "$filtered"; fi
  if [ -n "$overrides" ]; then printf '%s' "$overrides"; fi
} | sed '/^$/d'
