
import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.API_KEY;

const itemSchemaProperties = {
  word: { type: Type.STRING },
  pinyin: { type: Type.STRING },
  hasDefinitionQuestion: { type: Type.BOOLEAN },
  targetChar: { type: Type.STRING, nullable: true },
  options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  correctIndex: { type: Type.INTEGER, nullable: true },
  // 辨析题增强
  hasMatchQuestion: { type: Type.BOOLEAN },
  matchMode: { type: Type.STRING, description: "SAME_AS_TARGET, SYNONYM_CHOICE, or TWO_WAY_COMPARE" },
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
        required: ["word", "pinyin", "hasMatchQuestion"]
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

    let model = 'gemini-3-flash-preview';
    let parts = [];
    let schema = null;

    if (type === 'batch-words') {
      parts = [{ text: `你是一个资深的语文教育专家。请分析以下词语：${words.join(', ')}。
      要求：
      1. 如果输入是类似 "改善 vs 改变" 或 "改善/改变" 这种词组对：
         - 强制生成辨析题模式 B (SYNONYM_CHOICE)。
         - 提供一个选词填空的语境句子。
         - matchOptions 必须包含且仅包含这两个词。
         - pinyin 可以提供两个词的组合，如 "gǎi shàn / gǎi biàn"。
      2. 如果输入是普通单字词：
         - 为每个词提供精准拼音。
         - 提取词中重点单字生成释义选择题。
         - 辨析题从模式A、B、C中选一个最合适的：
           - A(SAME_AS_TARGET)：给出一个语境词让学生从4个词中选同义词。
           - B(SYNONYM_CHOICE)：选词填空。
           - C(TWO_WAY_COMPARE)：对比两个词中同一个字的意思是否相同。
      输出必须严格符合提供的 JSON Schema 格式。` }];
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
    const statusCode = error.message?.includes('429') ? 429 : 500;
    return res.status(statusCode).json({ error: error.message || "Internal Server Error" });
  }
}
