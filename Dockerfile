FROM oven/bun:1.1-alpine

WORKDIR /app

# Copiar archivos de dependencias primero (caching)
COPY package.json bun.lock ./
COPY pakages/backend/package.json ./pakages/backend/
COPY pakages/frontend/package.json ./pakages/frontend/

# Instalar dependencias
RUN bun install --frozen-lockfile --production

# Copiar el resto del código
COPY . .

EXPOSE 8080

# Healthcheck para esperar SQL Server
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]