
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, EntryType, AIProvider, AISettings } from "../types";

// --- CLIENT-SIDE SCHEMAS ---
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

const singleAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: itemSchemaProperties,
  required: ["pinyin", "word"],
};

const poemSchema: Schema = {
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

// --- HELPERS ---

const cleanJson = (text: string | undefined): string => {
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

const getSettings = (): AISettings => {
  const saved = localStorage.getItem('yuwen_ai_settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {}
  }
  return { provider: AIProvider.GEMINI }; // Default
};

// --- DEEPSEEK ANALYZER ---

const analyzeWithDeepSeek = async (payload: { type: string, text: string }) => {
  const settings = getSettings();
  if (!settings.deepseekKey) {
    throw new Error("请在设置中配置 DeepSeek API Key");
  }

  let prompt = '';
  if (payload.type === 'word') {
    prompt = `
      Analyze the Chinese word: "${payload.text}".
      Return a valid JSON object ONLY, with no markdown code blocks.
      Structure:
      {
        "word": "${payload.text}",
        "pinyin": "string (space separated tones)",
        "hasDefinitionQuestion": boolean,
        "targetChar": "string (char to test)",
        "options": ["string", "string", "string", "string"],
        "correctIndex": number (0-3),
        "hasMatchQuestion": boolean,
        "matchOptions": ["string", "string", "string", "string"] (4 words containing targetChar),
        "matchCorrectIndex": number (0-3)
      }
      If unable to generate questions, set boolean flags to false.
      Options must be in Simplified Chinese.
    `;
  } else if (payload.type === 'poem') {
    prompt = `
      Analyze this Chinese poem: "${payload.text}".
      Return a valid JSON object ONLY.
      Structure:
      {
        "title": "string",
        "dynasty": "string",
        "author": "string",
        "content": "string",
        "lines": ["string", "string"...],
        "fillQuestions": [
          {"lineIndex": number, "pre": "string", "answer": "string", "post": "string"}
        ],
        "definitionQuestions": [
          {"lineIndex": number, "targetChar": "string", "options": ["string"...], "correctIndex": number}
        ]
      }
    `;
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.deepseekKey}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a helpful Chinese language tutor. output JSON only." },
        { role: "user", content: prompt }
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API Error: ${err}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  return JSON.parse(cleanJson(content));
};

// --- GEMINI ANALYZER (Backend Proxy) ---

const analyzeWithGeminiBackend = async (payload: any) => {
  // Use Backend Proxy for Gemini to bypass GFW (production) or fallback logic
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // Check for HTML response (Preview environment 404 fallback)
  const contentType = response.headers.get("content-type");
  if (response.ok && contentType && contentType.includes("application/json")) {
    return await response.json();
  }

  // Fallback to Client Key if backend fails (Preview Mode)
  const clientApiKey = process.env.API_KEY;
  if (!clientApiKey) {
    throw new Error("后端服务不可用，且未配置前端 API Key");
  }

  console.warn("Backend unavailable, switching to Client-Side Gemini SDK...");
  const ai = new GoogleGenAI({ apiKey: clientApiKey });
  const model = 'gemini-2.5-flash';
  
  let schema: Schema | undefined;
  let prompt = '';
  let parts: any[] = [];
  
  if (payload.type === 'word') {
     schema = singleAnalysisSchema;
     prompt = `Analyze word "${payload.text}". Pinyin, Definition, Match questions. JSON.`;
     parts = [{ text: prompt }];
  } else if (payload.type === 'poem') {
     schema = poemSchema;
     prompt = `Analyze poem "${payload.text}". Title, Author, Fill/Def questions. JSON.`;
     parts = [{ text: prompt }];
  } else if (payload.type === 'ocr') {
     schema = { type: Type.OBJECT, properties: { words: { type: Type.ARRAY, items: { type: Type.STRING } } } };
     prompt = "List all chinese words.";
     parts = [{ inlineData: { mimeType: 'image/jpeg', data: payload.image } }, { text: prompt }];
  }

  const genRes = await ai.models.generateContent({
    model,
    contents: { parts },
    config: { responseMimeType: 'application/json', responseSchema: schema }
  });
  
  return JSON.parse(cleanJson(genRes.text));
};


// --- EXPORTED FUNCTIONS ---

export const analyzeWord = async (word: string): Promise<AnalysisResult> => {
  try {
    const settings = getSettings();
    let data;

    if (settings.provider === AIProvider.DEEPSEEK) {
      data = await analyzeWithDeepSeek({ type: 'word', text: word });
    } else {
      data = await analyzeWithGeminiBackend({ type: 'word', text: word });
    }

    return mapDataToResult(data);
  } catch (error) {
    console.error(`Failed to analyze word: ${word}`, error);
    return { type: EntryType.WORD, word, pinyin: "Error", definitionData: null, definitionMatchData: null };
  }
};

export const analyzeWordsBatch = async (words: string[]): Promise<Record<string, AnalysisResult>> => {
  const results: Record<string, AnalysisResult> = {};
  for (const word of words) {
    results[word] = await analyzeWord(word);
  }
  return results;
};

export const analyzePoem = async (input: string): Promise<AnalysisResult | null> => {
  try {
    const settings = getSettings();
    let data;

    if (settings.provider === AIProvider.DEEPSEEK) {
      data = await analyzeWithDeepSeek({ type: 'poem', text: input });
    } else {
      data = await analyzeWithGeminiBackend({ type: 'poem', text: input });
    }

    return {
      type: EntryType.POEM,
      word: data.title,
      pinyin: data.author,
      definitionData: null,
      definitionMatchData: null,
      poemData: {
        title: data.title,
        dynasty: data.dynasty,
        author: data.author,
        content: data.content,
        lines: data.lines || [],
        fillAnswers: data.fillQuestions || [],
        definitionQuestions: data.definitionQuestions || []
      }
    };
  } catch (error) {
    console.error("Poem Analysis Error:", error);
    return null;
  }
};

export const extractWordsFromImage = async (base64Data: string, mimeType: string): Promise<string[]> => {
  try {
    const settings = getSettings();
    // DeepSeek V3 (Chat) usually doesn't support Image input. Fallback to Gemini or error.
    if (settings.provider === AIProvider.DEEPSEEK) {
      // NOTE: If user forces DeepSeek, we can either throw error or fallback.
      // For now, let's try to fallback to Gemini Backend invisibly for OCR only
      // OR alert user.
      console.warn("DeepSeek does not support OCR yet, attempting Gemini fallback...");
      const data = await analyzeWithGeminiBackend({ type: 'ocr', image: base64Data });
      return data.words || [];
    }

    const data = await analyzeWithGeminiBackend({ type: 'ocr', image: base64Data });
    return data.words || [];
  } catch (error) {
    console.error("OCR Error:", error);
    return [];
  }
};

function mapDataToResult(data: any): AnalysisResult {
  return {
    type: EntryType.WORD,
    word: data.word,
    pinyin: data.pinyin,
    definitionData: data.hasDefinitionQuestion && data.options && data.options.length === 4 ? {
      targetChar: data.targetChar || data.word?.[0] || '?',
      options: data.options,
      correctIndex: typeof data.correctIndex === 'number' ? data.correctIndex : 0,
    } : null,
    definitionMatchData: data.hasMatchQuestion && data.matchOptions && data.matchOptions.length === 4 ? {
      targetChar: data.targetChar || data.word?.[0] || '?',
      options: data.matchOptions,
      correctIndex: typeof data.matchCorrectIndex === 'number' ? data.matchCorrectIndex : 0,
    } : null
  };
}
