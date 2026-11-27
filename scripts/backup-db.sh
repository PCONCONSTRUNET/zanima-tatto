#!/usr/bin/env bash
# Rotina de backup diário automatizado do PostgreSQL e arquivos privados — ZANIMA TATTOO
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "[backup] Gerando dump PostgreSQL..."
docker compose exec -T postgres pg_dump -U zanima -d zanima_tattoo -Fc > "$BACKUP_DIR/zanima-db-$TIMESTAMP.dump"

if [ -d "./storage/private" ]; then
  echo "[backup] Compactando armazenamento privado..."
  tar -czf "$BACKUP_DIR/zanima-files-$TIMESTAMP.tar.gz" -C ./storage private
fi

find "$BACKUP_DIR" -type f -mtime +"$RETENTION_DAYS" -delete
echo "[backup] Concluído: $BACKUP_DIR/zanima-db-$TIMESTAMP.dump"
