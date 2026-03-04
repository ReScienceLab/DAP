FROM node:22-alpine

RUN apk add --no-cache aws-cli

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY server.mjs .

VOLUME ["/data"]
EXPOSE 8099

CMD ["node", "server.mjs"]
