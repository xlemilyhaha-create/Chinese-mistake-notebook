# AI 模型支持说明

系统支持多个 AI 模型提供商：**Gemini**、**DeepSeek** 和 **Qwen**（统一使用简单方式，无需特殊兼容）。

## 配置方式

### 1. 环境变量配置

在 `.env.dev` 或 `.env.prod` 文件中配置：

```bash
# 选择默认使用的 AI 模型提供商
AI_PROVIDER=deepseek  # 可选值: gemini, deepseek, qwen

# Gemini API Key（当使用 Gemini 时）
GEMINI_API_KEY=your_gemini_api_key_here

# DeepSeek API Key（当使用 DeepSeek 时）
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Qwen API Key（当使用 Qwen 时）
QWEN_API_KEY=your_qwen_api_key_here
```

### 2. API 请求中指定模型

在调用 `/api/analyze` 接口时，可以在请求体中指定使用的模型：

```json
{
  "type": "word",
  "text": "测试词语",
  "provider": "deepseek",  // 可选: gemini, deepseek, qwen
  "model": "deepseek-chat",  // 可选，使用默认模型时可省略
  "apiKey": "your_api_key"  // 可选，使用环境变量中的 API Key 时可省略
}
```

## 支持的模型

### Gemini
- **默认模型**: `gemini-2.0-flash-exp`
- **API 端点**: Google Gemini API
- **获取 API Key**: https://makersuite.google.com/app/apikey

### DeepSeek
- **默认模型**: `deepseek-chat`
- **API 端点**: https://api.deepseek.com/v1
- **获取 API Key**: https://platform.deepseek.com/

### Qwen
- **默认模型**: `qwen-plus`（可根据实际可用模型调整）
- **API 端点**: https://dashscope.aliyuncs.com/compatible-mode/v1
- **获取 API Key**: https://dashscope.console.aliyun.com/

## 模型切换

### 方式 1: 修改环境变量（全局切换）

修改 `.env.dev` 或 `.env.prod` 文件中的 `AI_PROVIDER` 值，然后重启应用。

### 方式 2: 在 API 请求中指定（临时切换）

在每次 API 请求的 body 中指定 `provider` 参数。

## 注意事项

1. **API Key 安全**: 请妥善保管 API Key，不要提交到版本控制系统
2. **模型兼容性**: 不同模型对 JSON Schema 的支持可能不同，系统已自动处理兼容性问题
3. **费用**: 不同模型的计费方式可能不同，请参考各提供商的定价信息
4. **响应格式**: 所有模型都返回统一的 JSON 格式，确保前端兼容性

## 故障排查

### 问题: API Key 错误
- 检查环境变量中的 API Key 是否正确配置
- 确认 API Key 是否有效且未过期

### 问题: 模型不支持 JSON Schema
- 系统会自动回退到 JSON 模式
- 如果仍有问题，请检查模型名称是否正确

### 问题: 请求超时
- 检查网络连接
- 确认 API 端点可访问
- 考虑增加超时时间

## 技术实现

系统使用抽象层设计，通过 `services/aiProvider.js` 统一处理不同模型的调用：

- **Gemini**: 使用 `@google/generative-ai` SDK，简单转换 JSON Schema
- **DeepSeek/Qwen**: 统一使用 `openai` SDK（兼容 OpenAI API 格式）

所有模型调用都通过统一的接口 `callAIModel()` 进行，确保代码的可维护性和扩展性。系统采用简单方式实现，无需特殊兼容处理。
