# 256M 内存 MySQL 配置方案

本文档提供针对只有 256M 内存可分配给 MySQL 的极端优化配置。

## ⚠️ 重要提示

**256M 是 MySQL 运行的最低配置之一**，会有以下限制：

- ✅ **可以运行**：MySQL 可以在 256M 内存下运行
- ⚠️ **性能受限**：查询速度会较慢，特别是数据量大时
- ⚠️ **连接数受限**：最多支持 30 个并发连接
- ⚠️ **缓存有限**：只能缓存少量数据，频繁从磁盘读取

**建议**：如果可能，至少升级到 512M 内存。

## 内存分配明细

### 256M 内存详细分配

| 组件 | 分配内存 | 说明 |
|------|---------|------|
| **InnoDB Buffer Pool** | 48M | 数据缓存（最重要的参数） |
| **连接内存** | 45M | 30 个连接 × 1.5M |
| **临时表** | 16M | 临时表操作 |
| **键缓冲区** | 8M | MyISAM 索引缓存 |
| **排序缓冲区** | 1M | 排序操作 |
| **读取缓冲区** | 1M | 读取操作 |
| **其他开销** | ~137M | 系统开销、日志等 |
| **总计** | **256M** | |

## 配置文件

### env.prod

```bash
# MySQL 内存配置（256M 限制）
MYSQL_BUFFER_POOL_SIZE=48M
MYSQL_MEMORY_LIMIT=256M
MYSQL_MEMORY_RESERVATION=192M
```

### docker-compose.prod.yml

MySQL 命令参数已优化为：

```yaml
command: 
  - --max_connections=30          # 限制连接数（从 50 降到 30）
  - --innodb_buffer_pool_size=48M  # 缓冲池（从 96M 降到 48M）
  - --key_buffer_size=8M          # 键缓冲区（从 16M 降到 8M）
  - --tmp_table_size=16M          # 临时表（从 32M 降到 16M）
  - --max_heap_table_size=16M    # 内存表（从 32M 降到 16M）
  - --sort_buffer_size=1M        # 排序缓冲区（从 2M 降到 1M）
  - --read_buffer_size=512K      # 读取缓冲区（从 1M 降到 512K）
  - --read_rnd_buffer_size=512K  # 随机读取缓冲区（从 1M 降到 512K）
  - --join_buffer_size=512K      # 连接缓冲区（新增，限制连接内存）
  - --thread_stack=256K          # 线程栈（降低线程内存）
  - --binlog_cache_size=1M       # Binlog 缓存（限制日志内存）
```

## 性能影响

### 查询性能

- **简单查询**：影响较小（< 100ms）
- **复杂查询**：可能较慢（500ms - 2s）
- **大数据量查询**：会很慢（> 5s），因为缓存不足

### 并发能力

- **最大连接数**：30 个
- **推荐并发**：10-15 个
- **高峰期**：可能需要排队

### 缓存能力

- **可缓存记录数**：约 5,000-10,000 条（取决于记录大小）
- **缓存命中率**：可能只有 60-70%（正常配置可达 90%+）

## 优化建议

### 1. 应用层优化

```javascript
// 限制数据库连接池大小
const pool = mysql.createPool({
  connectionLimit: 10,  // 不要超过 MySQL 的 max_connections
  // ...
});

// 使用连接池复用连接
// 避免频繁创建/关闭连接
```

### 2. 查询优化

- ✅ 使用索引（非常重要）
- ✅ 限制查询结果数量（LIMIT）
- ✅ 避免 SELECT *
- ✅ 使用分页查询
- ⚠️ 避免复杂 JOIN
- ⚠️ 避免全表扫描

### 3. 数据管理

- 定期清理不必要的数据
- 归档历史数据
- 压缩大文本字段

## 监控和调优

### 检查内存使用

```bash
# 查看容器实际内存使用
docker stats yuwen-mysql

# 查看 MySQL 内存配置
docker exec yuwen-mysql mysql -u root -p -e "
  SELECT 
    VARIABLE_NAME,
    VARIABLE_VALUE/1024/1024 AS 'Size (MB)'
  FROM performance_schema.global_variables
  WHERE VARIABLE_NAME IN (
    'innodb_buffer_pool_size',
    'key_buffer_size',
    'tmp_table_size',
    'max_heap_table_size',
    'max_connections'
  );
"
```

### 检查缓存命中率

```bash
docker exec yuwen-mysql mysql -u root -p -e "
  SHOW STATUS LIKE 'Innodb_buffer_pool%';
"
```

关注：
- `Innodb_buffer_pool_read_requests`: 缓存读取请求
- `Innodb_buffer_pool_reads`: 磁盘读取次数
- 命中率 = (1 - reads/requests) × 100%

**目标**：命中率 > 80%（256M 配置可能只有 60-70%）

## 故障排查

### 如果 MySQL 仍然无法启动

1. **检查是否有足够内存**：
   ```bash
   free -h
   # 确保可用内存 > 300M（256M + 系统开销）
   ```

2. **进一步降低配置**（最后手段）：
   ```bash
   # 在 env.prod 中
   MYSQL_BUFFER_POOL_SIZE=32M
   MYSQL_MEMORY_LIMIT=256M
   MYSQL_MEMORY_RESERVATION=160M
   ```

3. **减少连接数**：
   ```yaml
   # 在 docker-compose.prod.yml 中
   command:
     - --max_connections=20  # 从 30 降到 20
   ```

### 如果查询很慢

1. **检查是否有索引**：
   ```sql
   SHOW INDEX FROM word_entries;
   ```

2. **分析慢查询**：
   ```sql
   SET GLOBAL slow_query_log = 'ON';
   SET GLOBAL long_query_time = 1;
   ```

3. **优化查询**：
   - 添加缺失的索引
   - 重写复杂查询
   - 使用 EXPLAIN 分析查询计划

## 升级建议

如果性能无法满足需求，建议：

1. **短期方案**：
   - 优化应用代码
   - 添加更多索引
   - 使用查询缓存

2. **中期方案**：
   - 升级到 512M 内存
   - 使用 SSD 存储（提高磁盘 I/O）

3. **长期方案**：
   - 升级到 1GB+ 内存
   - 考虑读写分离
   - 使用 Redis 缓存热点数据

## 配置对比

| 配置项 | 256M 配置 | 512M 配置 | 1GB 配置 |
|--------|----------|----------|----------|
| Buffer Pool | 48M | 96M | 192M |
| 最大连接数 | 30 | 50 | 100 |
| 临时表 | 16M | 32M | 64M |
| 键缓冲区 | 8M | 16M | 32M |
| 查询性能 | 较慢 | 中等 | 快 |
| 并发能力 | 低 | 中 | 高 |

## 相关文档

- [1GB 服务器内存分配方案](./1GB服务器内存分配方案.md)
- [小内存服务器优化](./小内存服务器优化.md)
- [故障排查指南](./故障排查.md)

