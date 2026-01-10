import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FileText, Settings, Database, Download, Upload, Trash2, Key, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import WordEntryForm from './components/WordEntryForm';
import WordList from './components/WordList';
import ExamGenerator from './components/ExamGenerator';
import { WordEntry, EntryType, TestStatus } from './types';

enum View {
  HOME = 'HOME',
  EXAM = 'EXAM',
}

// Fix: Augment existing global AIStudio interface and properly type window.aistudio to resolve identical modifier and type mismatch errors
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [hasPaidKey, setHasPaidKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- API Functions ---
  
  const checkApiKey = async () => {
    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPaidKey(hasKey);
      }
    } catch (e) {
      console.warn("API Key check not available");
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume the key selection was successful after triggering openSelectKey() as per instructions to mitigate race conditions
      setHasPaidKey(true);
      setShowSettings(false);
      alert("API 密钥已更新，分析频率限制已放宽。");
    }
  };

  const fetchWords = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/words');
      if (res.ok) {
        const data = await res.json();
        setWords(data);
      } else {
        const saved = localStorage.getItem('yuwen_words');
        if (saved) setWords(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Fetch error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const addWordToBackend = async (entry: WordEntry) => {
    try {
      await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (e) { console.error("Add error", e); }
  };

  const updateWordInBackend = async (id: string, updates: Partial<WordEntry>) => {
    try {
      await fetch('/api/words', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates })
      });
    } catch (e) { console.error("Update error", e); }
  };

  const deleteWordFromBackend = async (id: string) => {
    try {
      await fetch(`/api/words?id=${id}`, { method: 'DELETE' });
    } catch (e) { console.error("Delete error", e); }
  };

  useEffect(() => {
    fetchWords();
    checkApiKey();
  }, []);

  useEffect(() => {
    if (!isLoading && words.length > 0) {
      localStorage.setItem('yuwen_words', JSON.stringify(words));
    }
  }, [words, isLoading]);

  const handleAddWord = (entry: WordEntry) => {
    const newEntry = {
      ...entry,
      testStatus: TestStatus.UNTESTED,
      passedAfterRetries: false
    };
    setWords(prev => [newEntry, ...prev]);
    addWordToBackend(newEntry);
  };

  const handleDeleteWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id));
    deleteWordFromBackend(id);
  };

  const handleUpdateWord = (id: string, updates: Partial<WordEntry>) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    updateWordInBackend(id, updates);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(words, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `语文错题本备份_${new Date().toLocaleDateString('zh-CN')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          if (confirm(`确定要导入 ${json.length} 条数据吗？`)) {
            const currentIds = new Set(words.map(w => w.id));
            const newWords = json
              .filter((w: any) => !currentIds.has(w.id))
              .map((w: any) => ({ 
                ...w, 
                type: w.type || EntryType.WORD,
                testStatus: w.testStatus || TestStatus.UNTESTED,
                passedAfterRetries: w.passedAfterRetries || false
              }));
            setWords(prev => [...newWords, ...prev]);
            for (const w of newWords) await addWordToBackend(w);
            alert(`成功导入 ${newWords.length} 个新词语！`);
          }
        } else alert("文件格式不正确");
      } catch (err) { alert("无法解析文件"); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (currentView === View.EXAM) {
    return <ExamGenerator words={words} onBack={() => setCurrentView(View.HOME)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold text-xl">
            <BookOpen className="w-6 h-6" />
            <span className="hidden sm:inline">语文错题助手</span>
            <span className="sm:hidden">错题助手</span>
          </div>
          
          <div className="flex items-center gap-3">
             <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
             >
               <Settings className="w-5 h-5" />
             </button>
            <button 
              onClick={() => setCurrentView(View.EXAM)}
              disabled={isLoading || words.length === 0}
              className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">生成试卷</span>
              <span className="sm:hidden">试卷</span>
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="bg-white border-b border-gray-200 shadow-sm animate-in slide-in-from-top-2 duration-200 p-4">
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                  <Key className="w-4 h-4 mr-2" /> AI 接口状态
                </h3>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">当前密钥类型:</span>
                    {hasPaidKey ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" /> 高级付费 (无限制)
                      </span>
                    ) : (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" /> 免费预览 (有限制)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mb-3">如果您遇到“服务器忙”报错，建议选择一个开了账单的 GCP 项目密钥。</p>
                  <button 
                    onClick={handleSelectKey}
                    className="w-full py-2 bg-white border border-gray-200 rounded-md text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Key className="w-4 h-4 text-primary" /> 更换/选择付费密钥
                  </button>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] text-primary hover:underline mt-2 block text-center">了解计费说明</a>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                  <Database className="w-4 h-4 mr-2" /> 数据管理
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700 font-bold"><Download className="w-4 h-4" /> 备份</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700 font-bold"><Upload className="w-4 h-4" /> 导入</button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
                <button onClick={() => { if(confirm("清空前请确认已备份！")) { setWords([]); localStorage.removeItem('yuwen_words'); }}} className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded text-sm hover:bg-red-100 text-red-600 font-bold transition-colors"><Trash2 className="w-4 h-4" /> 清空本地题库</button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <section><WordEntryForm onAddWord={handleAddWord} /></section>
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center"><Database className="w-5 h-5 mr-2 text-gray-500" /> 题库列表</h2>
            <div className="flex items-center gap-2">
               {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
               <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">共 {words.length} 个词</span>
            </div>
          </div>
          <WordList words={words} onDelete={handleDeleteWord} onUpdate={handleUpdateWord} />
        </section>
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-400 mt-auto">
        <p>© 2025 语文错题助手 - 智能学习伴侣</p>
      </footer>
    </div>
  );
};

export default App;