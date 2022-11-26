FROM node:19

WORKDIR /app

COPY package.json ./
RUN npm install

ENV PROFILES_FILES=""
ENV STATIC_FOLDER=""
ENV PORT="40069"

CMD ["npm", "start"]