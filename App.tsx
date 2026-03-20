import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FileText, Settings, Database, Download, Upload, Trash2, Key, Save, Loader2, CheckCircle, AlertCircle, Globe, Info, GraduationCap, User, LogOut } from 'lucide-react';
import WordEntryForm from './components/WordEntryForm';
import WordList from './components/WordList';
import ExamGenerator from './components/ExamGenerator';
import ReviewFlashcards from './components/ReviewFlashcards';
import LoginModal from './components/LoginModal';
import { WordEntry, EntryType, TestStatus } from './types';

enum View {
  HOME = 'HOME',
  EXAM = 'EXAM',
  REVIEW = 'REVIEW',
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [words, setWords] = useState<WordEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [hasPaidKey, setHasPaidKey] = useState(false);
  const [isAiStudioEnv, setIsAiStudioEnv] = useState(false);
  const [isKeyActionLoading, setIsKeyActionLoading] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; name?: string } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 检查环境与密钥状态 ---
  const checkEnvironment = async () => {
    const isEnv = !!(window.aistudio && typeof window.aistudio.openSelectKey === 'function');
    setIsAiStudioEnv(isEnv);
    
    if (isEnv && window.aistudio) {
      try {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasPaidKey(hasKey);
      } catch (e) {
        console.warn("Failed to check API key status");
      }
    }
  };

  const handleSelectKey = async () => {
    if (isAiStudioEnv && window.aistudio) {
      try {
        setIsKeyActionLoading(true);
        await window.aistudio.openSelectKey();
        setHasPaidKey(true);
        alert("请在弹出的官方对话框中选择您的付费项目密钥。");
      } catch (err) {
        console.error("Failed to open key selector", err);
      } finally {
        setIsKeyActionLoading(false);
      }
    }
  };

  const handleLoginSuccess = (userData: { id: string; email: string; name?: string }, token: string) => {
    // Handled by onAuthStateChanged
  };

  const handleLogout = async () => {
    const { logout } = await import('./firebase');
    await logout();
  };

  useEffect(() => {
    let unsubscribeSnapshot: () => void;
    
    const initFirebase = async () => {
      const { auth, db } = await import('./firebase');
      const { onAuthStateChanged } = await import('firebase/auth');
      const { collection, query, where, onSnapshot, orderBy } = await import('firebase/firestore');
      
      onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({ id: firebaseUser.uid, email: firebaseUser.email || '', name: firebaseUser.displayName || '' });
          
          // Set up Firestore listener
          const q = query(
            collection(db, 'words'),
            where('userId', '==', firebaseUser.uid),
            orderBy('createdAt', 'desc')
          );
          
          setIsLoading(true);
          unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
            const fetchedWords: WordEntry[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              fetchedWords.push({
                ...data,
                id: doc.id,
                definitionData: data.definitionData ? JSON.parse(data.definitionData) : undefined,
                definitionMatchData: data.definitionMatchData ? JSON.parse(data.definitionMatchData) : undefined,
                poemData: data.poemData ? JSON.parse(data.poemData) : undefined,
              } as WordEntry);
            });
            setWords(fetchedWords);
            setIsLoading(false);
          }, (error) => {
            console.error("Firestore Error: ", error);
            setIsLoading(false);
          });
        } else {
          setUser(null);
          setWords([]);
          setIsLoading(false);
          if (unsubscribeSnapshot) unsubscribeSnapshot();
        }
      });
    };
    
    initFirebase();
    
    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const handleAddWord = async (entry: WordEntry) => {
    if (!user) return alert("请先登录");
    const newEntry = { ...entry, testStatus: TestStatus.UNTESTED, passedAfterRetries: false };
    // Optimistic update
    setWords(prev => [newEntry, ...prev]);
    
    try {
      const { db } = await import('./firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const firestoreData = {
        ...newEntry,
        userId: user.id,
        definitionData: newEntry.definitionData ? JSON.stringify(newEntry.definitionData) : null,
        definitionMatchData: newEntry.definitionMatchData ? JSON.stringify(newEntry.definitionMatchData) : null,
        poemData: newEntry.poemData ? JSON.stringify(newEntry.poemData) : null,
      };
      await setDoc(doc(db, 'words', newEntry.id), firestoreData);
    } catch (e) {
      console.error("Add error", e);
      alert("添加失败，请重试");
    }
  };

  const handleDeleteWord = async (id: string) => {
    if (!user) return;
    try {
      const { db } = await import('./firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'words', id));
    } catch (e) {
      console.error("Delete error", e);
    }
  };

  const handleUpdateWord = async (id: string, updates: Partial<WordEntry>) => {
    if (!user) return;
    try {
      const { db } = await import('./firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      const firestoreUpdates: any = { ...updates };
      if (updates.definitionData !== undefined) firestoreUpdates.definitionData = updates.definitionData ? JSON.stringify(updates.definitionData) : null;
      if (updates.definitionMatchData !== undefined) firestoreUpdates.definitionMatchData = updates.definitionMatchData ? JSON.stringify(updates.definitionMatchData) : null;
      if (updates.poemData !== undefined) firestoreUpdates.poemData = updates.poemData ? JSON.stringify(updates.poemData) : null;
      
      await updateDoc(doc(db, 'words', id), firestoreUpdates);
    } catch (e) {
      console.error("Update error", e);
    }
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
    if (!file || !user) return;
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
            
            try {
              const { db } = await import('./firebase');
              const { doc, writeBatch } = await import('firebase/firestore');
              const batch = writeBatch(db);
              
              newWords.forEach(w => {
                const firestoreData = {
                  ...w,
                  userId: user.id,
                  definitionData: w.definitionData ? JSON.stringify(w.definitionData) : null,
                  definitionMatchData: w.definitionMatchData ? JSON.stringify(w.definitionMatchData) : null,
                  poemData: w.poemData ? JSON.stringify(w.poemData) : null,
                };
                batch.set(doc(db, 'words', w.id), firestoreData);
              });
              
              await batch.commit();
              alert(`成功导入 ${newWords.length} 个新词语！`);
            } catch (e) {
              console.error("Import error", e);
              alert("导入失败，请重试");
            }
          }
        } else alert("文件格式不正确");
      } catch (err) { alert("无法解析文件"); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAll = async () => {
    if (!user) return;
    if (confirm("确定要清空所有题库数据吗？\n此操作将删除数据库及本地所有记录，且不可恢复！")) {
      if (confirm("再次确认：您确定要删除所有数据吗？")) {
         try {
           const { db } = await import('./firebase');
           const { doc, writeBatch } = await import('firebase/firestore');
           const batch = writeBatch(db);
           
           words.forEach(w => {
             batch.delete(doc(db, 'words', w.id));
           });
           
           await batch.commit();
           alert("题库已清空");
         } catch (e) {
           console.error("Clear all error", e);
           alert("清空失败，请重试");
         }
      }
    }
  };

  useEffect(() => {
    checkEnvironment();
    // 轮询检查一次，防止 aistudio 对象注入延迟
    const timer = setTimeout(checkEnvironment, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (currentView === View.EXAM) {
    return <ExamGenerator words={words} onBack={() => setCurrentView(View.HOME)} />;
  }

  if (currentView === View.REVIEW) {
    return <ReviewFlashcards words={words} onBack={() => setCurrentView(View.HOME)} onUpdate={handleUpdateWord} />;
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
            {user ? (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-gray-600 hidden sm:inline">{user.name || user.email}</span>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-800"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">登录 / 注册</span>
              </button>
            )}

             <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
             >
               <Settings className="w-5 h-5" />
             </button>
             
            <button 
              onClick={() => setCurrentView(View.REVIEW)}
              disabled={isLoading || words.length === 0}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            >
              <GraduationCap className="w-4 h-4 text-secondary" />
              <span className="hidden sm:inline">复习闪卡</span>
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
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">运行环境:</span>
                    {isAiStudioEnv ? (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" /> AI Studio 预览
                      </span>
                    ) : (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold flex items-center">
                        <Globe className="w-3 h-3 mr-1" /> 独立域名部署
                      </span>
                    )}
                  </div>

                  {isAiStudioEnv ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-600">密钥状态:</span>
                        {hasPaidKey ? (
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center">已接入付费项目</span>
                        ) : (
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold flex items-center">免费/限制模式</span>
                        )}
                      </div>
                      <button 
                        onClick={handleSelectKey}
                        disabled={isKeyActionLoading}
                        className="w-full py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isKeyActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4 text-primary" />}
                        切换付费密钥
                      </button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-white border border-gray-200 rounded-lg">
                        <p className="text-[11px] text-gray-500 leading-relaxed mb-2 flex items-start">
                          <Info className="w-3 h-3 mr-1.5 mt-0.5 shrink-0 text-primary" />
                          当前在独立域名运行，无法直接弹出密钥选择器。
                        </p>
                        <p className="text-[11px] text-gray-700 font-medium">若需提升分析成功率：</p>
                        <ol className="text-[10px] text-gray-500 list-decimal pl-4 mt-1 space-y-1">
                          <li>前往您的 Vercel/托管平台设置页</li>
                          <li>在 <code className="bg-gray-100 px-1">Environment Variables</code> 中添加 <code className="bg-gray-100 px-1 text-primary">API_KEY</code></li>
                          <li>填入您的付费项目密钥并重新部署</li>
                        </ol>
                      </div>
                    </div>
                  )}
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[10px] text-primary hover:underline mt-3 block text-center">查看 Google API 计费说明</a>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                  <Database className="w-4 h-4 mr-2" /> 数据管理
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700 font-bold"><Download className="w-4 h-4" /> 导出备份</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700 font-bold"><Upload className="w-4 h-4" /> 导入数据</button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
                </div>
                <button onClick={handleClearAll} className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded text-sm hover:bg-red-100 text-red-600 font-bold transition-colors"><Trash2 className="w-4 h-4" /> 清空题库</button>
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

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLoginSuccess={handleLoginSuccess} 
      />
    </div>
  );
};

export default App;