FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma

RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run prisma:generate && npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
