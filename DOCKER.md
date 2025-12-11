# Docker 部署指南

本文档说明如何使用 Docker 运行语文错题助手应用。

## 目录结构

```
.
├── Dockerfile                 # 应用镜像构建文件
├── docker-compose.dev.yml     # 开发环境配置
├── docker-compose.prod.yml    # 生产环境配置（阿里云）
├── env.dev.example           # 开发环境变量示例
├── env.prod.example          # 生产环境变量示例
└── scripts/                  # 辅助脚本
    ├── start.sh             # 启动脚本
    └── init-db.sh           # 数据库初始化脚本
```

## 快速开始

### 1. 开发环境

```bash
# 1. 复制环境变量文件
cp env.dev.example .env.dev

# 2. 编辑 .env.dev，配置数据库密码和 API Key
# 3. 启动服务
docker-compose -f docker-compose.dev.yml --env-file .env.dev up -d

# 4. 查看日志
docker-compose -f docker-compose.dev.yml logs -f

# 或者使用启动脚本
./scripts/start.sh dev
```

### 2. 生产环境

#### 准备工作

1. **安装 Docker 和 Docker Compose**
   ```bash
   # Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # 安装 Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **配置防火墙**
   ```bash
   # 开放应用端口（默认 3001，可在 .env.prod 中修改）
   sudo ufw allow 3001/tcp
   # MySQL 端口建议不对外开放，只在内部使用
   ```

#### 部署步骤

```bash
# 1. 克隆或上传项目代码到服务器
cd /path/to/Chinese-mistake-notebook

# 2. 复制生产环境配置文件
cp env.prod.example .env.prod

# 3. 编辑 .env.prod，配置以下重要参数：
#    - MYSQL_ROOT_PASSWORD: 设置强密码
#    - MYSQL_PASSWORD: 设置强密码
#    - DEEPSEEK_API_KEY 或 QWEN_API_KEY: 配置 AI 模型 API Key
#    - APP_PORT: 应用端口（默认 3001）

# 4. 构建并启动服务
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 5. 查看服务状态
docker-compose -f docker-compose.prod.yml ps

# 6. 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

#### 使用启动脚本

```bash
# 给脚本执行权限
chmod +x scripts/start.sh

# 启动生产环境
./scripts/start.sh prod
```

## 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | `your_strong_password` |
| `MYSQL_PASSWORD` | MySQL 应用用户密码 | `your_strong_password` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | `your_deepseek_api_key` |
| `QWEN_API_KEY` | Qwen API Key | `your_qwen_api_key` |
| `AI_PROVIDER` | AI 模型提供商 | `deepseek` 或 `qwen` |

### 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `MYSQL_DATABASE` | 数据库名称 | `yuwen_cuoti` |
| `MYSQL_USER` | 数据库用户名 | `yuwen_user` |
| `MYSQL_PORT` | MySQL 端口 | `3307` |
| `APP_PORT` | 应用端口 | `3001` |
| `DB_HOST` | 数据库主机（应用使用） | `mysql` |

## 常用命令

### 查看服务状态
```bash
docker-compose ps
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f app
docker-compose logs -f mysql
```

### 停止服务
```bash
docker-compose down
```

### 停止并删除数据卷（⚠️ 会删除数据库数据）
```bash
docker-compose down -v
```

### 重启服务
```bash
docker-compose restart
```

### 进入容器
```bash
# 进入应用容器
docker exec -it yuwen-app sh

# 进入 MySQL 容器
docker exec -it yuwen-mysql mysql -u root -p
```

### 备份数据库
```bash
# 导出数据库
docker exec yuwen-mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} yuwen_cuoti > backup.sql

# 或者使用 docker-compose
docker-compose exec mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} yuwen_cuoti > backup.sql
```

### 恢复数据库
```bash
# 恢复数据库
docker exec -i yuwen-mysql mysql -u root -p${MYSQL_ROOT_PASSWORD} yuwen_cuoti < backup.sql
```

## 数据持久化

数据库数据存储在 Docker 卷 `mysql_data` 中，即使容器删除，数据也会保留。

查看数据卷：
```bash
docker volume ls
docker volume inspect yuwen-mistake-notebook_mysql_data
```

## 故障排查

### 1. 应用无法连接数据库

检查：
- 数据库服务是否正常启动：`docker-compose ps`
- 环境变量 `DB_HOST` 是否正确（应该是 `mysql`）
- 数据库密码是否正确

### 2. 端口冲突

默认端口已设置为非标准端口（MySQL: 3307, 应用: 3001）以避免冲突。如果这些端口也被占用，可以在 `.env` 文件中修改 `MYSQL_PORT` 和 `APP_PORT` 配置。

### 3. 数据库初始化失败

手动执行初始化：
```bash
docker exec -i yuwen-mysql mysql -u root -p${MYSQL_ROOT_PASSWORD} < database/schema.sql
```

### 4. 查看详细错误日志

```bash
# 查看应用日志
docker-compose logs app

# 查看 MySQL 日志
docker-compose logs mysql
```

## 性能优化建议

### 生产环境

1. **MySQL 配置优化**
   - 在 `docker-compose.prod.yml` 中已包含基本优化
   - 可根据服务器资源调整 `innodb_buffer_pool_size`

2. **应用优化**
   - 使用 Nginx 反向代理（可选）
   - 配置 HTTPS（推荐使用 Let's Encrypt）

3. **监控**
   - 配置日志轮转（已在配置中设置）
   - 使用 Docker 健康检查监控服务状态

## 安全建议

1. **生产环境必须修改默认密码**
2. **MySQL 端口不对外暴露**（已在 `docker-compose.prod.yml` 中配置为 `127.0.0.1:3307`）
3. **使用强密码**（至少 16 位，包含大小写字母、数字、特殊字符）
4. **定期备份数据库**
5. **配置防火墙规则**
6. **使用 HTTPS**（推荐使用 Nginx + Let's Encrypt）

## 更新应用

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建并启动
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 3. 查看更新日志
docker-compose -f docker-compose.prod.yml logs -f app
```

## MySQL 版本说明

本配置使用 MySQL 9.5.0 版本。所有 docker-compose 文件中的 MySQL 镜像版本已设置为 `mysql:9.5.0`。

## 支持

如有问题，请查看：
- 应用日志：`docker-compose logs -f app`
- MySQL 日志：`docker-compose logs -f mysql`
- 项目 README.md
