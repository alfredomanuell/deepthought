#!/usr/bin/env bash
set -euo pipefail

LOGIN="${1:-}"

if [[ -z "$LOGIN" ]]; then
  echo "Usage: $0 <42login>"
  exit 1
fi

docker exec transcendence_postgres psql \
  -U jarvis \
  -d transcendence \
  -c "UPDATE \"User\"
      SET \"isEmailVerified\" = false,
          \"otpCode\"         = NULL,
          \"otpExpiresAt\"    = NULL,
          \"refreshTokenHash\" = NULL
      WHERE login = '$LOGIN'
      RETURNING id, login, \"isEmailVerified\";"
