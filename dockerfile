FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

ENV NODE_ENV=development

COPY ./ ./

RUN npx prisma generate

EXPOSE 8080

CMD [ "npm", "run", "start" ]