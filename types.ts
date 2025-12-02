
export enum EntryType {
  WORD = 'WORD',
  POEM = 'POEM'
}

export enum QuestionType {
  PINYIN = 'PINYIN', // Word -> Write Pinyin
  DICTATION = 'DICTATION', // Pinyin -> Write Word
  DEFINITION = 'DEFINITION', // Word -> Select Meaning (Explanation)
  DEFINITION_MATCH = 'DEFINITION_MATCH', // Word -> Select word with same character meaning
  POEM_FILL = 'POEM_FILL', // Poem -> Fill in the blank
  POEM_DEFINITION = 'POEM_DEFINITION' // Poem -> Select Meaning of character
}

export enum AIProvider {
  GEMINI = 'GEMINI',
  DEEPSEEK = 'DEEPSEEK'
}

export interface AISettings {
  provider: AIProvider;
  deepseekKey?: string;
}

export interface DefinitionQuestionData {
  targetChar: string; // The specific character being tested (e.g., "益" in "精益求精")
  options: string[]; // 4 options (Definitions)
  correctIndex: number; // 0-3
}

export interface DefinitionMatchData {
  targetChar: string; // e.g. "益"
  options: string[]; // 4 words containing "益", e.g. ["延年益寿", "良师益友", "多得益善", "老当益壮"]
  correctIndex: number; // Index of the word where "益" has the SAME meaning as in the source word
}

export interface PoemData {
  title: string;
  dynasty: string;
  author: string;
  content: string; // Full text
  lines: string[]; // Split by punctuation
  fillAnswers: {
    lineIndex: number;
    answer: string; // The part to be filled
    pre: string; // Context before
    post: string; // Context after
  }[];
  definitionQuestions: {
    lineIndex: number;
    targetChar: string;
    options: string[];
    correctIndex: number;
  }[];
}

export interface WordEntry {
  id: string;
  type: EntryType;
  word: string; // For Poem, this can be the Title
  pinyin: string; // For Poem, can be empty or author pinyin
  createdAt: number;
  
  // Word specific
  definitionData?: DefinitionQuestionData;
  definitionMatchData?: DefinitionMatchData; // NEW: For "Same meaning" questions
  
  // Poem specific
  poemData?: PoemData;
  
  // User preferences
  enabledTypes: QuestionType[]; 
}

export interface FilterOptions {
  startDate: number | null;
  endDate: number | null;
}

export interface AnalysisResult {
  type: EntryType;
  word: string; // or Poem Title
  pinyin: string;
  definitionData: DefinitionQuestionData | null;
  definitionMatchData: DefinitionMatchData | null;
  poemData?: PoemData;
}
