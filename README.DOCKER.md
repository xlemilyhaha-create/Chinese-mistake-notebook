# Docker 快速开始

## 开发环境

```bash
# 1. 复制环境变量文件
cp env.dev.example .env.dev

# 2. 编辑 .env.dev，配置 API_KEY 和数据库密码
# 3. 启动服务
docker-compose -f docker-compose.dev.yml --env-file env.dev up -d

# 或者使用启动脚本
./scripts/start.sh dev

# 4. 访问应用
# 浏览器打开 http://localhost:3001
```

## 生产环境

```bash
# 1. 复制生产环境配置
cp env.prod.example env.prod

# 2. 编辑 .env.prod，配置强密码和 API_KEY
# 3. 启动服务
docker-compose -f docker-compose.prod.yml --env-file env.prod up -d --build

# 或者使用启动脚本
./scripts/start.sh prod

# 4. 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

详细文档请查看 [DOCKER.md](./DOCKER.md)

