# bun-react-template

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

This project was created using `bun init` in bun v1.3.11. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.



ya tiene por defefcto para ioniciar todo el .\star.bat y el .\stop.bat para que ya funcione todo y debe crear el contenedor que es con 

docker compose up -d --build

ya solo deben de iniciar con los datos que estan en .env de la carpeta backend

make dev              # Iniciar desarrollo
make dev-backend      # Solo backend
make dev-frontend     # Solo frontend
make stop             # Detener todo
make start            # Reiniciar (stop + dev)
make install          # Instalar dependencias
make clean            # Limpiar y reinstalar
make docker-up        # Iniciar Docker
make docker-down      # Detener Docker
make docker-restart   # Reiniciar Docker