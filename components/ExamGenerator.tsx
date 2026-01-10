import React, { useState, useMemo } from 'react';
import { WordEntry, QuestionType, TestStatus, MatchMode } from '../types';
import { Printer, ArrowLeft, Filter } from 'lucide-react';

interface ExamGeneratorProps {
  words: WordEntry[];
  onBack: () => void;
}

const ExamGenerator: React.FC<ExamGeneratorProps> = ({ words, onBack }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const availableDates = useMemo(() => {
    const dates = new Set(words.map(w => new Date(w.createdAt).toLocaleDateString('zh-CN')));
    return Array.from(dates).sort().reverse();
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter(w => {
      if (selectedDate && new Date(w.createdAt).toLocaleDateString('zh-CN') !== selectedDate) return false;
      return true;
    });
  }, [words, selectedDate]);

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
      // 只有当有题目数据时才加入列表
      if (w.enabledTypes.includes(QuestionType.POEM_FILL) && w.poemData && w.poemData.fillAnswers.length > 0) qs.poemFill.push(w);
      if (w.enabledTypes.includes(QuestionType.POEM_DEFINITION) && w.poemData && w.poemData.definitionQuestions.length > 0) qs.poemDef.push(w);
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
             <div className="h-5 flex items-end justify-center w-8 text-center">
               <span className="text-[10px] font-sans leading-none">{isAligned ? pinyinParts[idx] : (idx === 0 ? entry.pinyin : '')}</span>
             </div>
             <div className="w-8 h-8 border border-black relative bg-white">
                <div className="absolute inset-0 border-t border-dashed border-gray-300 top-1/2"></div>
                <div className="absolute inset-0 border-l border-dashed border-gray-300 left-1/2"></div>
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
            <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center font-bold"><ArrowLeft className="w-5 h-5 mr-1" /> 返回</button>
            <button onClick={handlePrint} disabled={isPrinting || filteredWords.length === 0} className="bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg shadow flex items-center font-bold disabled:opacity-50"><Printer className="w-5 h-5 mr-2" /> 打印练习卷</button>
        </div>
        <div className="flex flex-wrap items-center gap-6 bg-gray-50 p-2 rounded border border-gray-100">
            <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-gray-400" /><span className="text-sm font-bold text-gray-700">组卷日期:</span></div>
            <select className="border rounded px-2 py-1 text-sm bg-white min-w-[120px]" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}><option value="">所有错题</option>{availableDates.map(date => (<option key={date} value={date}>{date}</option>))}</select>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
        <div id="printable-root" className="relative">
          {/* 页码显示 */}
          <div className="page-footer hidden print:block"></div>

          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[12mm] box-border relative mb-8">
            <div className="text-center border-b border-black pb-2 mb-4 section-title">
              <h1 className="text-xl font-bold font-serif tracking-widest mb-1">语文错题专项强化练习卷</h1>
              <div className="flex justify-between text-[11px] font-kai px-4"><span>姓名: __________</span><span>日期: {selectedDate || new Date().toLocaleDateString('zh-CN')}</span><span>得分: __________</span></div>
            </div>

            {questions.pinyin.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold mb-3 font-kai flex items-center section-title"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2 font-sans">1</span>看汉字，写拼音</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-4">
                  {questions.pinyin.map((w, idx) => (<div key={idx} className="flex flex-col items-center question-item w-[calc(20%-1.5rem)]"><div className="w-full h-5 border-b border-gray-400"></div><div className="font-serif text-sm mt-1 text-center">{w.word}</div></div>))}
                </div>
              </div>
            )}

            {questions.dictation.length > 0 && (
               <div className="mb-4">
               <h2 className="text-sm font-bold mb-3 font-kai flex items-center section-title"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2 font-sans">2</span>看拼音，写词语</h2>
               <div className="flex flex-wrap gap-x-4 gap-y-6">
                 {questions.dictation.map((w, idx) => (
                   <div key={idx} className="question-item">{renderPinyinBoxes(w)}</div>
                 ))}
               </div>
             </div>
            )}

            {questions.poemFill.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold mb-3 font-kai flex items-center section-title"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2 font-sans">3</span>古诗文默写</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {questions.poemFill.map((w, idx) => (
                    <div key={idx} className="question-item border border-gray-50 p-1.5 rounded bg-gray-50/20">
                      <div className="text-[10px] font-bold text-gray-400 mb-0.5">《{w.word}》</div>
                      <div className="space-y-0.5">
                        {w.poemData?.fillAnswers.map((fill, fIdx) => (
                           <div key={fIdx} className="font-serif text-[11px]">{fill.pre}<span className="inline-block border-b border-black min-w-[40px] text-transparent select-none">{fill.answer}</span>{fill.post}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.definition.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold mb-3 font-kai flex items-center section-title"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2 font-sans">4</span>词语释义（选择题）</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {questions.definition.map((w, idx) => (
                    <div key={idx} className="question-item">
                      <div className="font-serif text-xs mb-1">
                        {idx + 1}. “<span className="font-bold underline">{w.word}</span>”中“<span className="font-bold">{w.definitionData?.targetChar}</span>”意为：（ &nbsp; ）
                      </div>
                      <div className="grid grid-cols-2 gap-0.5 pl-2 text-[10px] font-kai text-gray-700">
                        {w.definitionData?.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex truncate"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.definitionMatch.length > 0 && (
               <div className="mb-4">
               <h2 className="text-sm font-bold mb-3 font-kai flex items-center section-title"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2 font-sans">5</span>字词深度辨析</h2>
               <div className="space-y-2">
                 {questions.definitionMatch.map((w, idx) => {
                   const m = w.definitionMatchData!;
                   return (
                    <div key={idx} className="question-item text-xs">
                      {m.mode === MatchMode.SAME_AS_TARGET && (
                        <div className="grid grid-cols-[1fr_200px] gap-2">
                          <div className="font-serif">
                            {idx + 1}. “<span className="font-bold underline">{m.context || w.word}</span>”中“<span className="font-bold">{m.targetChar}</span>”意思相同的是：（ &nbsp; ）
                          </div>
                          <div className="grid grid-cols-2 text-[10px] font-kai items-center">
                            {m.options?.map((opt, oIdx) => (
                              <div key={oIdx} className="flex"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </div>
                      )}
                      {m.mode === MatchMode.TWO_WAY_COMPARE && (
                        <div className="flex items-center justify-between bg-gray-50/50 p-1 rounded">
                          <div className="font-serif italic text-gray-500">判断“<span className="font-bold text-black">{m.targetChar}</span>”意思是否相同：（ &nbsp; ）</div>
                          <div className="flex gap-4 font-serif items-center px-4">
                             <span className="border-b border-black font-bold">{m.compareWordA}</span>
                             <span className="text-gray-300">/</span>
                             <span className="border-b border-black font-bold">{m.compareWordB}</span>
                             <span className="ml-4 text-[10px] text-gray-400">A.相同 B.不同</span>
                          </div>
                        </div>
                      )}
                    </div>
                   );
                 })}
               </div>
             </div>
            )}

            {questions.poemDef.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold mb-3 font-kai flex items-center section-title"><span className="bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] mr-2 font-sans">6</span>古诗重点字释义（紧凑版）</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {questions.poemDef.map((w, idx) => (
                    <div key={idx} className="question-item">
                      {/* 标题与内容合并 */}
                      {w.poemData?.definitionQuestions.map((q, qIdx) => (
                        <div key={qIdx} className="mb-2">
                          <div className="font-serif text-[11px] leading-tight mb-1">
                             <span className="text-[9px] text-gray-400 mr-1 font-sans">《{w.word}》</span>
                             “{w.poemData?.lines[q.lineIndex]}”的“<span className="font-bold">{q.targetChar}</span>”意为：（ &nbsp; ）
                          </div>
                          <div className="grid grid-cols-2 gap-0.5 pl-3 text-[10px] font-kai text-gray-600">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex truncate"><span className="mr-1 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="print-break-before"></div>

          {/* 答案页同样紧凑 */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[12mm] box-border relative">
            <div className="text-center border-b border-black pb-2 mb-4 section-title">
              <h1 className="text-lg font-bold font-serif tracking-widest mb-1">参考答案</h1>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs font-sans">
                {questions.pinyin.length > 0 && (
                  <div className="col-span-1">
                    <h3 className="font-bold mb-1 border-b">1. 拼音</h3>
                    <div className="grid grid-cols-2 gap-1">{questions.pinyin.map((w, idx) => (<div key={idx}>{w.word}: {w.pinyin}</div>))}</div>
                  </div>
                )}
                {questions.dictation.length > 0 && (
                  <div className="col-span-1">
                    <h3 className="font-bold mb-1 border-b">2. 书写</h3>
                    <div className="grid grid-cols-2 gap-1">{questions.dictation.map((w, idx) => (<div key={idx}><span className="text-[9px] text-gray-400">{w.pinyin}:</span> {w.word}</div>))}</div>
                  </div>
                )}
                {questions.definition.length > 0 && (
                  <div className="col-span-1">
                    <h3 className="font-bold mb-1 border-b">4. 词语释义</h3>
                    <div className="grid grid-cols-4 gap-1">{questions.definition.map((w, idx) => (<div key={idx}>{idx+1}. {String.fromCharCode(65 + (w.definitionData?.correctIndex || 0))}</div>))}</div>
                  </div>
                )}
                {questions.poemDef.length > 0 && (
                  <div className="col-span-2">
                    <h3 className="font-bold mb-1 border-b">6. 古诗重点字释义答案</h3>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                      {questions.poemDef.map((w, idx) => (
                        <div key={idx} className="truncate">
                          《{w.word}》: {w.poemData?.definitionQuestions.map(q => String.fromCharCode(65 + q.correctIndex)).join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamGenerator;