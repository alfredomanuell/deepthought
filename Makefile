include .env
export

COMPOSE=docker compose

# Define a regra padrão para iniciar o ambiente.
all: prisma-dev up

# Constrói as imagens Docker sem cache para garantir que tudo seja atualizado.
build:
	$(COMPOSE) build --no-cache

# Sobe Postgres, backend e frontend em background.
up:
	$(COMPOSE) up -d --build

# Pára e remove containers mantendo volumes.
down:
	$(COMPOSE) down

# Pára os serviços sem remover containers ou volumes.
stop:
	$(COMPOSE) stop

# Reinicia os serviços principais sem apagar volumes.
restart:
	$(COMPOSE) restart

# Exibe os logs dos serviços em tempo real.
logs:
	$(COMPOSE) logs -f

logs-backend:
	$(COMPOSE) logs -f backend

logs-frontend:
	$(COMPOSE) logs -f frontend

logs-postgres:
	$(COMPOSE) logs -f postgres

# Executa as migrações do Prisma e gera o cliente dentro do container do backend.
prisma-dev:
	$(COMPOSE) run --rm backend sh -c "npx prisma migrate dev && npx prisma generate"

# Executa as migrações do Prisma e gera o cliente para produção, sem prompt de confirmação.
prisma-prod:
	$(COMPOSE) run --rm backend sh -c "npx prisma migrate deploy && npx prisma generate"

# Abre o Prisma Studio.
studio:
	$(COMPOSE) exec backend npx prisma studio --hostname 0.0.0.0

export-db:
	mkdir -p db_backups
	$(COMPOSE) exec -T postgres pg_dump -U $(POSTGRES_USER) $(POSTGRES_DB) > db_backups/backup.sql

import-db:
	$(COMPOSE) exec -T postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) < db_backups/backup.sql

# Remove containers, redes e volumes persistentes, incluindo a BD local.
clean:
	$(COMPOSE) down -v --remove-orphans

# Remove tudo, incluindo imagens Docker, para um reset completo.
fclean: clean
	docker system prune -f --volumes
	docker rmi -f $$(docker images -q)

# Reinicia o ambiente completo.
re: fclean all

.PHONY: all up down build stop logs prisma studio restart clean fclean re
