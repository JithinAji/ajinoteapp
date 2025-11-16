FROM node:24-alpine

COPY package.json /app/package.json
COPY src/ /app/

WORKDIR /app

RUN npm install
CMD ["node", "app.js"]