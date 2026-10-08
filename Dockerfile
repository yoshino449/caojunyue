# 教务器材预约 — 容器镜像（Sealos 等容器平台部署用）
# Node 22 内置 node:sqlite，零 npm 依赖，无需 npm install
FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY db/ ./db/
RUN mkdir -p data          # 运行时 SQLite 文件目录，确保可写
ENV PORT=3000
EXPOSE 3000
# --experimental-sqlite 标志必须带（node:sqlite 在 Node 22 为实验特性）
CMD ["node", "--experimental-sqlite", "backend/server.js"]
