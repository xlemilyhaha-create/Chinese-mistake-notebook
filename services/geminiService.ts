
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, EntryType } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to clean markdown formatting from JSON response
const cleanJson = (text: string | undefined): string => {
  if (!text) return '{}';
  let cleaned = text.trim();
  // Remove markdown code blocks if present (e.g., ```json ... ```)
  cleaned = cleaned.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  
  // Robust extraction: find the first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
};

// --- SCHEMAS ---

const itemSchemaProperties = {
  word: { type: Type.STRING, description: "The exact Chinese word." },
  pinyin: {
    type: Type.STRING,
    description: "The correct pinyin for the word with tone marks. IMPORTANT: separate each character's pinyin with a space (e.g., 'jīng yì qiú jīng').",
  },
  
  // Standard Definition (Explanation)
  hasDefinitionQuestion: {
    type: Type.BOOLEAN,
    description: "Whether a multiple choice definition question can be generated.",
  },
  targetChar: {
    type: Type.STRING,
    description: "The specific character to test definition for.",
    nullable: true,
  },
  options: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: "4 options for the meaning in SIMPLIFIED CHINESE. One is correct, three are distractors.",
    nullable: true,
  },
  correctIndex: {
    type: Type.INTEGER,
    description: "The index (0-3) of the correct option.",
    nullable: true,
  },

  // NEW: Definition Match (Same Meaning Usage)
  hasMatchQuestion: {
    type: Type.BOOLEAN,
    description: "Whether we can generate a question finding another word with the SAME character meaning.",
  },
  matchOptions: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: "4 Chinese words/idioms containing the targetChar. One must use targetChar with the SAME meaning as in the source word. Three must use targetChar with DIFFERENT meanings.",
    nullable: true
  },
  matchCorrectIndex: {
    type: Type.INTEGER,
    description: "Index (0-3) of the word where targetChar has the SAME meaning as in the source word.",
    nullable: true
  }
};

const batchAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: itemSchemaProperties,
        required: ["pinyin", "word"],
      },
    },
  },
};

const poemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    dynasty: { type: Type.STRING, description: "e.g., Tang, Song" },
    author: { type: Type.STRING },
    content: { type: Type.STRING, description: "Full poem text" },
    lines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lines split by punctuation" },
    fillQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          lineIndex: { type: Type.INTEGER },
          pre: { type: Type.STRING, description: "Text before the blank" },
          answer: { type: Type.STRING, description: "The hidden text (2-4 chars)" },
          post: { type: Type.STRING, description: "Text after the blank" },
        }
      },
      description: "Pick 1-2 famous lines to create fill-in-the-blank questions."
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
      },
      description: "Pick 1-2 difficult characters to create definition questions. Options MUST be in Simplified Chinese."
    }
  },
  required: ["title", "author", "lines"]
};

const ocrSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    words: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of Chinese words or idioms found in the image."
    }
  }
};

// --- FUNCTIONS ---

export const analyzeWord = async (word: string): Promise<AnalysisResult> => {
   // Legacy single word - fallback to empty
  return { 
    type: EntryType.WORD, 
    word, 
    pinyin: "error", 
    definitionData: null,
    definitionMatchData: null
  };
};

export const analyzeWordsBatch = async (words: string[]): Promise<Record<string, AnalysisResult>> => {
  if (!apiKey) {
    console.error("API Key missing");
    return {};
  }
  
  if (words.length === 0) return {};

  try {
    const prompt = `
      Analyze the following list of Chinese words: ${JSON.stringify(words)}.
      
      For each word, perform these tasks:
      1. **Pinyin**: Provide Pinyin with tones. Separate each character's pinyin with a space.
      2. **Definition Test**: Identify the most challenging character (targetChar). Create a multiple-choice question for its MEANING. 
         - **CRITICAL**: The options must be in SIMPLIFIED CHINESE. Do NOT use English.
      3. **Definition Match Test (One-character multi-meaning)**: For the SAME targetChar, find 4 other Chinese words/idioms containing it.
         - One word must use the targetChar with the SAME meaning as in the source word (Correct Answer).
         - Three words must use the targetChar with DIFFERENT meanings (Distractors).
      
      Return a JSON object with an 'items' array.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: batchAnalysisSchema,
      }
    });

    const rawText = cleanJson(response.text);
    const data = JSON.parse(rawText);
    const itemsArray = Array.isArray(data) ? data : (data.items || []);

    const results: Record<string, AnalysisResult> = {};
    if (Array.isArray(itemsArray)) {
      itemsArray.forEach((item: any) => {
        if (item.word) {
          results[item.word.trim()] = mapDataToResult(item);
        }
      });
    }
    return results;

  } catch (error) {
    console.error("Batch Analysis Error:", error);
    return {};
  }
};

export const analyzePoem = async (input: string): Promise<AnalysisResult | null> => {
  if (!apiKey) return null;

  try {
    const prompt = `
      Analyze this Chinese poem text/request: "${input}".
      1. Identify the Title, Author, Dynasty, and content.
      2. Split into lines.
      3. Create 1-2 "Fill in the blank" questions from famous lines (hide 2-4 chars).
      4. Create 1-2 "Definition" questions for difficult characters.
         - **CRITICAL**: The definition options must be in SIMPLIFIED CHINESE.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: poemSchema,
      }
    });

    const data = JSON.parse(cleanJson(response.text));
    
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
  if (!apiKey) return [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: "Identify all Chinese vocabulary words, idioms, or distinct terms in this image. Return a simple list." }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: ocrSchema,
      }
    });

    const data = JSON.parse(cleanJson(response.text));
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
