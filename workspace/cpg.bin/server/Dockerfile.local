FROM node:current-alpine as builder
WORKDIR /app
# RUN apk add --no-cache build-base python3
COPY package*.json ./
RUN npm install
# COPY prisma ./prisma/
COPY . .
RUN npx prisma generate
EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npx prisma db execute --file ./prisma/seed.sql && npm run start:dev"]
