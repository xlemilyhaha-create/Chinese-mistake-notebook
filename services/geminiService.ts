
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, EntryType } from "../types";

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

// --- GEMINI ANALYZER (Backend Proxy with Client Fallback) ---

const analyzeWithGeminiBackend = async (payload: any) => {
  // Use AbortController to enforce a timeout (e.g., 5 seconds)
  // This ensures the preview environment doesn't hang forever waiting for a non-existent backend
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // Strict check: Preview environment often returns 200 OK with HTML content (index.html) for unknown routes
    // We MUST treat HTML response as a failure of the backend API
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType || !contentType.includes("application/json")) {
      throw new Error("Backend API not found or returned HTML");
    }

    return await response.json();

  } catch (error) {
    console.warn("Backend API unavailable (Preview Mode or Timeout), switching to Client-Side SDK Fallback...", error);
    
    // --- FALLBACK: Client-Side SDK ---
    // This part runs only if backend fails (e.g. in right-side Preview Canvas)
    const clientApiKey = process.env.API_KEY;
    if (!clientApiKey) {
      throw new Error("后端服务连接失败，且未配置前端 API Key (process.env.API_KEY is missing)");
    }

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
  }
};


// --- EXPORTED FUNCTIONS ---

export const analyzeWord = async (word: string): Promise<AnalysisResult> => {
  try {
    const data = await analyzeWithGeminiBackend({ type: 'word', text: word });
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
    const data = await analyzeWithGeminiBackend({ type: 'poem', text: input });
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
