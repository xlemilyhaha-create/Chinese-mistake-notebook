# 512M 内存 MySQL 配置方案

本文档提供针对只有 512M 内存可分配给 MySQL 的优化配置方案。

## 内存分配总览

### 推荐分配方案

| 组件 | 分配内存 | 占比 | 说明 |
|------|---------|------|------|
| **InnoDB Buffer Pool** | 128M | 25% | 数据缓存（最重要的参数） |
| **连接内存** | 100M | 20% | 50 个连接 × 2M |
| **临时表** | 32M | 6% | 临时表操作 |
| **键缓冲区** | 16M | 3% | MyISAM 索引缓存 |
| **排序/读取缓冲区** | 4M | 1% | 查询操作 |
| **其他开销** | ~232M | 45% | 系统开销、日志、线程等 |
| **总计** | **512M** | 100% | |

## 配置文件

### env.prod

```bash
# MySQL 内存配置（512M 限制）
MYSQL_BUFFER_POOL_SIZE=128M
MYSQL_MEMORY_LIMIT=512M
MYSQL_MEMORY_RESERVATION=384M
```

### docker-compose.prod.yml

MySQL 命令参数已优化为：

```yaml
command: 
  - --max_connections=50          # 最大连接数（从 30 提升到 50）
  - --innodb_buffer_pool_size=128M  # 缓冲池（从 48M 提升到 128M）
  - --key_buffer_size=16M         # 键缓冲区（从 8M 提升到 16M）
  - --tmp_table_size=32M          # 临时表（从 16M 提升到 32M）
  - --max_heap_table_size=32M    # 内存表（从 16M 提升到 32M）
  - --sort_buffer_size=2M        # 排序缓冲区（从 1M 提升到 2M）
  - --read_buffer_size=1M        # 读取缓冲区（从 512K 提升到 1M）
  - --read_rnd_buffer_size=1M     # 随机读取缓冲区（从 512K 提升到 1M）
  - --join_buffer_size=1M        # 连接缓冲区（从 512K 提升到 1M）
  - --binlog_cache_size=2M       # Binlog 缓存（从 1M 提升到 2M）
```

## 性能特点

### ✅ 优势

1. **缓存能力提升**：
   - 128M Buffer Pool 可以缓存约 15,000-30,000 条记录
   - 缓存命中率可达 80-90%（相比 256M 配置的 60-70%）

2. **并发能力提升**：
   - 支持 50 个并发连接（相比 256M 配置的 30 个）
   - 推荐并发：20-30 个

3. **查询性能提升**：
   - 简单查询：< 50ms
   - 复杂查询：200ms - 1s（相比 256M 配置的 500ms - 2s）
   - 大数据量查询：2-5s（相比 256M 配置的 > 5s）

4. **稳定性提升**：
   - 有足够的内存缓冲，减少 OOM 风险
   - 可以处理更复杂的查询

### ⚠️ 限制

1. **仍然不适合大数据量**：
   - 如果单表数据超过 100,000 条，性能会下降
   - 复杂 JOIN 查询可能较慢

2. **高峰期可能受限**：
   - 如果同时有大量并发查询，可能需要排队

## 内存分配详解

### 1. InnoDB Buffer Pool (128M)

**为什么是 128M**：
- 512M 总内存的 25%，这是 MySQL 推荐的合理比例
- 128M 可以缓存约 15,000-30,000 条记录（取决于记录大小）
- 对于错题本应用，通常足够缓存常用数据

**性能影响**：
- ✅ 缓存命中率：80-90%
- ✅ 大部分查询可以从内存读取
- ⚠️ 如果数据量很大，仍需要从磁盘读取

### 2. 连接内存 (100M)

**计算**：
- 50 个连接 × 2M = 100M
- 每个连接包括：线程栈、查询缓冲区、临时表等

**优化建议**：
- 使用连接池，复用连接
- 避免创建过多连接
- 及时关闭不使用的连接

### 3. 临时表 (32M)

**用途**：
- 排序操作
- GROUP BY 操作
- 临时结果集

**优化建议**：
- 添加适当的索引，减少临时表使用
- 优化查询，避免大结果集排序

## 性能优化建议

### 1. 应用层优化

```javascript
// 限制数据库连接池大小
const pool = mysql.createPool({
  connectionLimit: 20,  // 不要超过 MySQL 的 max_connections
  // ...
});

// 使用连接池复用连接
// 避免频繁创建/关闭连接
```

### 2. 查询优化

- ✅ **使用索引**（非常重要）
- ✅ **限制查询结果数量**（LIMIT）
- ✅ **避免 SELECT ***
- ✅ **使用分页查询**
- ✅ **优化 JOIN 查询**
- ⚠️ **避免全表扫描**

### 3. 数据管理

- 定期清理不必要的数据
- 归档历史数据
- 压缩大文本字段
- 使用合适的数据类型

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

**目标**：命中率 > 85%

### 检查连接数

```bash
docker exec yuwen-mysql mysql -u root -p -e "
  SHOW STATUS LIKE 'Threads_connected';
  SHOW STATUS LIKE 'Max_used_connections';
"
```

## 配置对比

| 配置项 | 256M 配置 | 512M 配置 | 1GB 配置 |
|--------|----------|----------|----------|
| Buffer Pool | 48M | **128M** | 192M |
| 最大连接数 | 30 | **50** | 100 |
| 临时表 | 16M | **32M** | 64M |
| 键缓冲区 | 8M | **16M** | 32M |
| 查询性能 | 较慢 | **中等** | 快 |
| 并发能力 | 低 | **中** | 高 |
| 缓存命中率 | 60-70% | **80-90%** | 90%+ |

## 故障排查

### 如果内存仍然不足

1. **检查实际可用内存**：
   ```bash
   free -h
   # 确保可用内存 > 600M（512M + 系统开销）
   ```

2. **进一步优化**（如果必须）：
   ```bash
   # 在 env.prod 中
   MYSQL_BUFFER_POOL_SIZE=96M
   MYSQL_MEMORY_LIMIT=512M
   MYSQL_MEMORY_RESERVATION=320M
   ```

3. **减少连接数**：
   ```yaml
   # 在 docker-compose.prod.yml 中
   command:
     - --max_connections=40  # 从 50 降到 40
   ```

### 如果查询很慢

1. **检查索引**：
   ```sql
   SHOW INDEX FROM word_entries;
   EXPLAIN SELECT * FROM word_entries WHERE ...;
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

如果性能仍然无法满足需求：

1. **短期方案**：
   - 优化应用代码
   - 添加更多索引
   - 使用查询缓存

2. **中期方案**：
   - 升级到 1GB 内存
   - 使用 SSD 存储（提高磁盘 I/O）

3. **长期方案**：
   - 升级到 2GB+ 内存
   - 考虑读写分离
   - 使用 Redis 缓存热点数据

## 最佳实践

1. ✅ **定期监控内存使用**
2. ✅ **设置合理的连接数限制**
3. ✅ **定期清理不必要的数据**
4. ✅ **优化查询和索引**
5. ✅ **使用连接池复用连接**
6. ⚠️ **避免在高峰期进行大量操作**

## 相关文档

- [256M 内存 MySQL 配置](./256M内存MySQL配置.md)
- [1GB 服务器内存分配方案](./1GB服务器内存分配方案.md)
- [故障排查指南](./故障排查.md)
- [Docker 部署指南](./DOCKER.md)

