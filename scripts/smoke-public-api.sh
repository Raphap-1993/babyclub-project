#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"
CODE="${2:-}"

if [[ -z "${BASE_URL}" ]]; then
  echo "Uso: bash scripts/smoke-public-api.sh <BASE_URL> [CODE]"
  echo "Ejemplo: bash scripts/smoke-public-api.sh https://babyclubaccess.com ABC123"
  exit 1
fi

TMP_BODY="$(mktemp)"
trap 'rm -f "${TMP_BODY}"' EXIT

pass_count=0
fail_count=0

check_get() {
  local url="$1"
  local name="$2"
  local must_contain="${3:-}"
  local status

  status="$(curl -sS -o "${TMP_BODY}" -w "%{http_code}" "${url}")"

  if [[ "${status}" -ge 200 && "${status}" -lt 300 ]]; then
    if [[ -n "${must_contain}" ]] && ! grep -q "${must_contain}" "${TMP_BODY}"; then
      echo "FAIL ${name} -> HTTP ${status}, sin clave esperada: ${must_contain}"
      fail_count=$((fail_count + 1))
      return
    fi
    echo "OK   ${name} -> HTTP ${status}"
    pass_count=$((pass_count + 1))
  else
    echo "FAIL ${name} -> HTTP ${status}"
    fail_count=$((fail_count + 1))
  fi
}

echo "Running smoke tests on: ${BASE_URL}"
check_get "${BASE_URL}/api/events" "events" "\"events\""
check_get "${BASE_URL}/api/branding" "branding" "{"
check_get "${BASE_URL}/api/layout" "layout" "{"

if [[ -n "${CODE}" ]]; then
  esc_code="$(printf "%s" "${CODE}" | sed 's/ /%20/g')"
  check_get "${BASE_URL}/api/codes/info?code=${esc_code}" "codes_info" "\"code\""
  check_get "${BASE_URL}/api/aforo?code=${esc_code}" "aforo" "\"percent\""
else
  echo "SKIP codes_info y aforo (sin CODE)"
fi

echo "Resumen: OK=${pass_count} FAIL=${fail_count}"

if [[ "${fail_count}" -gt 0 ]]; then
  exit 1
fi
