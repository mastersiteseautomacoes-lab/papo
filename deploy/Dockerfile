# Imagem do servidor do Papo para a VPS (interface + API + WebSocket + proxy /lk).
# O LiveKit e o Caddy rodam em contêineres próprios (veja docker-compose.yml).
# Contexto de build: a raiz do repositório.

FROM node:24-slim AS build
WORKDIR /app
# O Electron só é usado no app de Windows; não precisa baixar o binário aqui.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm_config_update_notifier=false npm_config_fund=false
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

FROM node:24-slim
# O servidor sai empacotado em um único arquivo (build/server.cjs); só precisa do Node e da interface pronta.
ENV NODE_ENV=production NODE_NO_WARNINGS=1 \
    PORT=38080 HOST=0.0.0.0 \
    DB_FILE=/data/papo.db DIST_DIR=/app/dist
WORKDIR /app
COPY --from=build /app/build/server.cjs ./build/server.cjs
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 38080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:38080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "build/server.cjs"]
