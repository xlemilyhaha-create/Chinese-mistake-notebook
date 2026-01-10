
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
        <div id="printable-root">
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[20mm] box-border relative mb-8">
            <div className="text-center border-b-2 border-black pb-4 mb-8 section-title">
              <h1 className="text-2xl font-bold font-serif tracking-widest mb-2">语文错题专项综合练习</h1>
              <div className="flex justify-between text-sm mt-4 font-kai"><span>姓名: __________</span><span>日期: {selectedDate || new Date().toLocaleDateString('zh-CN')}</span><span>得分: __________</span></div>
            </div>

            {questions.pinyin.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title"><span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">1</span>看汉字，写拼音</h2>
                <div className="flex flex-wrap gap-x-8 gap-y-8">
                  {questions.pinyin.map((w, idx) => (<div key={idx} className="flex flex-col items-center question-item w-[calc(25%-1.5rem)] min-w-[120px]"><div className="w-full h-8 border-b border-gray-400 relative"></div><div className="font-serif text-xl mt-2 tracking-widest text-center">{w.word}</div></div>))}
                </div>
              </div>
            )}

            {questions.dictation.length > 0 && (
               <div className="mb-8">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title"><span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">2</span>看拼音，写词语</h2>
               <div className="flex flex-wrap gap-x-6 gap-y-10">
                 {questions.dictation.map((w, idx) => (<div key={idx} className="question-item">{renderPinyinBoxes(w)}</div>))}
               </div>
             </div>
            )}

            {questions.poemFill.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title"><span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">3</span>古诗文默写</h2>
                <div className="space-y-4">
                  {questions.poemFill.map((w, idx) => (
                    <div key={idx} className="question-item bg-gray-50 p-4 rounded border border-gray-100">
                      <div className="font-bold mb-2 font-kai">{idx + 1}. {w.word} ({w.poemData?.dynasty} · {w.poemData?.author})</div>
                      <div className="space-y-1">
                        {w.poemData?.fillAnswers.map((fill, fIdx) => (
                           <div key={fIdx} className="font-serif text-lg leading-loose">{fill.pre}<span className="inline-block border-b border-black min-w-[80px] text-center px-2 text-transparent select-none">{fill.answer}</span>{fill.post}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.definitionMatch.length > 0 && (
               <div className="mb-8">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center section-title"><span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">4</span>字词辨析</h2>
               <div className="space-y-6">
                 {questions.definitionMatch.map((w, idx) => {
                   const m = w.definitionMatchData!;
                   return (
                    <div key={idx} className="question-item">
                      {/* 模式 A：SAME_AS_TARGET (图一) */}
                      {m.mode === MatchMode.SAME_AS_TARGET && (
                        <>
                          <div className="font-serif text-base mb-2">
                            {idx + 1}. 与“<span className="font-bold underline">{m.context || w.word}</span>”里的“<span className="text-lg font-bold">{m.targetChar}</span>”意思相近的词是：（ &nbsp;&nbsp;&nbsp;&nbsp; ）
                          </div>
                          <div className="grid grid-cols-2 gap-2 pl-4 text-sm font-kai">
                            {m.options?.map((opt, oIdx) => (
                              <div key={oIdx} className="flex"><span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </>
                      )}
                      {/* 模式 B：SYNONYM_CHOICE */}
                      {m.mode === MatchMode.SYNONYM_CHOICE && (
                         <>
                          <div className="font-serif text-base mb-2">
                            {idx + 1}. 选词填空。在句子中填入最恰当的词语：（ &nbsp;&nbsp;&nbsp;&nbsp; ）
                          </div>
                          <div className="mb-2 italic bg-gray-50 p-2 font-serif">{m.context}</div>
                          <div className="grid grid-cols-2 gap-2 pl-4 text-sm font-kai">
                            {m.options?.slice(0, 2).map((opt, oIdx) => (
                              <div key={oIdx} className="flex"><span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </>
                      )}
                      {/* 模式 C：TWO_WAY_COMPARE (图二) */}
                      {m.mode === MatchMode.TWO_WAY_COMPARE && (
                        <>
                          <div className="font-serif text-base mb-2">
                            {idx + 1}. 判断下面两个词语中“<span className="text-lg font-bold">{m.targetChar}</span>”的意思是否相同：（ &nbsp;&nbsp;&nbsp;&nbsp; ）
                          </div>
                          <div className="flex justify-center items-center gap-8 py-2 font-serif text-lg bg-gray-50 rounded">
                             <div className="border-b-2 border-primary px-2">{m.compareWordA}</div>
                             <div className="text-gray-400">vs</div>
                             <div className="border-b-2 border-secondary px-2">{m.compareWordB}</div>
                          </div>
                          <div className="flex justify-center gap-12 mt-2 text-sm font-kai">
                             <div className="flex items-center"><span className="mr-2 font-bold">A.</span>相同</div>
                             <div className="flex items-center"><span className="mr-2 font-bold">B.</span>不同</div>
                          </div>
                        </>
                      )}
                    </div>
                   );
                 })}
               </div>
             </div>
            )}

            <div className="mt-12 text-center text-gray-300 text-xs no-print">Generated by Yuwen Cuoti Helper - Exam Page</div>
          </div>

          <div className="print-break-before"></div>

          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[20mm] box-border relative">
            <div className="text-center border-b-2 border-black pb-4 mb-8 section-title">
              <h1 className="text-xl font-bold font-serif tracking-widest mb-2">参考答案与解析</h1>
            </div>

             {questions.pinyin.length > 0 && (
              <div className="mb-6"><h3 className="font-bold text-md mb-2 bg-gray-100 p-1">1. 看汉字写拼音</h3><div className="grid grid-cols-3 gap-2 text-sm">{questions.pinyin.map((w, idx) => (<div key={idx} className="flex gap-2"><span className="font-bold">{w.word}:</span><span className="text-primary">{w.pinyin}</span></div>))}</div></div>
             )}
             {questions.dictation.length > 0 && (
              <div className="mb-6"><h3 className="font-bold text-md mb-2 bg-gray-100 p-1">2. 看拼音写词语</h3><div className="grid grid-cols-3 gap-2 text-sm">{questions.dictation.map((w, idx) => (<div key={idx} className="flex gap-2"><span className="text-gray-500">{w.pinyin}:</span><span className="font-bold text-primary">{w.word}</span></div>))}</div></div>
             )}
             {questions.poemFill.length > 0 && (
              <div className="mb-6"><h3 className="font-bold text-md mb-2 bg-gray-100 p-1">3. 古诗文默写</h3><ul className="list-disc pl-5 text-sm space-y-1">{questions.poemFill.map((w, idx) => (<li key={idx}><span className="font-bold mr-2">{w.word}:</span>{w.poemData?.fillAnswers.map(f => f.answer).join(' / ')}</li>))}</ul></div>
             )}
             {questions.definitionMatch.length > 0 && (
              <div className="mb-6"><h3 className="font-bold text-md mb-2 bg-gray-100 p-1">4. 字词辨析答案</h3>
                <div className="space-y-2 text-sm">
                  {questions.definitionMatch.map((w, idx) => {
                    const m = w.definitionMatchData!;
                    let ansStr = "";
                    if (m.mode === MatchMode.TWO_WAY_COMPARE) ansStr = m.isSame ? "A (相同)" : "B (不同)";
                    else ansStr = `${String.fromCharCode(65 + (m.correctIndex || 0))} (${m.options?.[m.correctIndex || 0]})`;
                    return (
                      <div key={idx} className="flex gap-2">
                        <span className="font-bold">{idx+1}.</span>
                        <span>{ansStr}</span>
                      </div>
                    );
                  })}
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
