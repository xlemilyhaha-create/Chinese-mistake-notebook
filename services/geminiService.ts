
import { AnalysisResult, EntryType } from "../types";

const analyzeWithGeminiBackend = async (payload: any) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); 

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API failure: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const analyzeWordsBatch = async (words: string[]): Promise<AnalysisResult[]> => {
  try {
    const data = await analyzeWithGeminiBackend({ type: 'batch-words', words });
    if (data.results && Array.isArray(data.results)) {
      return data.results.map((item: any) => mapDataToResult(item));
    }
    return [];
  } catch (error) {
    console.error("Batch Analysis Error:", error);
    throw error;
  }
};

// Keep single for compatibility or poems
export const analyzeWord = async (word: string): Promise<AnalysisResult> => {
  const res = await analyzeWordsBatch([word]);
  return res[0];
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
    return null;
  }
};

export const extractWordsFromImage = async (base64Data: string, mimeType: string): Promise<string[]> => {
  try {
    const data = await analyzeWithGeminiBackend({ type: 'ocr', image: base64Data });
    return data.words || [];
  } catch (error) {
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
