import { GoogleGenAI, Type } from "@google/genai";

const itemSchemaProperties = {
  word: { type: Type.STRING, description: "必须严格等于输入列表中的原始字符串，不得修改空格或符号" },
  pinyin: { type: Type.STRING },
  hasDefinitionQuestion: { type: Type.BOOLEAN },
  targetChar: { type: Type.STRING, nullable: true },
  options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
  correctIndex: { type: Type.INTEGER, nullable: true },
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
  required: ["title", "author", "lines", "definitionQuestions"]
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
  
  const dynamicApiKey = process.env.API_KEY;
  if (!dynamicApiKey) return res.status(500).json({ error: "Server API Key missing." });

  try {
    const ai = new GoogleGenAI({ apiKey: dynamicApiKey });
    const { type, text, words, image } = req.body;

    let model = 'gemini-3-flash-preview';
    let parts = [];
    let schema = null;

    if (type === 'batch-words') {
      parts = [{ text: `你是一个资深的语文教育专家。请分析以下词语：${words.join(', ')}。输出 JSON 结果。` }];
      schema = batchAnalysisSchema;
    } else if (type === 'poem') {
      parts = [{ text: `你是一个资深的语文教育专家。分析古诗词 "${text}"。
      
      【强制任务】：
      1. 提取全文、作者、朝代。
      2. 必须从诗句中挑选 2-4 个【重点字词】（通常是具有特定含义的动词、形容词或名词）生成释义选择题。
      3. 每道释义题必须包含 4 个极具迷惑性的选项，并指定正确答案索引。
      4. 生成 1-2 句诗句填空题。
      
      输出必须严格符合 JSON 结构。` }];
      schema = poemSchema;
    } else if (type === 'ocr') {
      parts = [
        { inlineData: { mimeType: 'image/jpeg', data: image } },
        { text: "提取图中的所有中文生词、成语。" }
      ];
      schema = ocrSchema;
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: { responseMimeType: 'application/json', responseSchema: schema }
    });

    return res.status(200).json(JSON.parse(cleanJson(response.text)));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}