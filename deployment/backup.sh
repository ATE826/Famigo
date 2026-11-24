#!/bin/sh
set -eu
umask 077
cd /opt/famigo
backup_dir=/root/famigo-backups
mkdir -p "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
dump="$backup_dir/database-$stamp.dump"
trap 'rm -f "$dump.tmp"' EXIT
docker compose --env-file .env --env-file secrets.env -f docker-compose.yml -f compose.production.yml exec -T db pg_dump -U famigo -d famigo -Fc --no-owner --no-acl > "$dump.tmp"
mv "$dump.tmp" "$dump"
docker run --rm -v famigo_famigo-uploads:/source:ro -v "$backup_dir:/backup" alpine:3.22 tar -czf "/backup/uploads-$stamp.tar.gz" -C /source .
chmod 600 "$backup_dir/uploads-$stamp.tar.gz"
find "$backup_dir" -maxdepth 1 -type f \( -name 'database-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +6 -delete
printf 'Backup completed: %s\n' "$stamp"
