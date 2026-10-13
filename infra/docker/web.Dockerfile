FROM node:22.16.0-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY . .
RUN npm run build -w @today/contracts && npm run build -w @today/web

FROM node:22.16.0-alpine AS runtime
ENV NODE_ENV=production PORT=8080 DIST_DIR=/app/dist API_ORIGIN=http://api:3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/web/dist ./dist
COPY --chown=node:node apps/web/server.mjs ./server.mjs
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
