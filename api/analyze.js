import { GoogleGenAI, Type } from "@google/genai";
import pool from './db';

// --- 风控配置 ---
const RATE_LIMIT_WINDOW = 60 * 1000; // 窗口大小：1分钟 (毫秒)
const MAX_REQUESTS_PER_WINDOW = 15;  // 阈值：每分钟最多 15 次请求

/**
 * 检查并更新 IP 的请求计数
 * @param {string} ip - 客户端 IP
 * @returns {Promise<boolean>} - 如果通过返回 true，被限流返回 false
 */
async function checkRateLimit(ip) {
  try {
    const now = Date.now();
    const connection = await pool.getConnection();

    try {
      // 1. 获取当前 IP 的记录
      const [rows] = await connection.query('SELECT window_start, request_count FROM rate_limits WHERE ip = ?', [ip]);
      
      if (rows.length > 0) {
        const record = rows[0];
        
        // 2. 判断是否在当前窗口内
        if (now - record.window_start < RATE_LIMIT_WINDOW) {
          // 在窗口内，检查计数
          if (record.request_count >= MAX_REQUESTS_PER_WINDOW) {
            return false; // 超过限制
          }
          // 未超限，计数 + 1
          await connection.query('UPDATE rate_limits SET request_count = request_count + 1 WHERE ip = ?', [ip]);
        } else {
          // 窗口已过期，重置窗口和计数
          await connection.query('UPDATE rate_limits SET window_start = ?, request_count = 1 WHERE ip = ?', [now, ip]);
        }
      } else {
        // 3. 新 IP，插入记录
        await connection.query('INSERT INTO rate_limits (ip, window_start, request_count) VALUES (?, ?, 1)', [ip, now]);
      }
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Rate Limit Error:", err);
    // 如果数据库出错（比如表不存在），为了不影响业务，默认放行，但打印错误
    return true; 
  }
}

const itemSchemaProperties = {
  word: { type: Type.STRING, description: "原始词语" },
  pinyin: { type: Type.STRING },
  hasDefinitionQuestion: { type: Type.BOOLEAN, description: "是否生成释义选择题，对于普通词语和成语必须为 true" },
  targetChar: { type: Type.STRING, nullable: true },
  options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true, description: "4个释义选项" },
  correctIndex: { type: Type.INTEGER, nullable: true },
  simpleDefinition: { type: Type.STRING, description: "该词语的简明释义，用于复习卡片" },
  exampleSentence: { type: Type.STRING, description: "一个通俗易懂的例句，帮助记忆该词语的意思和用法" },
  hasMatchQuestion: { type: Type.BOOLEAN },
  matchMode: { type: Type.STRING, description: "SAME_AS_TARGET (找字义相同), SYNONYM_CHOICE (选词填空), or TWO_WAY_COMPARE (二选一判断)" },
  matchContext: { type: Type.STRING, nullable: true },
  matchOptions: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  matchCorrectIndex: { type: Type.INTEGER, nullable: true },
  compareWordA: { type: Type.STRING, nullable: true },
  compareWordB: { type: Type.STRING, nullable: true },
  isSame: { type: Type.BOOLEAN, nullable: true }
};

const batchAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: itemSchemaProperties,
        required: ["word", "pinyin", "hasDefinitionQuestion", "hasMatchQuestion", "simpleDefinition", "exampleSentence"]
      }
    }
  },
  required: ["results"]
};

const explanationSchema = {
  type: Type.OBJECT,
  properties: {
    simpleDefinition: { type: Type.STRING, description: "该词语的简明释义" },
    exampleSentence: { type: Type.STRING, description: "一个通俗易懂的例句" }
  },
  required: ["simpleDefinition", "exampleSentence"]
};

const poemSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    dynasty: { type: Type.STRING },
    author: { type: Type.STRING },
    content: { type: Type.STRING },
    lines: { type: Type.ARRAY, items: { type: Type.STRING } },
    fillQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lineIndex: { type: Type.INTEGER },
          pre: { type: Type.STRING },
          answer: { type: Type.STRING },
          post: { type: Type.STRING },
        }
      }
    },
    definitionQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lineIndex: { type: Type.INTEGER },
          targetChar: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
        }
      }
    }
  },
  required: ["title", "author", "lines", "definitionQuestions", "fillQuestions"]
};

const ocrSchema = {
  type: Type.OBJECT,
  properties: {
    words: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
};

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
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // --- 1. 执行风控检查 ---
  // 获取真实 IP (兼容 Vercel/Proxy 环境)
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  
  // 排除本地开发环境 (localhost)
  if (clientIp !== '::1' && clientIp !== '127.0.0.1' && clientIp !== 'unknown') {
    const isAllowed = await checkRateLimit(clientIp);
    if (!isAllowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({ error: "请求过于频繁，请 1 分钟后再试 (Rate limit exceeded)" });
    }
  }

  const dynamicApiKey = process.env.API_KEY;
  if (!dynamicApiKey) return res.status(500).json({ error: "Server API Key missing." });

  try {
    const ai = new GoogleGenAI({ apiKey: dynamicApiKey });
    const { type, text, words, image } = req.body;

    let model = 'gemini-3-flash-preview';
    let parts = [];
    let schema = null;
    let thinkingBudget = 0;

    if (type === 'batch-words') {
      parts = [{ text: `你是一个资深的语文教育专家。分析：${words.join(', ')}。
      
      【强制要求】：
      1. 每个词语/成语都【必须】生成释义选择题 (hasDefinitionQuestion: true)，给出词语的准确含义及3个干扰项。
      2. 每个词语/成语都【必须】生成简明释义 (simpleDefinition) 和通俗例句 (exampleSentence)，用于制作复习闪卡。
      3. 每个词语/成语都【必须】生成辨析题 (hasMatchQuestion: true)。
      4. 如果是成语（如“低声细语”），重点分析其整体含义。
      5. 如果是对比词（如“改变 vs 改善”），使用 SYNONYM_CHOICE 模式。
      
      请确保 results 数组中每个对象都完整包含 definitionData 和 matchData 相关字段。` }];
      schema = batchAnalysisSchema;
      thinkingBudget = 4000;
    } else if (type === 'poem') {
      parts = [{ text: `你是一个资深的语文教育专家。分析古诗词 "${text}"...` }];
      schema = poemSchema;
      thinkingBudget = 10000;
    } else if (type === 'explain-word') {
      parts = [{ text: `你是一个语文老师。请为小学/初中学生解释生字词 "${text}"。
      要求：
      1. simpleDefinition: 用简洁的语言解释意思（20字以内）。
      2. exampleSentence: 造一个通俗易懂的例句，帮助理解用法。` }];
      schema = explanationSchema;
      thinkingBudget = 0; // 简单任务无需深度思考
    } else if (type === 'ocr') {
      parts = [{ inlineData: { mimeType: 'image/jpeg', data: image } }, { text: "提取图中的所有中文生词、成语。" }];
      schema = ocrSchema;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: { 
        responseMimeType: 'application/json', 
        responseSchema: schema,
        thinkingConfig: { thinkingBudget }
      }
    });

    return res.status(200).json(JSON.parse(cleanJson(response.text)));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}