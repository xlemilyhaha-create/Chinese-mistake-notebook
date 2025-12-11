
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
  NOT_TESTED = 'NOT_TESTED', // 未测试
  FAILED = 'FAILED', // 未通过
  PASSED = 'PASSED' // 已通过
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
  
  // Test status tracking
  testStatus: TestStatus; // 测试通过状态
  isMultipleAttempts: boolean; // 是否多次测试才通过
  previousTestStatus?: TestStatus; // 上一次测试状态，用于判断是否多次测试才通过
}

export interface FilterOptions {
  startDate: number | null;
  endDate: number | null;
  questionTypes?: QuestionType[]; // 题型过滤
  testStatuses?: TestStatus[]; // 测试通过状态过滤
  isMultipleAttempts?: boolean | boolean[] | null; // 是否多次测试才通过过滤 (null表示不过滤，数组表示多选)
}

export interface ExamFilterOptions {
  testStatuses?: TestStatus[]; // 测试通过状态过滤（多选）
  isMultipleAttempts?: boolean | null; // 是否多次测试才通过过滤
}

export interface AnalysisResult {
  type: EntryType;
  word: string; // or Poem Title
  pinyin: string;
  definitionData: DefinitionQuestionData | null;
  definitionMatchData: DefinitionMatchData | null;
  poemData?: PoemData;
}