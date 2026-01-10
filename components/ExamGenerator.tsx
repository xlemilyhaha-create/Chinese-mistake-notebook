import React, { useState, useMemo } from 'react';
import { WordEntry, QuestionType, MatchMode } from '../types';
import { Printer, ArrowLeft, Filter, Download, Copy, FileJson, Check } from 'lucide-react';

interface ExamGeneratorProps {
  words: WordEntry[];
  onBack: () => void;
}

const ExamGenerator: React.FC<ExamGeneratorProps> = ({ words, onBack }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  const availableDates = useMemo(() => {
    const dates = new Set(words.map(w => new Date(w.createdAt).toLocaleDateString('zh-CN')));
    return Array.from(dates).sort().reverse();
  }, [words]);

  const filteredWords = useMemo(() => {
    return words.filter(w => !selectedDate || new Date(w.createdAt).toLocaleDateString('zh-CN') === selectedDate);
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
      if (w.enabledTypes.includes(QuestionType.DEFINITION_MATCH) && w.definitionMatchData?.targetChar) qs.definitionMatch.push(w);
      if (w.enabledTypes.includes(QuestionType.POEM_FILL) && w.poemData?.fillAnswers.length) qs.poemFill.push(w);
      if (w.enabledTypes.includes(QuestionType.POEM_DEFINITION) && w.poemData?.definitionQuestions.length) qs.poemDef.push(w);
    });
    return qs;
  }, [filteredWords]);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      try { window.print(); } catch (e) { alert("调用打印失败"); } finally { setIsPrinting(false); }
    }, 500);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(filteredWords, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `试卷数据_${selectedDate || '全集'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = async () => {
    let text = `语文错题专项强化练习卷\n日期: ${selectedDate || '全集'}\n\n`;
    if (questions.pinyin.length > 0) {
      text += "一、看汉字写拼音\n";
      questions.pinyin.forEach((w, i) => text += `${i+1}. ${w.word} (      )\n`);
      text += "\n";
    }
    if (questions.dictation.length > 0) {
      text += "二、看拼音写词语\n";
      questions.dictation.forEach((w, i) => text += `${i+1}. ${w.pinyin} (      )\n`);
      text += "\n";
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      alert("复制失败");
    }
  };

  const renderPinyinBoxes = (entry: WordEntry) => {
    const chars = entry.word.split('');
    const pinyinParts = entry.pinyin.trim().split(/\s+/);
    const isAligned = chars.length === pinyinParts.length;
    return (
      <div className="flex gap-1 justify-center">
        {chars.map((char, idx) => (
          <div key={idx} className="flex flex-col items-center">
             <div className="h-6 flex items-end justify-center w-12 text-center">
               <span className="text-[10px] text-gray-400 font-sans leading-none">{isAligned ? pinyinParts[idx] : (idx === 0 ? entry.pinyin : '')}</span>
             </div>
             <div className="w-12 h-12 border border-black relative bg-white">
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
            <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center font-bold transition-colors"><ArrowLeft className="w-5 h-5 mr-1" /> 返回</button>
            <div className="flex gap-2">
                <button onClick={handleCopyText} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all shadow-sm active:scale-95">
                  {copySuccess ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                  复制文本
                </button>
                <button onClick={handleExportJson} className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all shadow-sm active:scale-95">
                  <FileJson className="w-4 h-4 mr-2 text-orange-500" /> 导出数据
                </button>
                <button onClick={handlePrint} disabled={isPrinting || filteredWords.length === 0} className="bg-primary hover:bg-indigo-700 text-white px-5 py-2 rounded-lg shadow-md flex items-center font-bold transition-all active:scale-95">
                  <Printer className="w-5 h-5 mr-2" /> 打印试卷 (A4)
                </button>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-6 bg-gray-50 p-2 rounded border border-gray-100">
            <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-gray-400" /><span className="text-sm font-bold text-gray-700">筛选范围:</span></div>
            <select className="border rounded px-2 py-1 text-sm bg-white min-w-[120px]" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
                <option value="">全部错题 ({words.length})</option>
                {availableDates.map(date => (<option key={date} value={date}>{date}</option>))}
            </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
        <div id="printable-root" className="relative">
          <div className="page-footer hidden print:block"></div>

          {/* 试卷主页 */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[20mm] box-border relative mb-8 text-black">
            <div className="text-center border-b-2 border-black pb-4 mb-8">
              <h1 className="text-2xl font-bold font-serif tracking-[0.2em] mb-2">语文错题专项强化练习卷</h1>
              <div className="flex justify-between text-sm font-kai px-12 mt-4">
                <span>姓名: <span className="inline-block border-b border-black w-32"></span></span>
                <span>日期: <span className="inline-block border-b border-black w-32">{selectedDate || '   月   日'}</span></span>
                <span>得分: <span className="inline-block border-b border-black w-24"></span></span>
              </div>
            </div>

            {questions.pinyin.length > 0 && (
              <div className="mb-10">
                <h2 className="text-lg font-bold mb-6 font-kai flex items-center border-l-4 border-black pl-3">一、看汉字，写拼音</h2>
                <div className="flex flex-wrap gap-x-12 gap-y-10 pl-4">
                  {questions.pinyin.map((w, idx) => (
                    <div key={idx} className="flex flex-col items-center w-[80px]">
                      <div className="w-full h-8 border-b-2 border-black mb-2"></div>
                      <div className="font-serif text-xl font-bold">{w.word}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.dictation.length > 0 && (
               <div className="mb-10">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center border-l-4 border-black pl-3">二、看拼音，写词语</h2>
               <div className="flex flex-wrap gap-x-8 gap-y-12 pl-4">
                 {questions.dictation.map((w, idx) => (
                   <div key={idx} className="question-item">{renderPinyinBoxes(w)}</div>
                 ))}
               </div>
             </div>
            )}

            {questions.poemFill.length > 0 && (
              <div className="mb-10">
                <h2 className="text-lg font-bold mb-6 font-kai flex items-center border-l-4 border-black pl-3">三、古诗文默写</h2>
                <div className="space-y-10 pl-4 mt-4">
                  {questions.poemFill.map((w, idx) => {
                    const uniqueLines = Array.from(new Map(
                      (w.poemData?.fillAnswers || []).map(f => [f.pre + f.answer + f.post, f])
                    ).values()) as any[];

                    return (
                      <div key={idx} className="question-item">
                        <div className="text-base font-bold text-gray-600 mb-4 font-kai">《{w.word}》：</div>
                        <div className="space-y-8 border-l-2 border-gray-100 pl-6">
                          {uniqueLines.map((fill, fIdx) => (
                             <div key={fIdx} className="font-serif text-xl leading-[2.5]">
                               {fill.pre}
                               <span className="inline-block border-b-2 border-black min-w-[240px] mx-2 text-transparent select-none">此处填空内容</span>
                               {fill.post}
                             </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {questions.definition.length > 0 && (
              <div className="mb-10">
                <h2 className="text-lg font-bold mb-6 font-kai flex items-center border-l-4 border-black pl-3">四、词语释义选择</h2>
                <div className="space-y-6 pl-4">
                  {questions.definition.map((w, idx) => (
                    <div key={idx} className="question-item">
                      <div className="font-serif text-base mb-2 leading-relaxed">
                        {idx + 1}. “<span className="font-bold underline underline-offset-4">{w.word}</span>”中“<span className="font-bold text-lg">{w.definitionData?.targetChar}</span>”的意思是：（ &nbsp; ）
                      </div>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-6 text-sm font-kai">
                        {w.definitionData?.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex"><span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.definitionMatch.length > 0 && (
               <div className="mb-10">
               <h2 className="text-lg font-bold mb-6 font-kai flex items-center border-l-4 border-black pl-3">五、字词深度辨析</h2>
               <div className="space-y-8 pl-4">
                 {questions.definitionMatch.map((w, idx) => {
                   const m = w.definitionMatchData!;
                   
                   // 根据模式渲染不同的题干和内容
                   if (m.mode === MatchMode.TWO_WAY_COMPARE) {
                     return (
                        <div key={idx} className="question-item text-base">
                          <div className="flex items-center justify-between border-2 border-gray-100 rounded-lg p-4">
                            <div className="font-serif">{idx + 1}. 判断“<span className="font-bold">{m.targetChar}</span>”在下列词语中意思是否相同：</div>
                            <div className="flex gap-8 font-serif font-bold text-lg items-center">
                               <span className="border-b-2 border-black px-2">{m.compareWordA}</span> 
                               <span className="text-gray-300">vs</span>
                               <span className="border-b-2 border-black px-2">{m.compareWordB}</span>
                               <span className="ml-4 text-sm text-gray-400 font-sans border border-gray-300 px-2 rounded">（ &nbsp; ）</span>
                            </div>
                          </div>
                        </div>
                     );
                   } else if (m.mode === MatchMode.SYNONYM_CHOICE) {
                     return (
                        <div key={idx} className="question-item space-y-3">
                           <div className="font-serif text-base leading-relaxed">
                              {idx + 1}. 选出最恰当的词语填入括号内：<br/>
                              “<span className="font-sans italic">{m.context || '... ( ) ...'}</span>”
                           </div>
                           <div className="grid grid-cols-2 gap-4 pl-6 text-sm font-kai">
                              {m.options?.slice(0, 4).map((opt, oIdx) => (
                                <div key={oIdx} className="flex"><span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                              ))}
                           </div>
                        </div>
                     );
                   } else {
                     // 默认为 SAME_AS_TARGET
                     return (
                        <div key={idx} className="question-item space-y-3">
                          <div className="font-serif text-base leading-relaxed">
                            {idx + 1}. 与“<span className="font-bold underline underline-offset-4">{m.context || w.word}</span>”中“<span className="font-bold text-lg">{m.targetChar}</span>”意思相同的一项是：（ &nbsp; ）
                          </div>
                          <div className="grid grid-cols-2 gap-4 pl-6 text-sm font-kai">
                            {m.options?.slice(0, 4).map((opt, oIdx) => (
                              <div key={oIdx} className="flex"><span className="mr-2 font-bold">{String.fromCharCode(65 + oIdx)}.</span><span>{opt}</span></div>
                            ))}
                          </div>
                        </div>
                     );
                   }
                 })}
               </div>
             </div>
            )}
          </div>

          <div className="print-break-before"></div>

          {/* 答案页 */}
          <div className="bg-white shadow-lg w-[210mm] min-h-[297mm] mx-auto p-[20mm] box-border relative text-black">
            <div className="text-center border-b-2 border-black pb-4 mb-10">
              <h1 className="text-xl font-bold font-serif tracking-widest">参考答案与解析</h1>
            </div>
            
            <div className="space-y-10">
                <div className="grid grid-cols-2 gap-12">
                  {questions.pinyin.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-bold text-base mb-4 bg-gray-50 p-2">1. 看汉字写拼音</h3>
                      <div className="space-y-2 text-sm">{questions.pinyin.map((w, i) => (<div key={i} className="flex justify-between border-b border-dashed"><span>{w.word}</span><span className="font-bold text-primary">{w.pinyin}</span></div>))}</div>
                    </div>
                  )}
                  {questions.dictation.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="font-bold text-base mb-4 bg-gray-50 p-2">2. 看拼音写词语</h3>
                      <div className="space-y-2 text-sm">{questions.dictation.map((w, i) => (<div key={i} className="flex justify-between border-b border-dashed"><span>{w.pinyin}</span><span className="font-bold text-primary">{w.word}</span></div>))}</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-12">
                    {questions.definition.length > 0 && (
                      <div className="border-t pt-4">
                        <h3 className="font-bold text-base mb-4 bg-gray-50 p-2">4. 词语释义答案</h3>
                        <div className="grid grid-cols-4 gap-4 text-sm font-bold">
                          {questions.definition.map((w, i) => (<div key={i}>{i+1}. {String.fromCharCode(65 + (w.definitionData?.correctIndex || 0))}</div>))}
                        </div>
                      </div>
                    )}
                    {questions.definitionMatch.length > 0 && (
                      <div className="border-t pt-4">
                        <h3 className="font-bold text-base mb-4 bg-gray-50 p-2">5. 字词辨析答案</h3>
                        <div className="grid grid-cols-4 gap-4 text-sm font-bold">
                          {questions.definitionMatch.map((w, i) => {
                            const m = w.definitionMatchData!;
                            const ans = m.mode === MatchMode.TWO_WAY_COMPARE ? (m.isSame ? '相同' : '不同') : String.fromCharCode(65 + (m.correctIndex || 0));
                            return <div key={i}>{i+1}. {ans}</div>;
                          })}
                        </div>
                      </div>
                    )}
                </div>

                {questions.poemFill.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="font-bold text-base mb-4 bg-gray-50 p-2">3. 古诗默写答案</h3>
                    <div className="space-y-4 text-sm">
                      {questions.poemFill.map((w, i) => (
                        <div key={i} className="flex gap-4">
                          <span className="font-bold shrink-0">《{w.word}》</span>
                          <span className="font-serif">{(w.poemData?.fillAnswers as any[] || []).map(f => f.answer).join(' / ')}</span>
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