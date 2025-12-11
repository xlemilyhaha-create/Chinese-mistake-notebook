
import React, { useState, useMemo } from 'react';
import { WordEntry, QuestionType, TestStatus, ExamFilterOptions } from '../types';
import { Printer, ArrowLeft, Sliders, AlertCircle, Filter } from 'lucide-react';

interface ExamGeneratorProps {
  words: WordEntry[];
  onBack: () => void;
}

const ExamGenerator: React.FC<ExamGeneratorProps> = ({ words, onBack }) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [examFilters, setExamFilters] = useState<ExamFilterOptions>({
    testStatuses: [TestStatus.NOT_TESTED, TestStatus.FAILED],
    isMultipleAttempts: null
  });
  
  const availableDates = useMemo(() => {
    const dates = new Set(words.map(w => new Date(w.createdAt).toLocaleDateString('zh-CN')));
    return Array.from(dates).sort().reverse();
  }, [words]);

  const filteredWords = useMemo(() => {
    let result = words;
    
    // Date filter
    if (selectedDate) {
      result = result.filter(w => new Date(w.createdAt).toLocaleDateString('zh-CN') === selectedDate);
    }
    
    // Test status filter - 确保默认筛选条件应用
    const testStatuses = examFilters.testStatuses || [TestStatus.NOT_TESTED, TestStatus.FAILED];
    if (testStatuses.length > 0) {
      result = result.filter(w => testStatuses.includes(w.testStatus));
    }
    
    // Multiple attempts filter
    if (examFilters.isMultipleAttempts !== null && examFilters.isMultipleAttempts !== undefined) {
      result = result.filter(w => w.isMultipleAttempts === examFilters.isMultipleAttempts);
    }
    
    return result;
  }, [words, selectedDate, examFilters]);

  const questions = useMemo(() => {
    const qs = {
      pinyin: [] as WordEntry[],
      dictation: [] as WordEntry[],
      definition: [] as WordEntry[],
      definitionMatch: [] as WordEntry[],
      poemFill: [] as WordEntry[],
      poemDef: [] as WordEntry[]
    };

    filteredWords.forEach(w => {
      if (w.enabledTypes.includes(QuestionType.PINYIN)) qs.pinyin.push(w);
      if (w.enabledTypes.includes(QuestionType.DICTATION)) qs.dictation.push(w);
      if (w.enabledTypes.includes(QuestionType.DEFINITION) && w.definitionData) qs.definition.push(w);
      if (w.enabledTypes.includes(QuestionType.DEFINITION_MATCH) && w.definitionMatchData) qs.definitionMatch.push(w);
      if (w.enabledTypes.includes(QuestionType.POEM_FILL) && w.poemData) qs.poemFill.push(w);
      if (w.enabledTypes.includes(QuestionType.POEM_DEFINITION) && w.poemData) qs.poemDef.push(w);
    });
    return qs;
  }, [filteredWords]);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        alert("调用打印失败");
      } finally {
        setIsPrinting(false);
      }
    }, 500);
  };

  const renderPinyinBoxes = (entry: WordEntry) => {
    const chars = entry.word.split('');
    const pinyinParts = entry.pinyin.trim().split(/\s+/);
    const isAligned = chars.length === pinyinParts.length;

    return (
      <div className="flex gap-1 justify-center">
        {chars.map((char, idx) => (
          <div key={idx} className="flex flex-col items-center">
             <div className="h-6 flex items-end justify-center w-10 text-center">
               <span className="text-sm font-medium font-sans leading-none">
                 {isAligned ? pinyinParts[idx] : (idx === 0 ? entry.pinyin : '')}
               </span>
             </div>
             <div className="w-10 h-10 border border-black relative bg-white">
                <div className="absolute inset-0 border-t border-dashed border-gray-300 top-1/2 pointer-events-none"></div>
                <div className="absolute inset-0 border-l border-dashed border-gray-300 left-1/2 pointer-events-none"></div>
             </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b p-4 flex flex-col gap-4 no-print shadow-sm z-10 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center">
              <ArrowLeft className="w-5 h-5 mr-1" /> 返回
            </button>
            <div className="h-6 w-px bg-gray-300 hidden md:block"></div>
            <div className="flex items-center gap-2 flex-1 md:flex-none">
              <Sliders className="w-4 h-4 text-gray-500" />
              <select 
                className="border rounded px-3 py-1.5 text-sm bg-gray-50 min-w-[160px]"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                <option value="">所有日期 ({words.length} 词)</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              组卷条件
            </button>
            <div className="text-xs text-gray-500 hidden lg:flex items-center">
               <AlertCircle className="w-3 h-3 mr-1" />
               预览为连续模式，打印/PDF将自动分页
            </div>
            <button 
              onClick={handlePrint}
              disabled={isPrinting}
              className="bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg shadow flex items-center font-medium transition-colors disabled:opacity-70"
            >
              <Printer className="w-5 h-5 mr-2" />
              {isPrinting ? '正在调用打印...' : '打印 / 下载PDF'}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">测试通过状态（可多选）</label>
              <div className="flex flex-wrap gap-2">
                {Object.values(TestStatus).map(status => {
                  const isSelected = examFilters.testStatuses?.includes(status);
                  const labels: Record<TestStatus, string> = {
                    [TestStatus.NOT_TESTED]: '未测试',
                    [TestStatus.FAILED]: '未通过',
                    [TestStatus.PASSED]: '已通过'
                  };
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        const newFilters = { ...examFilters };
                        if (!newFilters.testStatuses) newFilters.testStatuses = [];
                        
                        if (newFilters.testStatuses.includes(status)) {
                          newFilters.testStatuses = newFilters.testStatuses.filter(s => s !== status);
                        } else {
                          newFilters.testStatuses = [...newFilters.testStatuses, status];
                        }
                        
                        setExamFilters(newFilters);
                      }}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        isSelected ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {labels[status]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">是否多次测试才通过</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExamFilters({ ...examFilters, isMultipleAttempts: null })}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    examFilters.isMultipleAttempts === null ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setExamFilters({ ...examFilters, isMultipleAttempts: true })}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    examFilters.isMultipleAttempts === true ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  是
                </button>
                <button
                  onClick={() => setExamFilters({ ...examFilters, isMultipleAttempts: false })}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    examFilters.isMultipleAttempts === false ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  否
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-600 pt-2 border-t">
              当前筛选结果: {filteredWords.length} / {words.length} 个词条
              {examFilters.testStatuses && examFilters.testStatuses.length > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  (状态: {examFilters.testStatuses.map(s => {
                    const labels: Record<TestStatus, string> = {
                      [TestStatus.NOT_TESTED]: '未测试',
                      [TestStatus.FAILED]: '未通过',
                      [TestStatus.PASSED]: '已通过'
                    };
                    return labels[s];
                  }).join(', ')})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
        <div id="printable-root">
          
          {/* --- PAGE 1: QUESTIONS --- */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[20mm] box-border relative mb-8">
            <div className="text-center border-b-2 border-black pb-4 mb-8 section-title">
              <h1 className="text-2xl font-bold font-serif tracking-widest mb-2">语文专项综合练习</h1>
              <div className="flex justify-between text-sm mt-4 font-kai">
                <span>班级: __________</span>
                <span>姓名: __________</span>
                <span>得分: __________</span>
                <span>日期: {selectedDate || new Date().toLocaleDateString('zh-CN')}</span>
              </div>
            </div>

            {/* Section 1: Pinyin */}
            {questions.pinyin.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                  <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">1</span>
                  看汉字，写拼音
                </h2>
                <div className="flex flex-wrap gap-x-8 gap-y-8">
                  {questions.pinyin.map((w, idx) => (
                    <div key={idx} className="flex flex-col items-center question-item w-[calc(25%-1.5rem)] min-w-[120px]">
                      <div className="w-full h-8 border-b border-gray-400 relative"></div>
                      <div className="font-serif text-xl mt-2 tracking-widest text-center">{w.word}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Dictation */}
            {questions.dictation.length > 0 && (
               <div className="mb-8">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                 <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">2</span>
                 看拼音，写词语
               </h2>
               <div className="flex flex-wrap gap-x-6 gap-y-10">
                 {questions.dictation.map((w, idx) => (
                   <div key={idx} className="question-item">
                      {renderPinyinBoxes(w)}
                   </div>
                 ))}
               </div>
             </div>
            )}

            {/* Section 3: Poem Fill */}
            {questions.poemFill.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                  <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">3</span>
                  古诗文默写
                </h2>
                <div className="space-y-6">
                  {questions.poemFill.map((w, idx) => (
                    <div key={idx} className="question-item bg-gray-50 p-4 rounded border border-gray-100">
                      <div className="font-bold mb-2 font-kai">{idx + 1}. {w.word} ({w.poemData?.dynasty} · {w.poemData?.author})</div>
                      <div className="space-y-2">
                        {w.poemData?.fillAnswers.map((fill, fIdx) => (
                           <div key={fIdx} className="font-serif text-lg leading-loose">
                             {fill.pre}
                             <span className="inline-block border-b border-black min-w-[80px] text-center px-2 text-transparent select-none">{fill.answer}</span>
                             {fill.post}
                           </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 4: Poem Reading/Definition */}
            {questions.poemDef.length > 0 && (
               <div className="mb-8">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                 <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">4</span>
                 古诗文阅读与释义
               </h2>
               <div className="space-y-6">
                 {questions.poemDef.map((w, idx) => (
                    <div key={idx} className="question-item">
                       <div className="mb-2 font-serif text-sm bg-gray-50 p-2 rounded italic">
                         {w.poemData?.content.split('\n').map((line, lIdx) => <div key={lIdx}>{line}</div>)}
                       </div>
                       {w.poemData?.definitionQuestions.map((q, qIdx) => (
                         <div key={qIdx} className="mt-2">
                           <div className="font-serif text-base mb-1">
                             {qIdx + 1}. 诗句“{w.poemData?.lines[q.lineIndex]}”中，“<span className="font-bold text-lg">{q.targetChar}</span>”的意思是：（ &nbsp;&nbsp;&nbsp;&nbsp; ）
                           </div>
                           <div className="grid grid-cols-2 gap-2 pl-4 text-sm font-kai">
                              {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex">
                                      <span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                      <span>{opt}</span>
                                  </div>
                              ))}
                           </div>
                         </div>
                       ))}
                    </div>
                 ))}
               </div>
             </div>
            )}

            {/* Section 5: Word Definition */}
            {questions.definition.length > 0 && (
               <div className="mb-8">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                 <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">5</span>
                 字义选择
               </h2>
               <div className="space-y-6">
                 {questions.definition.map((w, idx) => (
                    <div key={idx} className="question-item">
                      <div className="font-serif text-base mb-2">
                        {idx + 1}. 请选择“<span className="font-bold underline mx-1">{w.word}</span>”中“<span className="font-bold text-lg">{w.definitionData!.targetChar}</span>”的正确意思：（ &nbsp;&nbsp;&nbsp;&nbsp; ）
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-4 text-sm font-kai">
                          {w.definitionData!.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex">
                                  <span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                  <span>{opt}</span>
                              </div>
                          ))}
                      </div>
                    </div>
                 ))}
               </div>
             </div>
            )}

            {/* Section 6: Word Definition Match (Different meaning usage) */}
            {questions.definitionMatch.length > 0 && (
               <div className="mb-8">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title">
                 <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">6</span>
                 字义辨析
               </h2>
               <div className="space-y-6">
                 {questions.definitionMatch.map((w, idx) => (
                    <div key={idx} className="question-item">
                      <div className="font-serif text-base mb-2">
                        {idx + 1}. 下列词语中，“<span className="font-bold text-lg">{w.definitionMatchData!.targetChar}</span>”的意思与“<span className="font-bold underline mx-1">{w.word}</span>”中“<span className="font-bold text-lg">{w.definitionMatchData!.targetChar}</span>”意思相同的是：（ &nbsp;&nbsp;&nbsp;&nbsp; ）
                      </div>
                      <div className="grid grid-cols-2 gap-2 pl-4 text-sm font-kai">
                          {w.definitionMatchData!.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex">
                                  <span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                                  <span>{opt}</span>
                              </div>
                          ))}
                      </div>
                    </div>
                 ))}
               </div>
             </div>
            )}

            <div className="mt-12 text-center text-gray-300 text-xs no-print">
              Generated by Yuwen Cuoti Helper - Page 1
            </div>
          </div>

          {/* --- PAGE BREAK --- */}
          <div className="print-break-before"></div>

          {/* --- PAGE 2: ANSWERS --- */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[20mm] box-border relative">
            <div className="text-center border-b-2 border-black pb-4 mb-8 section-title">
              <h1 className="text-xl font-bold font-serif tracking-widest mb-2">参考答案与解析</h1>
              <div className="text-sm mt-2 font-kai text-gray-600">
                 仅供教师或家长批改使用
              </div>
            </div>

             {/* 1. Pinyin Answers */}
             {questions.pinyin.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-md mb-2 bg-gray-100 p-1">1. 看汉字写拼音</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {questions.pinyin.map((w, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="font-bold">{w.word}:</span>
                      <span className="text-primary">{w.pinyin}</span>
                    </div>
                  ))}
                </div>
              </div>
             )}

             {/* 2. Dictation Answers */}
             {questions.dictation.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-md mb-2 bg-gray-100 p-1">2. 看拼音写词语</h3>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {questions.dictation.map((w, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span className="text-gray-500">{w.pinyin}:</span>
                      <span className="font-bold text-primary">{w.word}</span>
                    </div>
                  ))}
                </div>
              </div>
             )}

             {/* 3. Poem Fill Answers */}
             {questions.poemFill.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-md mb-2 bg-gray-100 p-1">3. 古诗文默写</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {questions.poemFill.map((w, idx) => (
                    <li key={idx}>
                       <span className="font-bold mr-2">{w.word}:</span>
                       {w.poemData?.fillAnswers.map(f => f.answer).join(' / ')}
                    </li>
                  ))}
                </ul>
              </div>
             )}

             {/* 4. Poem Def Answers */}
             {questions.poemDef.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-md mb-2 bg-gray-100 p-1">4. 古诗文释义</h3>
                <div className="space-y-2 text-sm">
                   {questions.poemDef.map((w, idx) => (
                      <div key={idx}>
                        <div className="font-bold text-gray-700">{w.word}</div>
                        {w.poemData?.definitionQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="ml-4 flex gap-2">
                             <span>({qIdx+1}) “{q.targetChar}”:</span>
                             <span className="text-green-600 font-bold">{String.fromCharCode(65 + q.correctIndex)}</span>
                             <span className="text-gray-500">({q.options[q.correctIndex]})</span>
                          </div>
                        ))}
                      </div>
                   ))}
                </div>
              </div>
             )}

             {/* 5. Word Def Answers */}
             {questions.definition.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-md mb-2 bg-gray-100 p-1">5. 字义选择</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {questions.definition.map((w, idx) => (
                    <div key={idx} className="flex gap-2">
                      <span>{idx+1}. “{w.word}”({w.definitionData?.targetChar}):</span>
                      <span className="text-green-600 font-bold">{String.fromCharCode(65 + w.definitionData!.correctIndex)}</span>
                      <span className="text-gray-500 text-xs truncate">({w.definitionData!.options[w.definitionData!.correctIndex]})</span>
                    </div>
                  ))}
                </div>
              </div>
             )}

             {/* 6. Match Answers */}
             {questions.definitionMatch.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-md mb-2 bg-gray-100 p-1">6. 字义辨析</h3>
                <div className="space-y-2 text-sm">
                  {questions.definitionMatch.map((w, idx) => (
                    <div key={idx} className="flex gap-2 flex-col">
                      <div>{idx+1}. “{w.word}” 中的 “{w.definitionMatchData?.targetChar}”</div>
                      <div className="ml-4 flex gap-2 items-center">
                         <span className="text-gray-600">正确选项:</span>
                         <span className="text-green-600 font-bold">{String.fromCharCode(65 + w.definitionMatchData!.correctIndex)}</span>
                         <span className="font-bold underline">{w.definitionMatchData!.options[w.definitionMatchData!.correctIndex]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
             )}

             <div className="mt-12 text-center text-gray-300 text-xs no-print">
              Generated by Yuwen Cuoti Helper - Page 2 (Answers)
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ExamGenerator;