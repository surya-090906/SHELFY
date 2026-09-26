FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed-demo.js && node src/server.js"]
