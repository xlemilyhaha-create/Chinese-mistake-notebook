
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FileText, Settings, Database, Download, Upload, Trash2, AlertCircle, Save, Loader2 } from 'lucide-react';
import WordEntryForm from './components/WordEntryForm';
import WordList from './components/WordList';
import ExamGenerator from './components/ExamGenerator';
import { WordEntry, EntryType, TestStatus } from './types';

enum View {
  HOME = 'HOME',
  EXAM = 'EXAM',
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- API Functions ---
  
  const fetchWords = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/words');
      if (res.ok) {
        const data = await res.json();
        setWords(data);
      } else {
        // Fallback to local storage if API fails (e.g., in development without MySQL)
        console.warn("API failed, checking local storage...");
        const saved = localStorage.getItem('yuwen_words');
        if (saved) {
           setWords(JSON.parse(saved));
        }
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
  }, []);

  // Sync to LocalStorage as a backup (Optional, but good for hybrid approach)
  useEffect(() => {
    if (!isLoading && words.length > 0) {
      localStorage.setItem('yuwen_words', JSON.stringify(words));
    }
  }, [words, isLoading]);


  const handleAddWord = (entry: WordEntry) => {
    // Add default status values
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
    // Calculate new logic if status is changing
    // Logic handles transitions:
    // Untested -> Passed (Easy)
    // Failed -> Passed (Hard)
    // The component might calculate this, but we can double check here or just trust the component's intent.
    // WordList component handles the logic for 'passedAfterRetries' before calling this.
    
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
            
            // Optimistic update
            setWords(prev => [...newWords, ...prev]);
            
            // Bulk insert to backend (sequentially to avoid race conditions/overload)
            for (const w of newWords) {
              await addWordToBackend(w);
            }
            
            alert(`成功导入 ${newWords.length} 个新词语！`);
          }
        } else {
          alert("文件格式不正确");
        }
      } catch (err) {
        alert("无法解析文件，请确保是正确的备份文件");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAll = async () => {
    if (confirm("确定要清空所有数据吗？此操作无法撤销！建议先导出备份。")) {
      // In a real app we would call a 'clear' endpoint, here we delete one by one or just wipe local
      // Since MySQL truncate is dangerous, we just loop delete from state and UI
      // But for bulk, we should probably have an endpoint. For now, just clear local state.
      // Implementing bulk delete is out of scope for this snippet, assuming manual clear.
      alert("请注意：后台数据暂不支持一键清空，请手动删除或联系管理员重置数据库。本地视图已清空。");
      setWords([]);
      localStorage.removeItem('yuwen_words');
    }
  };

  if (currentView === View.EXAM) {
    return (
      <ExamGenerator 
        words={words} 
        onBack={() => setCurrentView(View.HOME)} 
      />
    );
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
              title="设置"
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
            <div className="max-w-5xl mx-auto space-y-6">
              
              {/* Data Management Only */}
              <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                  <Database className="w-4 h-4 mr-2" /> 数据管理 (MySQL)
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700"
                  >
                    <Download className="w-4 h-4" /> 备份数据
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700"
                  >
                    <Upload className="w-4 h-4" /> 导入/恢复
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                  <button 
                    onClick={handleClearAll}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-sm hover:bg-red-100 text-red-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" /> 清空题库
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <section>
          <WordEntryForm onAddWord={handleAddWord} />
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <Database className="w-5 h-5 mr-2 text-gray-500" />
              题库列表
            </h2>
            <div className="flex items-center gap-2">
               {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
               <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                 共 {words.length} 个词
               </span>
            </div>
          </div>
          <WordList 
            words={words} 
            onDelete={handleDeleteWord} 
            onUpdate={handleUpdateWord}
          />
        </section>

      </main>
      
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-400 mt-auto">
        <p>© 2025 语文错题助手 - Build Your Vocabulary</p>
      </footer>
    </div>
  );
};

export default App;
