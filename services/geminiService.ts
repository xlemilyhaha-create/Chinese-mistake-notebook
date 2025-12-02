import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, EntryType } from "../types";

// --- CLIENT-SIDE SCHEMAS (For Fallback) ---
// Note: These duplicates the logic in api/analyze.js to support the Hybrid Client Fallback
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

const ocrSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    words: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
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

// --- HYBRID EXECUTION ENGINE ---

const performAnalysis = async (payload: any) => {
  // STRATEGY 1: Try Backend API (Best for Production/WeChat/Mobile)
  try {
    // Set a strict timeout (e.g., 15 seconds) to avoid hanging forever
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    // CRITICAL CHECK: In Preview environments (SPA), a missing API route often returns index.html (200 OK).
    // We must check if the content-type is actually JSON.
    const contentType = response.headers.get("content-type");
    if (response.ok && contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    
    // If we get here, it's either not OK (404/500) or it returned HTML (Preview fallback).
    console.warn(`Backend API unusable (Status: ${response.status}, Type: ${contentType}). Switching to Client-Side Fallback.`);
  } catch (error) {
    console.warn("Backend API unreachable or timed out. Switching to Client-Side Fallback.", error);
  }

  // STRATEGY 2: Client-Side Fallback (Best for Preview/Localhost without Serverless)
  const clientApiKey = process.env.API_KEY;
  if (!clientApiKey) {
    // If both fail, throw a clear error
    throw new Error("Analysis failed: Backend unreachable and no Client API Key configured.");
  }

  console.log("Using Client-Side Gemini SDK...");
  const ai = new GoogleGenAI({ apiKey: clientApiKey });
  let model = 'gemini-2.5-flash';
  let prompt = '';
  let schema: Schema | undefined;
  let parts: any[] = [];

  switch (payload.type) {
    case 'word':
      prompt = `
        Analyze the Chinese word: "${payload.text}".
        1. Provide Pinyin with tones (space separated).
        2. Create Definition Test (Meaning).
        3. Create Definition Match Test (Same character meaning).
        Options must be in Simplified Chinese.
      `;
      schema = singleAnalysisSchema;
      parts = [{ text: prompt }];
      break;

    case 'poem':
      prompt = `
        Analyze this Chinese poem text/request: "${payload.text}".
        1. Identify the Title, Author, Dynasty, and content.
        2. Split into lines.
        3. Create 1-2 "Fill in the blank" questions.
        4. Create 1-2 "Definition" questions.
        Options must be in SIMPLIFIED CHINESE.
      `;
      schema = poemSchema;
      parts = [{ text: prompt }];
      break;

    case 'ocr':
      prompt = "Identify all Chinese vocabulary words, idioms, or distinct terms in this image. Return a simple list.";
      schema = ocrSchema;
      parts = [
        { inlineData: { mimeType: 'image/jpeg', data: payload.image } },
        { text: prompt }
      ];
      break;
      
    default:
      throw new Error("Unknown analysis type");
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
  return JSON.parse(cleanText);
};

// --- EXPORTED FUNCTIONS ---

export const analyzeWord = async (word: string): Promise<AnalysisResult> => {
  try {
    const data = await performAnalysis({ type: 'word', text: word });
    return mapDataToResult(data);
  } catch (error) {
    console.error(`Failed to analyze word: ${word}`, error);
    return { type: EntryType.WORD, word, pinyin: "Error", definitionData: null, definitionMatchData: null };
  }
};

export const analyzeWordsBatch = async (words: string[]): Promise<Record<string, AnalysisResult>> => {
  // Using the new concurrent queue in UI, this function is less critical, 
  // but we keep it functional just in case.
  const results: Record<string, AnalysisResult> = {};
  for (const word of words) {
    results[word] = await analyzeWord(word);
  }
  return results;
};

export const analyzePoem = async (input: string): Promise<AnalysisResult | null> => {
  try {
    const data = await performAnalysis({ type: 'poem', text: input });
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
    const data = await performAnalysis({ type: 'ocr', image: base64Data });
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