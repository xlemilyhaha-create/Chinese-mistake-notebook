
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

export enum TestStatus {
  UNTESTED = 'UNTESTED',
  PASSED = 'PASSED',
  FAILED = 'FAILED'
}

export interface DefinitionQuestionData {
  targetChar: string; // The specific character being tested
  options: string[]; // 4 options (Definitions)
  correctIndex: number; // 0-3
}

export enum MatchMode {
  SAME_AS_TARGET = 'SAME_AS_TARGET', // 模式2：在词群中找意思相同的字 (如图一)
  SYNONYM_CHOICE = 'SYNONYM_CHOICE', // 模式1：近义词填空 (选词填空)
  TWO_WAY_COMPARE = 'TWO_WAY_COMPARE' // 模式3：两个词中的字义判断 (如图二)
}

export interface DefinitionMatchData {
  mode: MatchMode;
  targetChar: string; 
  // SAME_AS_TARGET & SYNONYM_CHOICE use these:
  context?: string; // 语境，如 "日益紧密"
  options?: string[]; // 4个选项
  correctIndex?: number;
  // TWO_WAY_COMPARE uses these:
  compareWordA?: string; // 如 "题西林壁"
  compareWordB?: string; // 如 "小题大做"
  isSame?: boolean; // 意思是否相同
}

export interface PoemData {
  title: string;
  dynasty: string;
  author: string;
  content: string; 
  lines: string[]; 
  fillAnswers: {
    lineIndex: number;
    answer: string; 
    pre: string; 
    post: string; 
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
  word: string; 
  pinyin: string; 
  createdAt: number;
  definitionData?: DefinitionQuestionData;
  definitionMatchData?: DefinitionMatchData; 
  poemData?: PoemData;
  enabledTypes: QuestionType[]; 
  testStatus: TestStatus;
  passedAfterRetries: boolean;
}

export interface AnalysisResult {
  type: EntryType;
  word: string;
  pinyin: string;
  definitionData: DefinitionQuestionData | null;
  definitionMatchData: DefinitionMatchData | null;
  poemData?: PoemData;
}
