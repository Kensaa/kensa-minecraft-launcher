FROM node:19

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV PROFILES_FILE="/data/profiles.json"
ENV STATIC_FOLDER="/data/static/"
ENV PORT="40069"
ENV ADDRESS=""
ENV CDNS=""

EXPOSE 40069

CMD ["npm", "start"]