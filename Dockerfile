FROM oven/bun:1.1-alpine

WORKDIR /app

# Solo exponer puertos
EXPOSE 3000
EXPOSE 8080

# Sin comando, solo la imagen