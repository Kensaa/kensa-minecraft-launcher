FROM node:19 as build_env

WORKDIR /app
COPY package.json ./
RUN yarn
COPY . .
RUN yarn build
RUN yarn install --production

FROM gcr.io/distroless/nodejs20-debian11
COPY --from=build_env /app/ /app/
WORKDIR /app/

ENV PROFILES_FILE="/data/profiles.json"
ENV STATIC_FOLDER="/data/static/"
ENV PORT="40069"
ENV SERVER_NAME=""

EXPOSE 40069

CMD ["dist/server.js"]