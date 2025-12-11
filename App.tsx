
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FileText, Settings, Database, Download, Upload, Trash2, AlertCircle, Save, Loader2 } from 'lucide-react';
import WordEntryForm from './components/WordEntryForm';
import WordList from './components/WordList';
import ExamGenerator from './components/ExamGenerator';
import { WordEntry, EntryType, TestStatus, FilterOptions } from './types';
import { wordService } from './services/wordService';

enum View {
  HOME = 'HOME',
  EXAM = 'EXAM',
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterOptions>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始加载数据（筛选改为前端处理，不需要根据 filters 重新加载）
  useEffect(() => {
    loadWords();
  }, []); // 只在组件挂载时加载一次

  const loadWords = async () => {
    try {
      setLoading(true);
      // 加载所有数据，筛选由前端 WordList 组件处理
      const data = await wordService.getWords();
      setWords(data);
    } catch (error) {
      console.error('Failed to load words:', error);
      alert('加载数据失败，请检查网络连接和数据库配置');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async (entry: WordEntry) => {
    try {
      await wordService.createWord(entry);
      await loadWords(); // Reload to get latest data
    } catch (error) {
      console.error('Failed to add word:', error);
      alert('添加词条失败，请重试');
    }
  };

  const handleDeleteWord = async (id: string) => {
    try {
      await wordService.deleteWord(id);
      await loadWords(); // Reload to get latest data
    } catch (error) {
      console.error('Failed to delete word:', error);
      alert('删除词条失败，请重试');
    }
  };

  const handleUpdateWord = async (id: string, updates: Partial<WordEntry>) => {
    try {
      await wordService.updateWord(id, updates);
      await loadWords(); // Reload to get latest data
    } catch (error) {
      console.error('Failed to update word:', error);
      alert('更新词条失败，请重试');
    }
  };

  const handleBatchUpdateStatus = async (ids: string[], testStatus: TestStatus) => {
    try {
      await wordService.batchUpdateTestStatus(ids, testStatus);
      await loadWords(); // Reload to get latest data
    } catch (error) {
      console.error('Failed to batch update status:', error);
      alert('批量更新状态失败，请重试');
    }
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    // 筛选改为前端处理，不需要更新 App.tsx 的 filters 状态
    // 保留此函数以保持接口兼容性
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          if (confirm(`确定要导入 ${json.length} 条数据吗？这将合并到当前题库。`)) {
            const currentWords = await wordService.getWords();
            const currentIds = new Set(currentWords.map(w => w.id));
            const newWords = json
              .filter((w: any) => !currentIds.has(w.id))
              .map((w: any) => ({
                ...w,
                type: w.type || EntryType.WORD,
                testStatus: w.testStatus || TestStatus.NOT_TESTED,
                isMultipleAttempts: w.isMultipleAttempts || false
              }));

            // Import each word
            let successCount = 0;
            for (const word of newWords) {
              try {
                await wordService.createWord(word);
                successCount++;
              } catch (err) {
                console.error(`Failed to import word ${word.id}:`, err);
              }
            }

            await loadWords();
            alert(`成功导入 ${successCount} 个新词语！`);
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
      try {
        const allWords = await wordService.getWords();
        for (const word of allWords) {
          await wordService.deleteWord(word.id);
        }
        await loadWords();
        alert('已清空所有数据');
      } catch (error) {
        console.error('Failed to clear all:', error);
        alert('清空数据失败，请重试');
      }
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
              
              {/* Data Management Only */}
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-gray-600">加载中...</span>
          </div>
        ) : (
          <>
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
                onBatchUpdateStatus={handleBatchUpdateStatus}
                onFilterChange={handleFilterChange}
              />
            </section>
          </>
        )}
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-400 mt-auto">
        <p>© 2025 语文错题助手 - Build Your Vocabulary</p>
      </footer>
    </div>
  );
};

export default App;