
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
  // Remove markdown code blocks if present
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

    // Use gemini-3-flash-preview for better reasoning and JSON adherence
    let model = 'gemini-3-flash-preview';
    let parts = [];
    let schema = null;

    if (type === 'batch-words') {
      parts = [{ text: `你是一个资深的语文教育专家。请分析以下词语：${words.join(', ')}。
      要求：
      1. 为每个词提供精准的拼音。
      2. 提取词中一个重点单字，生成一道释义题（4个选项）。
      3. 生成一道字义辨析题（在不同语境下该单字意思是否相同）。
      输出必须是纯净的 JSON 格式。` }];
      schema = batchAnalysisSchema;
    } else if (type === 'poem') {
      parts = [{ text: `分析古诗 "${text}"。输出 JSON 包含标题、作者、全文、填空题和释义题。` }];
      schema = poemSchema;
    } else if (type === 'ocr') {
      parts = [
        { inlineData: { mimeType: 'image/jpeg', data: image } },
        { text: "提取图中的所有中文生词、成语。排除单个无意义字符。" }
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

    if (!response.text) {
      throw new Error("AI returned empty response");
    }

    const cleanText = cleanJson(response.text);
    const jsonResponse = JSON.parse(cleanText);
    
    return res.status(200).json(jsonResponse);

  } catch (error) {
    console.error("Backend API Error:", error);
    // Return specific status codes if possible
    const statusCode = error.message?.includes('429') ? 429 : 500;
    return res.status(statusCode).json({ error: error.message || "Internal Server Error" });
  }
}
