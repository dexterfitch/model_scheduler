# syntax=docker/dockerfile:1
FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["bash", "-lc", "npm run dev -- --host"]
