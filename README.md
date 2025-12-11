# 语文错题助手

一个基于 React + TypeScript + Vite 构建的智能语文学习助手，利用 AI 大模型自动分析生字词和古诗词，生成练习题目和试卷。

## ✨ 核心功能

### 📝 生字词录入
- **多种输入方式**：手动输入、图片识别（OCR）、拍照识别
- **AI 智能分析**：自动生成拼音、释义、辨析等考点
- **批量处理**：支持一次录入多个字词，自动去重
- **考点配置**：灵活配置每个词条的考点类型

### 📚 古诗词录入
- **智能识别**：输入诗名或内容，AI 自动补全完整信息
- **默写题目生成**：自动生成填空和释义题目

### 📊 题库管理
- **测试状态跟踪**：未测试、未通过、已通过
- **多次测试记录**：自动记录是否多次测试才通过
- **筛选功能**：按题型、测试状态、多次测试等条件筛选
- **批量操作**：支持批量更新测试状态

### 📄 智能组卷
- **条件筛选**：根据测试状态和多次测试情况筛选题目
- **日期筛选**：按录入日期筛选词条
- **打印/PDF**：生成可打印的练习试卷

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Vite
- **后端**：Node.js + Express
- **数据库**：MySQL 9.5.0
- **AI 模型**：Gemini、DeepSeek、Qwen
- **部署**：Docker + Docker Compose

## 🚀 快速开始

### 方式一：Docker 部署（推荐）

#### 开发环境

```bash
# 1. 复制环境变量文件
cp env.dev .env.dev

# 2. 编辑 .env.dev，配置数据库密码和 AI API Key
# 3. 启动服务
./scripts/start.sh dev

# 4. 访问应用
# http://localhost:3001
```

#### 生产环境

```bash
# 1. 复制环境变量文件
cp env.prod .env.prod

# 2. 编辑 .env.prod，配置数据库密码和 AI API Key
# 3. 启动服务
./scripts/start.sh prod
```

详细说明请参考 [DOCKER.md](./DOCKER.md)

### 方式二：本地开发

#### 前置要求

- Node.js 20+
- MySQL 9.5.0+

#### 安装步骤

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
# 创建 .env 文件，配置数据库和 AI API Key
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=yuwen_cuoti
DB_PORT=3307

# AI 模型配置（至少配置一个）
AI_PROVIDER=gemini  # 或 deepseek、qwen
GEMINI_API_KEY=your_key
DEEPSEEK_API_KEY=your_key
QWEN_API_KEY=your_key

# 3. 初始化数据库
mysql -u root -p < database/schema.sql

# 4. 启动开发服务器
npm run dev
```

## 📋 环境变量配置

### 数据库配置

```env
DB_HOST=localhost          # 数据库主机
DB_USER=root               # 数据库用户名
DB_PASSWORD=your_password  # 数据库密码
DB_NAME=yuwen_cuoti        # 数据库名称
DB_PORT=3307               # 数据库端口（默认 3307）
```

### AI 模型配置

```env
# 选择默认 AI 模型提供商
AI_PROVIDER=gemini  # 可选：gemini、deepseek、qwen

# API Keys（至少配置一个）
GEMINI_API_KEY=your_gemini_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
QWEN_API_KEY=your_qwen_api_key
```

支持的模型：

| 提供商 | 默认模型 | 获取 API Key |
|--------|---------|------------|
| Gemini | gemini-1.5-flash | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| DeepSeek | deepseek-chat | [DeepSeek Platform](https://platform.deepseek.com/) |
| Qwen | qwen-plus | [阿里云 DashScope](https://dashscope.console.aliyun.com/) |

详细说明请参考 [AI_MODELS.md](./AI_MODELS.md)

## 📖 文档

- [功能描述文档](./功能描述文档.md) - 详细的功能说明
- [更新说明](./更新说明.md) - 版本更新记录
- [Docker 部署指南](./DOCKER.md) - Docker 部署详细说明
- [AI 模型支持说明](./AI_MODELS.md) - AI 模型配置和使用说明
- [阿里云部署安全配置](./阿里云部署安全配置.md) - 阿里云 ECS 安全组配置指南

## 🎯 主要特性

- ✅ **智能分析**：利用 AI 大模型自动生成题目
- ✅ **多模型支持**：支持 Gemini、DeepSeek、Qwen
- ✅ **测试跟踪**：记录学习进度和测试状态
- ✅ **灵活筛选**：多条件组合筛选词条
- ✅ **批量操作**：支持批量更新状态
- ✅ **数据持久化**：MySQL 数据库存储
- ✅ **Docker 支持**：一键部署，开箱即用

## 📝 使用说明

### 添加生字词

1. 在输入框中输入字词（支持空格、逗号、换行分隔）
2. 或点击"拍照识别"使用 OCR 功能
3. 选择默认考点类型
4. 点击"开始分析"，等待 AI 分析完成
5. 预览分析结果，调整考点配置
6. 点击"保存到题库"

### 管理题库

1. 在题库列表页可以：
   - 编辑词条信息
   - 更新测试状态
   - 筛选词条
   - 批量更新状态
   - 删除词条

### 生成试卷

1. 点击"智能组卷"
2. 选择日期和筛选条件
3. 预览试卷内容
4. 点击"打印 / 下载PDF"

## 🔧 开发

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 📄 许可证

本项目为私有项目。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

---

**注意**：使用前请确保已正确配置数据库和 AI API Key。
