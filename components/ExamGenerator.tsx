import React, { useState, useMemo } from 'react';
import { WordEntry, QuestionType, TestStatus, MatchMode } from '../types';
import { Printer, ArrowLeft, Filter, AlertCircle } from 'lucide-react';

interface ExamGeneratorProps {
  words: WordEntry[];
  onBack: () => void;
}

const ExamGenerator: React.FC<ExamGeneratorProps> = ({ words, onBack }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedStatuses, setSelectedStatuses] = useState<TestStatus[]>([TestStatus.UNTESTED, TestStatus.FAILED]);
  const [difficultyMode, setDifficultyMode] = useState<'ALL' | 'HARD_ONLY' | 'NORMAL_ONLY'>('ALL');

  const availableDates = useMemo(() => {
    const dates = new Set(words.map(w => new Date(w.createdAt).toLocaleDateString('zh-CN')));
    return Array.from(dates).sort().reverse();
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter(w => {
      if (selectedDate && new Date(w.createdAt).toLocaleDateString('zh-CN') !== selectedDate) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(w.testStatus)) return false;
      if (difficultyMode === 'HARD_ONLY' && !w.passedAfterRetries) return false;
      if (difficultyMode === 'NORMAL_ONLY' && w.passedAfterRetries) return false;
      return true;
    });
  }, [words, selectedDate, selectedStatuses, difficultyMode]);

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
      try { window.print(); } catch (e) { alert("调用打印失败"); } finally { setIsPrinting(false); }
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
               <span className="text-sm font-medium font-sans leading-none">{isAligned ? pinyinParts[idx] : (idx === 0 ? entry.pinyin : '')}</span>
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
        <div className="flex items-center justify-between">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center"><ArrowLeft className="w-5 h-5 mr-1" /> 返回</button>
            <button onClick={handlePrint} disabled={isPrinting || filteredWords.length === 0} className="bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg shadow flex items-center font-medium transition-colors disabled:opacity-50"><Printer className="w-5 h-5 mr-2" /> {isPrinting ? '正在准备...' : '打印 / 下载PDF'}</button>
        </div>
        <div className="flex flex-wrap items-center gap-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-gray-400" /><span className="text-sm font-bold text-gray-700">组卷规则:</span></div>
            <select className="border rounded px-2 py-1 text-sm bg-white min-w-[120px]" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}><option value="">所有日期</option>{availableDates.map(date => (<option key={date} value={date}>{date}</option>))}</select>
            <div className="ml-auto text-sm text-primary font-bold">已选 {filteredWords.length} 题</div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
        <div id="printable-root" className="relative">
          {/* 打印时的页脚页码 (CSS中已设置其样式) */}
          <div className="page-footer hidden print:block"></div>

          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[15mm] box-border relative mb-8">
            <div className="text-center border-b-2 border-black pb-4 mb-6 section-title">
              <h1 className="text-2xl font-bold font-serif tracking-widest mb-2">语文错题专项综合练习</h1>
              <div className="flex justify-between text-sm mt-4 font-kai px-4"><span>姓名: __________</span><span>日期: {selectedDate || new Date().toLocaleDateString('zh-CN')}</span><span>得分: __________</span></div>
            </div>

            {questions.pinyin.length > 0 && (
              <div className="mb-6">
                <h2 className="text-md font-bold mb-4 font-kai flex items-center section-title"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">1</span>看汉字，写拼音</h2>
                <div className="flex flex-wrap gap-x-8 gap-y-6">
                  {questions.pinyin.map((w, idx) => (<div key={idx} className="flex flex-col items-center question-item w-[calc(25%-1.5rem)] min-w-[110px]"><div className="w-full h-7 border-b border-gray-400 relative"></div><div className="font-serif text-lg mt-1 tracking-widest text-center">{w.word}</div></div>))}
                </div>
              </div>
            )}

            {questions.dictation.length > 0 && (
               <div className="mb-6">
               <h2 className="text-md font-bold mb-4 font-kai flex items-center section-title"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">2</span>看拼音，写词语</h2>
               <div className="flex flex-wrap gap-x-4 gap-y-8">
                 {questions.dictation.map((w, idx) => (
                   <div key={idx} className="question-item">{renderPinyinBoxes(w)}</div>
                 ))}
               </div>
             </div>
            )}

            {questions.poemFill.length > 0 && (
              <div className="mb-6">
                <h2 className="text-md font-bold mb-4 font-kai flex items-center section-title"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">3</span>古诗文默写</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {questions.poemFill.map((w, idx) => (
                    <div key={idx} className="question-item border border-gray-100 p-2 rounded bg-gray-50/30">
                      <div className="font-bold text-xs mb-1 font-kai text-gray-600">{idx + 1}. 《{w.word}》</div>
                      <div className="space-y-1">
                        {w.poemData?.fillAnswers.map((fill, fIdx) => (
                           <div key={fIdx} className="font-serif text-sm leading-relaxed">{fill.pre}<span className="inline-block border-b border-black min-w-[50px] text-center px-1 text-transparent select-none">{fill.answer}</span>{fill.post}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 优化：词语释义采用双栏排版 */}
            {questions.definition.length > 0 && (
              <div className="mb-6">
                <h2 className="text-md font-bold mb-4 font-kai flex items-center section-title"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">4</span>词语释义选择</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {questions.definition.map((w, idx) => (
                    <div key={idx} className="question-item">
                      <div className="font-serif text-sm mb-1 leading-tight">
                        {idx + 1}. “<span className="font-bold underline">{w.word}</span>”中“<span className="font-bold">{w.definitionData?.targetChar}</span>”的意思是：（ &nbsp; ）
                      </div>
                      <div className="grid grid-cols-1 gap-0.5 pl-3 text-[11px] font-kai text-gray-700">
                        {w.definitionData?.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.definitionMatch.length > 0 && (
               <div className="mb-6">
               <h2 className="text-md font-bold mb-4 font-kai flex items-center section-title"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">5</span>字词辨析</h2>
               <div className="space-y-4">
                 {questions.definitionMatch.map((w, idx) => {
                   const m = w.definitionMatchData!;
                   return (
                    <div key={idx} className="question-item">
                      {m.mode === MatchMode.SAME_AS_TARGET && (
                        <div className="grid grid-cols-2 gap-4 items-start">
                          <div className="font-serif text-sm leading-tight">
                            {idx + 1}. 与“<span className="font-bold underline">{m.context || w.word}</span>”中“<span className="font-bold">{m.targetChar}</span>”意思相近的是：（ &nbsp; ）
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 text-[11px] font-kai">
                            {m.options?.map((opt, oIdx) => (
                              <div key={oIdx} className="flex"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.mode === MatchMode.SYNONYM_CHOICE && (
                         <div className="bg-gray-50 p-2 rounded">
                          <div className="font-serif text-sm mb-1">
                            {idx + 1}. 选词填空：（ &nbsp; ）
                          </div>
                          <div className="mb-1 text-sm font-serif text-gray-600">“{m.context}”</div>
                          <div className="flex gap-4 pl-4 text-[11px] font-kai">
                            {m.options?.slice(0, 2).map((opt, oIdx) => (
                              <div key={oIdx} className="flex"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.mode === MatchMode.TWO_WAY_COMPARE && (
                        <div className="flex items-center justify-between border-l-2 border-gray-100 pl-3">
                          <div className="font-serif text-sm">
                            {idx + 1}. 判断“<span className="font-bold">{m.targetChar}</span>”意思是否相同：（ &nbsp; ）
                          </div>
                          <div className="flex gap-4 font-serif text-sm items-center">
                             <div className="bg-gray-100 px-2 rounded">{m.compareWordA}</div>
                             <div className="text-gray-300">/</div>
                             <div className="bg-gray-100 px-2 rounded">{m.compareWordB}</div>
                             <div className="flex gap-3 ml-2 text-xs font-kai">
                                <span>A.同</span><span>B.异</span>
                             </div>
                          </div>
                        </div>
                      )}
                    </div>
                   );
                 })}
               </div>
             </div>
            )}

            {/* 优化：古诗释义采用紧凑布局 */}
            {questions.poemDef.length > 0 && (
              <div className="mb-6">
                <h2 className="text-md font-bold mb-4 font-kai flex items-center section-title"><span className="bg-black text-white w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2">6</span>古诗重点字释义</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {questions.poemDef.map((w, idx) => (
                    <div key={idx} className="question-item border-l-2 border-primary/10 pl-2">
                      <div className="font-bold text-[10px] text-gray-400 mb-1">《{w.word}》</div>
                      {w.poemData?.definitionQuestions.map((q, qIdx) => (
                        <div key={qIdx} className="mb-2">
                          <div className="font-serif text-sm mb-1 leading-tight">
                             “{w.poemData?.lines[q.lineIndex]}”中“<span className="font-bold">{q.targetChar}</span>”指：（ &nbsp; ）
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px] font-kai text-gray-600">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 text-center text-gray-300 text-[10px] no-print">Generated by Yuwen Cuoti Helper</div>
          </div>

          <div className="print-break-before"></div>

          {/* 答案页同样显示页脚 */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[15mm] box-border relative">
            <div className="text-center border-b-2 border-black pb-4 mb-8 section-title">
              <h1 className="text-xl font-bold font-serif tracking-widest mb-2">参考答案与解析</h1>
            </div>

             {questions.pinyin.length > 0 && (
              <div className="mb-6"><h3 className="font-bold text-sm mb-2 bg-gray-50 p-1 px-2 border-l-4 border-black">1. 看汉字写拼音</h3><div className="grid grid-cols-4 gap-2 text-xs">{questions.pinyin.map((w, idx) => (<div key={idx} className="flex gap-2"><span className="font-bold">{w.word}:</span><span className="text-primary">{w.pinyin}</span></div>))}</div></div>
             )}
             {questions.dictation.length > 0 && (
              <div className="mb-6"><h3 className="font-bold text-sm mb-2 bg-gray-50 p-1 px-2 border-l-4 border-black">2. 看拼音写词语</h3><div className="grid grid-cols-4 gap-2 text-xs">{questions.dictation.map((w, idx) => (<div key={idx} className="flex gap-2"><span className="text-gray-500">{w.pinyin}:</span><span className="font-bold text-primary">{w.word}</span></div>))}</div></div>
             )}
             {questions.poemFill.length > 0 && (
              <div className="mb-6"><h3 className="font-bold text-sm mb-2 bg-gray-50 p-1 px-2 border-l-4 border-black">3. 古诗文默写</h3><div className="grid grid-cols-2 gap-2 text-xs">{questions.poemFill.map((w, idx) => (<div key={idx}><span className="font-bold mr-2">{w.word}:</span><span className="text-gray-700">{w.poemData?.fillAnswers.map(f => f.answer).join(' / ')}</span></div>))}</div></div>
             )}
             
             {questions.definition.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-sm mb-2 bg-gray-50 p-1 px-2 border-l-4 border-black">4. 词语释义答案</h3>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {questions.definition.map((w, idx) => (
                    <div key={idx}>
                      <span className="font-bold">{idx+1}.</span>
                      <span className="ml-1">{String.fromCharCode(65 + (w.definitionData?.correctIndex || 0))}</span>
                    </div>
                  ))}
                </div>
              </div>
             )}

             {questions.definitionMatch.length > 0 && (
              <div className="mb-6"><h3 className="font-bold text-sm mb-2 bg-gray-50 p-1 px-2 border-l-4 border-black">5. 字词辨析答案</h3>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {questions.definitionMatch.map((w, idx) => {
                    const m = w.definitionMatchData!;
                    let ansStr = "";
                    if (m.mode === MatchMode.TWO_WAY_COMPARE) ansStr = m.isSame ? "A (相同)" : "B (不同)";
                    else ansStr = String.fromCharCode(65 + (m.correctIndex || 0));
                    return (
                      <div key={idx}>
                        <span className="font-bold">{idx+1}.</span>
                        <span className="ml-1">{ansStr}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
             )}

             {questions.poemDef.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-sm mb-2 bg-gray-50 p-1 px-2 border-l-4 border-black">6. 古诗重点字释义答案</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {questions.poemDef.map((w, idx) => (
                    <div key={idx} className="border-b border-dashed border-gray-100 pb-1">
                      <span className="font-bold text-gray-400 mr-2">《{w.word}》:</span>
                      {w.poemData?.definitionQuestions.map((q, qIdx) => (
                        <span key={qIdx} className="mr-3">
                           {q.targetChar}: {String.fromCharCode(65 + q.correctIndex)}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamGenerator;