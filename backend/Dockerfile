FROM node:20-alpine

# postgresql-client provides psql, used to execute uploaded SQL dump restores
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3001

CMD ["node", "src/index.js"]
