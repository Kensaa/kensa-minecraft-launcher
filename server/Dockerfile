FROM node:19

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV PROFILES_FILES="/data/profiles.json"
ENV STATIC_FOLDER="/data/static/"
ENV PORT="40069"

CMD ["npm", "start"]