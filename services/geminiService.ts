
import { AnalysisResult, EntryType, MatchMode } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const analyzeWithGeminiBackend = async (payload: any, retries = 4) => {
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

    // 处理频率限制 (Rate Limit)
    if (response.status === 429 && retries > 0) {
      // 随着重试次数增加，等待时间变长 (10s, 20s, 30s...)
      const waitTime = (5 - retries) * 10000; 
      console.warn(`AI 频率限制，将在 ${waitTime/1000} 秒后重试...`);
      await delay(waitTime);
      return analyzeWithGeminiBackend(payload, retries - 1);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API failure: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (retries > 0 && (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('500'))) {
      await delay(3000);
      return analyzeWithGeminiBackend(payload, retries - 1);
    }
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
  let matchData = null;
  if (data.hasMatchQuestion) {
    matchData = {
      mode: data.matchMode as MatchMode || MatchMode.SAME_AS_TARGET,
      targetChar: data.targetChar || data.word?.[0] || '?',
      context: data.matchContext,
      options: data.matchOptions,
      correctIndex: data.matchCorrectIndex,
      compareWordA: data.compareWordA,
      compareWordB: data.compareWordB,
      isSame: data.isSame
    };
  }

  return {
    type: EntryType.WORD,
    word: data.word,
    pinyin: data.pinyin,
    definitionData: data.hasDefinitionQuestion && data.options && data.options.length === 4 ? {
      targetChar: data.targetChar || data.word?.[0] || '?',
      options: data.options,
      correctIndex: typeof data.correctIndex === 'number' ? data.correctIndex : 0,
    } : null,
    definitionMatchData: matchData
  };
}
