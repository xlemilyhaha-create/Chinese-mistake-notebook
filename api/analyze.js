
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY;

// 定义单个词语分析的属性
const itemSchemaProperties = {
  word: { type: Type.STRING },
  pinyin: { type: Type.STRING },
  hasDefinitionQuestion: { type: Type.BOOLEAN },
  targetChar: { type: Type.STRING, nullable: true },
  options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  correctIndex: { type: Type.INTEGER, nullable: true },
  hasMatchQuestion: { type: Type.BOOLEAN },
  matchOptions: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  matchCorrectIndex: { type: Type.INTEGER, nullable: true }
};

// 批量分析 Schema (数组)
const batchAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: itemSchemaProperties,
        required: ["word", "pinyin"]
      }
    }
  },
  required: ["results"]
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
  required: ["title", "author", "lines"]
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!apiKey) return res.status(500).json({ error: "Server API Key missing." });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { type, text, words, image } = req.body;

    let model = 'gemini-2.5-flash';
    let parts = [];
    let schema = null;

    if (type === 'batch-words') {
      parts = [{ text: `你是一个专业的语文老师。请逐一分析以下词语或成语：${words.join(', ')}。
      要求：
      1. 为每个词提供准确的拼音。
      2. 生成一道考察词中重点单字含义的选择题（4个选项，指定正确项索引）。
      3. 生成一道“字义辨析题”：给出一个含有相同重点单字的4个不同词语，其中一个词语里该字的含义必须与原词相同。
      4. 请确保输出结果是一个完整的 JSON 数组，包含所有请求的词语，不要截断。` }];
      schema = batchAnalysisSchema;
    } else if (type === 'poem') {
      parts = [{ text: `Analyze poem "${text}". JSON output: title, author, fill questions, definition questions.` }];
      schema = poemSchema;
    } else if (type === 'ocr') {
      parts = [
        { inlineData: { mimeType: 'image/jpeg', data: image } },
        { text: "Extract and list only the Chinese words or idioms from this worksheet. Ignore single non-content characters." }
      ];
      schema = ocrSchema;
    } else {
      return res.status(400).json({ error: "Invalid request type" });
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });

    const cleanText = cleanJson(response.text);
    const jsonResponse = JSON.parse(cleanText);
    
    return res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Backend API Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
