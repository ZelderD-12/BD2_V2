#!/bin/sh
set -e

echo "⏳ Esperando a SQL Server en $DB_HOST:$DB_PORT..."
for i in $(seq 1 60); do
  if bun -e "
    const net = require('net');
    const c = net.connect($DB_PORT, '$DB_HOST', () => { c.end(); process.exit(0); });
    c.on('error', () => process.exit(1));
    setTimeout(() => process.exit(1), 2000);
  " 2>/dev/null; then
    echo "✅ SQL Server listo!"
    break
  fi
  echo "⏳ Intento $i/60..."
  sleep 2
done

# Pequeña pausa adicional para que el init DB termine
echo "⏳ Esperando inicialización de base de datos..."
sleep 10

echo "🚀 Iniciando backend en puerto $APP_PORT..."
cd /app/pakages/backend
exec bun --hot src/index.ts
