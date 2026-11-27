#!/usr/bin/env bash
# Restauração segura de backup PostgreSQL — ZANIMA TATTOO
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Uso: $0 <caminho-do-arquivo.dump>"
  exit 1
fi

DUMP_FILE="$1"
echo "[restore] Restaurando $DUMP_FILE em zanima_tattoo..."
cat "$DUMP_FILE" | docker compose exec -T postgres pg_restore -U zanima -d zanima_tattoo --clean --if-exists
echo "[restore] Restauração concluída."
