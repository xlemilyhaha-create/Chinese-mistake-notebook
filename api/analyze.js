import { getAIClient, callAIModel, getDefaultModel, AI_PROVIDERS } from '../services/aiProvider.js';

// 从环境变量获取配置
const getApiKey = (provider) => {
  const providerUpper = provider.toUpperCase();
  return process.env[`${providerUpper}_API_KEY`];
};

// --- SCHEMAS ---
const itemSchemaProperties = {
  word: { type: 'string' },
  pinyin: { type: 'string' },
  hasDefinitionQuestion: { type: 'boolean' },
  targetChar: { type: 'string', nullable: true },
  options: { type: 'array', items: { type: 'string' }, nullable: true },
  correctIndex: { type: 'integer', nullable: true },
  hasMatchQuestion: { type: 'boolean' },
  matchOptions: { type: 'array', items: { type: 'string' }, nullable: true },
  matchCorrectIndex: { type: 'integer', nullable: true }
};

const singleAnalysisSchema = {
  type: 'object',
  properties: itemSchemaProperties,
  required: ["pinyin", "word"],
};

const poemSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    dynasty: { type: 'string' },
    author: { type: 'string' },
    content: { type: 'string' },
    lines: { type: 'array', items: { type: 'string' } },
    fillQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lineIndex: { type: 'integer' },
          pre: { type: 'string' },
          answer: { type: 'string' },
          post: { type: 'string' },
        }
      }
    },
    definitionQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          lineIndex: { type: 'integer' },
          targetChar: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctIndex: { type: 'integer' },
        }
      }
    }
  },
  required: ["title", "author", "lines"]
};

const ocrSchema = {
  type: 'object',
  properties: {
    words: { type: 'array', items: { type: 'string' } }
  }
};

// Helper to clean JSON
const cleanJson = (text) => {
  if (!text) return '{}';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
};

export default async function handler(req, res) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 支持从请求中指定 provider，或使用环境变量
  const defaultProvider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
  const requestProvider = (req.body.provider || defaultProvider).toLowerCase();
  
  // 验证 provider 是否支持
  if (!['gemini', 'deepseek', 'qwen'].includes(requestProvider)) {
    return res.status(400).json({ error: `Unsupported AI provider: ${requestProvider}. Supported: gemini, deepseek, qwen` });
  }
  const requestApiKey = req.body.apiKey || getApiKey(requestProvider);

  if (!requestApiKey) {
    console.error("CRITICAL: API Key is missing.");
    return res.status(500).json({ error: `API Key missing. Please configure ${requestProvider.toUpperCase()}_API_KEY in environment variables.` });
  }

  try {
    const client = getAIClient(requestProvider, requestApiKey);
    const { type, text, image } = req.body;

    const model = req.body.model || getDefaultModel(requestProvider);
    let prompt = '';
    let schema = null;

    switch (type) {
      case 'word':
        prompt = `请分析词语"${text}"，返回JSON格式：拼音、释义题目、字义辨析题目。`;
        schema = singleAnalysisSchema;
        break;

      case 'poem':
        prompt = `请分析古诗"${text}"，返回JSON格式：标题、作者、朝代、完整内容、默写题目、释义题目。`;
        schema = poemSchema;
        break;

      case 'ocr':
        prompt = "请识别图片中的中文词语或成语，返回词语列表。";
        schema = ocrSchema;
        break;

      default:
        return res.status(400).json({ error: "Invalid request type" });
    }

    const responseText = await callAIModel(
      requestProvider,
      client,
      model,
      prompt,
      schema,
      image
    );

    const cleanText = cleanJson(responseText);
    const jsonResponse = JSON.parse(cleanText);
    
    return res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Backend API Error:", error);
    
    // Extract error details for better frontend handling
    let errorMessage = error.message || "Internal Server Error";
    let statusCode = 500;
    
    // Handle API errors
    if (error.message && (error.message.includes('503') || error.status === 503)) {
      statusCode = 503;
      errorMessage = "AI 服务暂时过载，请稍后重试";
    } else if (error.message && (error.message.includes('429') || error.status === 429)) {
      statusCode = 429;
      errorMessage = "请求过于频繁，请稍后重试";
    } else if (error.message && (error.message.includes('API Key') || error.message.includes('401') || error.status === 401)) {
      statusCode = 500;
      errorMessage = "API 密钥配置错误，请检查配置";
    } else if (error.message && error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = "请求超时，请稍后重试";
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
    });
  }
}
