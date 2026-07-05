#Dev Mode
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

# Production Mode
# Etapa comum: instala dependências completas para compilar NestJS e Prisma.
#FROM node:20-alpine AS builder

# Define o directório interno onde o backend será construído.
#WORKDIR /app

# Copia manifests primeiro para aproveitar cache do npm quando o código muda.
#COPY package*.json ./

# Instala dependências exactas do lockfile, incluindo dev deps necessárias ao build.
#RUN npm ci

# Copia o schema Prisma antes do generate para criar o client tipado.
#COPY prisma ./prisma

# Gera o Prisma Client usado pelo TypeScript durante o build.
#RUN npx prisma ge0nerate

# Copia o restante código depois das dependências para maximizar cache.
#COPY . .

# Compila NestJS para JavaScript em dist/.
#RUN npm run build

# Etapa de dependências de produção: reutiliza node_modules do build e poda dev deps.
#FROM builder AS production-deps

# Remove dependências de desenvolvimento sem fazer um segundo download npm.
#RUN npm prune --omit=dev && npm cache clean --force

# Etapa final: runtime mínimo com dist, Prisma e node_modules de produção.
#FROM node:20-alpine AS runner

# Define ambiente de produção para NestJS e bibliotecas.
#ENV NODE_ENV=production

# Cria directório da app.
#WORKDIR /app

# Copia dependências runtime já podadas.
#COPY --from=production-deps /app/node_modules ./node_modules

# Copia manifests para metadata e comandos npm se necessário.
#COPY package*.json ./

# Copia migrations/schema para `prisma migrate deploy` no arranque.
#COPY prisma ./prisma

# Copia apenas o build compilado, não o código TypeScript completo.
#COPY --from=builder /app/dist ./dist

# Expõe a porta HTTP do NestJS.
#EXPOSE 3000

# Aplica migrations pendentes e inicia o backend compilado.
#CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
