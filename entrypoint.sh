#!/bin/bash
# Sealos DevBox 发布为正式应用时的启动入口（OCI 镜像入口点）
# 只负责启动，不包含构建（本项目零 npm 依赖，无需 install）
# 仓库内文件，DevBox git clone 后即可用
node --experimental-sqlite backend/server.js
