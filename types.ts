export enum EntryType {
  WORD = 'WORD',
  POEM = 'POEM'
}

export enum QuestionType {
  PINYIN = 'PINYIN', // Word -> Write Pinyin
  DICTATION = 'DICTATION', // Pinyin -> Write Word
  DEFINITION = 'DEFINITION', // Word -> Select Meaning
  POEM_FILL = 'POEM_FILL', // Poem -> Fill in the blank
  POEM_DEFINITION = 'POEM_DEFINITION' // Poem -> Select Meaning of character
}

export interface DefinitionQuestionData {
  targetChar: string; // The specific character being tested (e.g., "益" in "精益求精")
  options: string[]; // 4 options
  correctIndex: number; // 0-3
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
  type: EntryType; // NEW: Distinguish between WORD and POEM
  word: string; // For Poem, this can be the Title
  pinyin: string; // For Poem, can be empty or author pinyin
  createdAt: number;
  
  // Word specific
  definitionData?: DefinitionQuestionData;
  
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
  poemData?: PoemData;
}