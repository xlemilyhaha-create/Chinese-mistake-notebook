# 1GB 服务器内存分配方案

本文档提供针对 1GB 内存服务器的详细内存分配方案。

## 内存分配总览

### 推荐分配方案

| 组件 | 分配内存 | 占比 | 说明 |
|------|---------|------|------|
| **系统保留** | ~200M | 20% | 操作系统、Docker 守护进程等 |
| **MySQL 容器** | ~384M | 38% | Buffer pool 96M + 连接 + 临时表等 |
| **应用容器** | ~384M | 38% | Node.js 应用运行内存 |
| **缓冲** | ~32M | 3% | 防止 OOM 的缓冲空间 |
| **总计** | ~1000M | 100% | |

## MySQL 内存配置详解

### 1. InnoDB Buffer Pool (96M)

**配置项**: `MYSQL_BUFFER_POOL_SIZE=96M`

**作用**: MySQL 最重要的内存参数，用于缓存：
- 表数据
- 索引数据
- 数据字典
- 自适应哈希索引

**为什么是 96M**:
- 1GB 服务器可用内存约 800M（扣除系统占用）
- Buffer pool 建议为 MySQL 容器内存的 25-30%
- 384M × 25% = 96M（保守配置，确保稳定）

**性能影响**:
- ✅ 96M 可以缓存约 10,000-20,000 条记录（取决于记录大小）
- ⚠️ 如果数据量大，可能需要频繁从磁盘读取
- 💡 对于错题本应用，96M 通常足够

### 2. MySQL 容器总内存 (384M)

**配置项**: `MYSQL_MEMORY_LIMIT=384M`

**包含内容**:
- InnoDB Buffer Pool: 96M
- 连接内存: 每个连接约 1-2M（50 个连接约 50-100M）
- 临时表: 32M
- 键缓冲区: 16M
- 排序缓冲区: 2M
- 其他开销: ~100M

**计算公式**:
```
总内存 = Buffer Pool + (连接数 × 2M) + 临时表 + 其他
384M ≈ 96M + (50 × 2M) + 32M + 100M
```

### 3. MySQL 保证内存 (256M)

**配置项**: `MYSQL_MEMORY_RESERVATION=256M`

**作用**: 系统保证 MySQL 至少有 256M 可用内存，防止被 OOM 杀死。

## 应用容器内存配置

### 1. 应用容器总内存 (384M)

**配置项**: `APP_MEMORY_LIMIT=384M`

**包含内容**:
- Node.js 运行时: ~100M
- React 应用: ~50M
- 依赖库: ~50M
- 运行时数据: ~100M
- 缓冲: ~84M

### 2. 应用保证内存 (256M)

**配置项**: `APP_MEMORY_RESERVATION=256M`

## 配置文件示例

### env.prod

```bash
# MySQL 内存配置
MYSQL_BUFFER_POOL_SIZE=96M
MYSQL_MEMORY_LIMIT=384M
MYSQL_MEMORY_RESERVATION=256M

# 应用内存配置
APP_MEMORY_LIMIT=384M
APP_MEMORY_RESERVATION=256M
```

### docker-compose.prod.yml

MySQL 命令参数已优化为：

```yaml
command: 
  - --max_connections=50          # 限制连接数，减少内存占用
  - --innodb_buffer_pool_size=96M  # 从环境变量读取
  - --tmp_table_size=32M          # 临时表大小
  - --max_heap_table_size=32M     # 内存表大小
  - --key_buffer_size=16M         # MyISAM 键缓冲区
  - --sort_buffer_size=2M         # 排序缓冲区
```

## 性能优化建议

### 1. 监控内存使用

```bash
# 实时查看容器内存使用
docker stats --no-stream

# 查看 MySQL 实际内存配置
docker exec yuwen-mysql mysql -u root -p -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"
```

### 2. 如果内存仍然不足

**方案 A: 进一步降低配置**

```bash
# 在 env.prod 中
MYSQL_BUFFER_POOL_SIZE=64M
MYSQL_MEMORY_LIMIT=320M
MYSQL_MEMORY_RESERVATION=192M

APP_MEMORY_LIMIT=320M
APP_MEMORY_RESERVATION=192M
```

**方案 B: 减少 MySQL 连接数**

```yaml
# 在 docker-compose.prod.yml 中
command:
  - --max_connections=30  # 从 50 降到 30
```

### 3. 如果内存充足（升级后）

如果将来升级到 2GB 内存：

```bash
# 可以增加配置
MYSQL_BUFFER_POOL_SIZE=256M
MYSQL_MEMORY_LIMIT=768M
MYSQL_MEMORY_RESERVATION=512M

APP_MEMORY_LIMIT=768M
APP_MEMORY_RESERVATION=512M
```

## 内存使用监控

### 查看当前内存使用

```bash
# 查看系统总内存
free -h

# 查看 Docker 容器内存使用
docker stats

# 查看 MySQL 内存使用详情
docker exec yuwen-mysql mysql -u root -p -e "
  SELECT 
    VARIABLE_NAME,
    VARIABLE_VALUE/1024/1024 AS 'Size (MB)'
  FROM performance_schema.global_variables
  WHERE VARIABLE_NAME IN (
    'innodb_buffer_pool_size',
    'key_buffer_size',
    'tmp_table_size',
    'max_heap_table_size'
  );
"
```

### 检查是否有内存泄漏

```bash
# 持续监控内存使用
watch -n 5 'docker stats --no-stream'

# 如果内存持续增长，可能存在内存泄漏
```

## 故障排查

### 如果 MySQL 仍然无法启动

1. **检查实际可用内存**:
   ```bash
   free -h
   # 确保可用内存 > 400M
   ```

2. **检查是否有其他进程占用内存**:
   ```bash
   ps aux --sort=-%mem | head -10
   ```

3. **临时关闭其他服务**:
   ```bash
   # 如果有其他 Docker 容器，临时停止
   docker ps
   docker stop <其他容器>
   ```

### 如果应用内存不足

1. **检查应用日志**:
   ```bash
   docker logs yuwen-app | grep -i "memory\|oom"
   ```

2. **减少应用并发**:
   - 限制 AI 分析的并发数
   - 减少同时处理的词条数量

## 最佳实践

1. ✅ **定期监控内存使用**
2. ✅ **设置合理的连接数限制**
3. ✅ **定期清理不必要的数据**
4. ✅ **使用 swap 作为最后防线**（如果可能）
5. ⚠️ **避免在高峰期进行大量操作**

## 相关文档

- [小内存服务器优化](./小内存服务器优化.md)
- [故障排查指南](./故障排查.md)
- [Docker 部署指南](./DOCKER.md)

