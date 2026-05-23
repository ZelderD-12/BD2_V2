FROM oven/bun:1.1-alpine

WORKDIR /app

# Copiar todo el código (sin node_modules)
COPY . .

# Eliminar node_modules locales (vienen con symlinks rotos de Windows)
RUN rm -rf node_modules pakages/*/node_modules

# Instalar dependencias del monorepo
RUN bun install

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
