#!/bin/sh
set -e

echo "⏳ Esperando a SQL Server en $DB_HOST:$DB_PORT..."
for i in $(seq 1 30); do
  if bun -e "
    const net = require('net');
    const c = net.connect($DB_PORT, '$DB_HOST', () => { c.end(); process.exit(0); });
    c.on('error', () => process.exit(1));
    setTimeout(() => process.exit(1), 2000);
  " 2>/dev/null; then
    echo "✅ SQL Server listo!"
    break
  fi
  echo "⏳ Intento $i/30..."
  sleep 2
done

echo "🚀 Iniciando backend en puerto $APP_PORT..."
cd /app/pakages/backend
exec bun --hot src/index.ts