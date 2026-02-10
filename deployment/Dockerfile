FROM node:24-alpine3.21 AS builder

WORKDIR /app

COPY . .
RUN npm ci --no-audit --no-fund
RUN npm run build

FROM node:24-alpine3.21 AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

RUN mkdir -p ./db/
RUN touch ./.env

ENTRYPOINT ["node", "dist/index.js"]
CMD []