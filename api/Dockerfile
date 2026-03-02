FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY src/ ./src/

EXPOSE 3001
CMD ["node", "src/index.js"]
