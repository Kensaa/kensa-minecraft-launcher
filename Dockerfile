FROM node:20-alpine AS base
WORKDIR /app
RUN yarn global add corepack
RUN corepack enable
COPY .yarnrc.yml .yarnrc.yml

# PRUNE
FROM base AS prune
WORKDIR /app
COPY . .
RUN yarn dlx turbo prune server server-ui --docker

# INSTALL 
FROM base AS build
RUN apk add git
WORKDIR /app

COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/yarn.lock ./yarn.lock
RUN yarn
COPY --from=prune /app/out/full/ .
# BUILD
RUN yarn turbo build --filter=server --filter=server-ui

# RUNTIME
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
RUN yarn global add corepack
RUN corepack enable

COPY --from=build /app .

ENV PORT="40069"
ENV SERVER_NAME=""
ENV DATA_DIRECTORY="/data"

# Keep only production deps for server
RUN yarn workspaces focus server --production

# Copy UI build into server public dir
# (adjust depending on your setup)
RUN mkdir -p server/public && \
    cp -r server-ui/dist/* server/public/

USER node
CMD ["node", "/app/server/dist/server.js"]