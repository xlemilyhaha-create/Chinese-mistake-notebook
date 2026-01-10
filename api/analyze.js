import { GoogleGenAI, Type } from "@google/genai";

const itemSchemaProperties = {
  word: { type: Type.STRING, description: "原始词语" },
  pinyin: { type: Type.STRING },
  hasDefinitionQuestion: { type: Type.BOOLEAN },
  targetChar: { type: Type.STRING, nullable: true },
  options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  correctIndex: { type: Type.INTEGER, nullable: true },
  hasMatchQuestion: { type: Type.BOOLEAN },
  matchMode: { type: Type.STRING, description: "SAME_AS_TARGET (找字义相同), SYNONYM_CHOICE (选词填空), or TWO_WAY_COMPARE (二选一判断)" },
  matchContext: { type: Type.STRING, nullable: true, description: "题目涉及的句子，如果是选词填空，句子中必须包含 ( ) 符号" },
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
      针对每个词语产出辨析题(matchMode)：
      1. 如果是对比词（如“改变 vs 改善”），必须使用 SYNONYM_CHOICE 模式。
         - matchContext 必须是一个包含 ( ) 的完整句子，如“政府决定 ( ) 环境。”
         - matchOptions 是对比的两个词。
      2. 如果是单个词，使用 SAME_AS_TARGET。
         - 考察该词中某个重点字的含义，matchContext 包含该词，options 给出其他包含该字的词供选择。
      3. 如果指定对比字义，用 TWO_WAY_COMPARE。` }];
      schema = batchAnalysisSchema;
      thinkingBudget = 4000;
    } else if (type === 'poem') {
      parts = [{ text: `你是一个资深的语文教育专家。分析古诗词 "${text}"。
      
      【默写题核心规则 - 严禁重复】：
      - 从全诗中挑选 2-4 行进行默写，每行只能出现一次。
      
      请产出结构化 JSON。` }];
      schema = poemSchema;
      thinkingBudget = 10000;
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