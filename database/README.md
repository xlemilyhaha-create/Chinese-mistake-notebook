# 数据库配置说明

## 数据库初始化

1. 确保已安装 MySQL 数据库（推荐版本 5.7+ 或 8.0+）

2. 创建数据库和表结构：
   ```bash
   mysql -u root -p < database/schema.sql
   ```

   或者手动执行：
   ```sql
   mysql -u root -p
   source database/schema.sql
   ```

## 环境变量配置

在 Vercel 项目设置中配置以下环境变量：

- `DB_HOST`: MySQL 数据库主机地址（例如：localhost 或 your-db-host.com）
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称（默认：yuwen_cuoti）

### 本地开发环境

创建 `.env.local` 文件（已在 .gitignore 中）：

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=yuwen_cuoti
```

## 数据库表结构

### word_entries 表

存储所有词条和古诗词数据，包含以下字段：

- `id`: VARCHAR(36) - 主键，UUID
- `type`: ENUM('WORD', 'POEM') - 类型：生字词或古诗词
- `word`: VARCHAR(255) - 字词或诗名
- `pinyin`: VARCHAR(500) - 拼音或作者信息
- `created_at`: BIGINT - 创建时间戳
- `definition_data`: JSON - 释义题目数据
- `definition_match_data`: JSON - 字义辨析题目数据
- `poem_data`: JSON - 古诗词完整数据
- `enabled_types`: JSON - 启用的考点类型数组
- `test_status`: ENUM('NOT_TESTED', 'FAILED', 'PASSED') - 测试通过状态
- `is_multiple_attempts`: BOOLEAN - 是否多次测试才通过
- `previous_test_status`: ENUM('NOT_TESTED', 'FAILED', 'PASSED') - 上一次测试状态

## 数据迁移

如果之前使用 localStorage，可以通过以下方式迁移：

1. 导出 localStorage 数据（使用应用的"备份数据"功能）
2. 使用"导入/恢复"功能导入到新系统

或者直接通过 API 批量导入。

## 注意事项

1. 确保数据库支持 UTF8MB4 字符集，以正确存储中文
2. 建议定期备份数据库
3. 生产环境请使用强密码和安全的数据库连接

