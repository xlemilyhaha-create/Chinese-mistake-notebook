// AI 模型提供者抽象层
// 支持 Gemini、DeepSeek、Qwen（统一使用简单方式，无需特殊兼容）

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const AI_PROVIDERS = {
  GEMINI: 'gemini',
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen'
};

// 获取 AI 客户端
export function getAIClient(provider, apiKey) {
  switch (provider) {
    case AI_PROVIDERS.GEMINI:
      return new GoogleGenerativeAI(apiKey);
    
    case AI_PROVIDERS.DEEPSEEK:
      return new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.deepseek.com/v1'
      });
    
    case AI_PROVIDERS.QWEN:
      return new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      });
    
    default:
      throw new Error(`Unsupported AI provider: ${provider}. Supported: gemini, deepseek, qwen`);
  }
}

// 转换 JSON Schema 到 Gemini 格式（简单转换，不使用 Type 枚举）
function convertSchemaToGemini(schema) {
  if (!schema || schema.type !== 'object') {
    return { type: 'object', properties: {} };
  }

  const properties = {};
  for (const [key, value] of Object.entries(schema.properties || {})) {
    if (value.type === 'string') {
      properties[key] = { type: 'string' };
    } else if (value.type === 'integer') {
      properties[key] = { type: 'integer' };
    } else if (value.type === 'boolean') {
      properties[key] = { type: 'boolean' };
    } else if (value.type === 'array') {
      const items = value.items || {};
      if (items.type === 'string') {
        properties[key] = { type: 'array', items: { type: 'string' } };
      } else if (items.type === 'object') {
        properties[key] = { type: 'array', items: convertSchemaToGemini(items) };
      }
    } else if (value.type === 'object') {
      properties[key] = convertSchemaToGemini(value);
    }
  }

  return {
    type: 'object',
    properties,
    required: schema.required || []
  };
}

// 调用 AI 模型
export async function callAIModel(provider, client, model, prompt, schema, imageData = null) {
  if (provider === AI_PROVIDERS.GEMINI) {
    return await callGemini(client, model, prompt, schema, imageData);
  } else {
    return await callOpenAICompatible(client, model, prompt, schema, imageData);
  }
}

// Gemini 调用（简单方式）
async function callGemini(client, model, prompt, schema, imageData) {
  const genModel = client.getGenerativeModel({ 
    model: model || 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: convertSchemaToGemini(schema)
    }
  });

  let parts = [];
  
  if (imageData) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageData
      }
    });
  }
  parts.push({ text: prompt });

  const result = await genModel.generateContent(parts);
  return result.response.text();
}

// OpenAI 兼容 API 调用（DeepSeek、Qwen）
async function callOpenAICompatible(client, model, prompt, schema, imageData) {
  const messages = [];
  
  if (imageData) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageData}` } },
        { type: 'text', text: prompt }
      ]
    });
  } else {
    messages.push({
      role: 'user',
      content: prompt
    });
  }

  try {
    // 尝试使用 JSON Schema 模式（如果支持）
    const response = await client.chat.completions.create({
      model: model,
      messages: messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: schema,
          strict: true
        }
      },
      temperature: 0.1
    });

    return response.choices[0].message.content;
  } catch (error) {
    // 如果不支持 JSON Schema，回退到 JSON 模式
    if (error.message && (error.message.includes('json_schema') || error.message.includes('response_format') || error.message.includes('unavailable'))) {
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          ...messages,
          {
            role: 'system',
            content: `请严格按照以下 JSON Schema 格式返回结果：${JSON.stringify(schema, null, 2)}`
          }
        ],
        response_format: {
          type: 'json_object'
        },
        temperature: 0.1
      });

      return response.choices[0].message.content;
    }
    throw error;
  }
}

// 获取默认模型名称
export function getDefaultModel(provider) {
  switch (provider) {
    case AI_PROVIDERS.GEMINI:
      return 'gemini-2.0-flash-exp';
    case AI_PROVIDERS.DEEPSEEK:
      return 'deepseek-chat';
    case AI_PROVIDERS.QWEN:
      return 'qwen-plus';
    default:
      return 'deepseek-chat';
  }
}
