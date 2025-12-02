
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FileText, Settings, Database, Download, Upload, Trash2, AlertCircle, Save } from 'lucide-react';
import WordEntryForm from './components/WordEntryForm';
import WordList from './components/WordList';
import ExamGenerator from './components/ExamGenerator';
import { WordEntry, EntryType, AIProvider, AISettings } from './types';

enum View {
  HOME = 'HOME',
  EXAM = 'EXAM',
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings State
  const [aiSettings, setAiSettings] = useState<AISettings>({ provider: AIProvider.GEMINI });
  const [tempDeepseekKey, setTempDeepseekKey] = useState('');

  useEffect(() => {
    // Load Words
    const saved = localStorage.getItem('yuwen_words');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((w: any) => ({
          ...w,
          type: w.type || EntryType.WORD
        }));
        setWords(migrated);
      } catch (e) { console.error("Failed to parse saved words"); }
    }

    // Load Settings
    const savedSettings = localStorage.getItem('yuwen_ai_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setAiSettings(parsed);
        if (parsed.deepseekKey) setTempDeepseekKey(parsed.deepseekKey);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('yuwen_words', JSON.stringify(words));
  }, [words]);

  const saveSettings = () => {
    const newSettings: AISettings = {
      ...aiSettings,
      deepseekKey: tempDeepseekKey
    };
    setAiSettings(newSettings);
    localStorage.setItem('yuwen_ai_settings', JSON.stringify(newSettings));
    alert("设置已保存！");
    setShowSettings(false);
  };

  const handleAddWord = (entry: WordEntry) => {
    setWords(prev => [entry, ...prev]);
  };

  const handleDeleteWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  const handleUpdateWord = (id: string, updates: Partial<WordEntry>) => {
    setWords(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
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
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          if (confirm(`确定要导入 ${json.length} 条数据吗？这将合并到当前题库。`)) {
            const currentIds = new Set(words.map(w => w.id));
            const newWords = json
              .filter((w: any) => !currentIds.has(w.id))
              .map((w: any) => ({ ...w, type: w.type || EntryType.WORD }));
              
            setWords(prev => [...newWords, ...prev]);
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

  const handleClearAll = () => {
    if (confirm("确定要清空所有数据吗？此操作无法撤销！建议先导出备份。")) {
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
              className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
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
              
              {/* AI Provider Settings */}
              <div className="border-b pb-4">
                <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                  <Settings className="w-4 h-4 mr-2" /> AI 模型服务设置
                </h3>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input 
                      type="radio" 
                      name="provider" 
                      checked={aiSettings.provider === AIProvider.GEMINI} 
                      onChange={() => setAiSettings({...aiSettings, provider: AIProvider.GEMINI})}
                    />
                    Google Gemini (默认)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input 
                      type="radio" 
                      name="provider" 
                      checked={aiSettings.provider === AIProvider.DEEPSEEK} 
                      onChange={() => setAiSettings({...aiSettings, provider: AIProvider.DEEPSEEK})}
                    />
                    DeepSeek (国内直连)
                  </label>
                </div>
                
                {aiSettings.provider === AIProvider.DEEPSEEK && (
                  <div className="mt-3">
                    <input 
                      type="password" 
                      placeholder="请输入 DeepSeek API Key (sk-...)" 
                      value={tempDeepseekKey}
                      onChange={(e) => setTempDeepseekKey(e.target.value)}
                      className="w-full md:w-1/2 border border-gray-300 rounded px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                    />
                    <p className="text-xs text-gray-400 mt-1">Key 保存在本地浏览器中，直接发送给 DeepSeek，不经过第三方服务器。</p>
                  </div>
                )}
                
                <div className="mt-3">
                  <button onClick={saveSettings} className="flex items-center bg-primary text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700">
                    <Save className="w-4 h-4 mr-1" /> 保存配置
                  </button>
                </div>
              </div>

              {/* Data Management */}
              <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                  <Database className="w-4 h-4 mr-2" /> 数据管理
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
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
              共 {words.length} 个词
            </span>
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
