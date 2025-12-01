export enum QuestionType {
  PINYIN = 'PINYIN', // Word -> Write Pinyin
  DICTATION = 'DICTATION', // Pinyin -> Write Word
  DEFINITION = 'DEFINITION' // Word -> Select Meaning
}

export interface DefinitionQuestionData {
  targetChar: string; // The specific character being tested (e.g., "益" in "精益求精")
  options: string[]; // 4 options
  correctIndex: number; // 0-3
}

export interface WordEntry {
  id: string;
  word: string;
  pinyin: string;
  createdAt: number; // Timestamp
  
  // AI-generated data cached for exams
  definitionData?: DefinitionQuestionData;
  
  // User preferences for this word (which exams to include it in by default)
  enabledTypes: QuestionType[]; 
}

export interface FilterOptions {
  startDate: number | null;
  endDate: number | null;
}

export interface AnalysisResult {
  pinyin: string;
  definitionData: DefinitionQuestionData | null;
}