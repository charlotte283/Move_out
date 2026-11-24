FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production DATA_DIR=/data
EXPOSE 3000
CMD ["npm", "start"]
