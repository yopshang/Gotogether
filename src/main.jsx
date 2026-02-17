import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  getDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  MapPin, 
  Calendar, 
  Home, 
  Users, 
  Plus, 
  Trash2, 
  DollarSign, 
  Share2, 
  Plane, 
  LogOut,
  X,
  Clock,
  LayoutDashboard,
  ChevronRight,
  ExternalLink,
  Info,
  ArrowRight,
  Sparkles,
  Edit2,
  FileText,
  MessageCircle,
  RefreshCw
} from 'lucide-react';

// --- Firebase 配置 ---
// 支持多种配置方式：环境变量、全局变量或默认配置
let firebaseConfig;
try {
  // 优先使用 Vite 环境变量
  if (import.meta.env.VITE_FIREBASE_CONFIG) {
    firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
  } 
  // 其次使用全局变量（通过 window 或全局作用域）
  else if (typeof window !== 'undefined' && window.__firebase_config) {
    firebaseConfig = JSON.parse(window.__firebase_config);
  } 
  // 或者直接使用全局变量（如果已定义）
  else if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  }
  // 如果没有配置，使用默认示例配置（需要替换为实际配置）
  else {
    console.warn('Firebase 配置未找到，使用默认配置。请设置 VITE_FIREBASE_CONFIG 环境变量或 __firebase_config 全局变量。');
    firebaseConfig = {
      apiKey: "your-api-key",
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-project-id",
      storageBucket: "your-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "your-app-id"
    };
  }
} catch (error) {
  console.error('Firebase 配置解析失败:', error);
  throw new Error('Firebase 配置无效，请检查配置格式');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 获取 appId，支持多种方式
const appId = 
  import.meta.env.VITE_APP_ID || 
  (typeof window !== 'undefined' && window.__app_id) ||
  (typeof __app_id !== 'undefined' ? __app_id : 'travel-planner-pro');

// --- LINE Login 配置 ---
const LINE_CONFIG = {
  channelId: '2009107386', // 已更新為您的 Channel ID
  channelSecret: 'e8bfaf293a6891616371948957271f5f', // 請在此填入您的 Channel Secret
  redirectUri: window.location.origin + window.location.pathname,
};

export default function App() {
  const [user, setUser] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); 
  
  const [showModal, setShowModal] = useState(null); 
  const [detailItem, setDetailItem] = useState(null); 
  const [editingGeneric, setEditingGeneric] = useState(null);

  const getNowDate = () => new Date().toISOString().split('T')[0];
  const getNowTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState({ 
    splitWithIds: [], 
    amount: 0, 
    note: '', 
    date: getNowDate(), 
    startDate: getNowDate(), 
    time: getNowTime() 
  });

  // 1. 初始化 Firebase Auth 並處理 LINE 回傳的 Code
  useEffect(() => {
    const initApp = async () => {
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code && !auth.currentUser?.displayName) {
        setIsLoggingIn(true);
        await handleLineCallback(code);
        setIsLoggingIn(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        if (!auth.currentUser) {
          const initialAuthToken = 
            import.meta.env.VITE_INITIAL_AUTH_TOKEN ||
            (typeof window !== 'undefined' && window.__initial_auth_token) ||
            (typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null);
          
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        }
      }
    };
    initApp();
  }, []);

  // 2. LINE 登入跳轉邏輯
  const loginWithLine = () => {
    const state = Math.random().toString(36).substring(7);
    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${LINE_CONFIG.channelId}&redirect_uri=${encodeURIComponent(LINE_CONFIG.redirectUri)}&state=${state}&scope=profile%20openid`;
    window.location.href = lineAuthUrl;
  };

  // 3. 處理 LINE Callback
  const handleLineCallback = async (code) => {
    try {
      const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: LINE_CONFIG.redirectUri,
          client_id: LINE_CONFIG.channelId,
          client_secret: LINE_CONFIG.channelSecret,
        }),
      });
      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        const profileResponse = await fetch('https://api.line.me/v2/profile', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileResponse.json();

        if (auth.currentUser) {
          await updateProfile(auth.currentUser, {
            displayName: profile.displayName,
            photoURL: profile.pictureUrl
          });
          setUser({ ...auth.currentUser, displayName: profile.displayName, photoURL: profile.pictureUrl });
        }
      }
    } catch (err) {
      console.error("LINE Login Error:", err);
    }
  };

  // 4. 監聽專案數據
  useEffect(() => {
    if (!user || !currentProjectId) return;
    const projectRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', currentProjectId);
    const unsubscribe = onSnapshot(projectRef, (docSnap) => {
      if (docSnap.exists()) setProjectData(docSnap.data());
    });
    return () => unsubscribe();
  }, [user, currentProjectId]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!currentProjectId) return;
    const projectRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', currentProjectId);
    const itemId = Date.now().toString();
    
    const creatorInfo = { 
      createdBy: user.uid, 
      creatorName: user.displayName || "匿名旅伴",
      creatorPic: user.photoURL || ""
    };
    
    const baseEntry = { ...formData, ...creatorInfo, id: itemId };

    if (showModal === 'itinerary') {
      await updateDoc(projectRef, { itinerary: arrayUnion(baseEntry) });
    } else if (showModal === 'accommodation') {
      await updateDoc(projectRef, { accommodations: arrayUnion(baseEntry) });
    }
    
    setShowModal(null);
    setFormData({ splitWithIds: [], amount: 0, note: '', date: getNowDate(), startDate: getNowDate(), time: getNowTime() });
  };

  if (loading || isLoggingIn) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
      <p className="font-black text-gray-400">正在連接 LINE 帳號...</p>
    </div>
  );

  if (!user?.displayName) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-[3rem] shadow-2xl text-center p-10">
          {/* 飞机图标 - 圆形，蓝色背景，带旋转 */}
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto text-white shadow-xl mb-8 rotate-6">
            <Plane size={40} />
          </div>
          
          {/* 标题区域 */}
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-black text-gray-900">旅遊規劃平台</h1>
            <p className="text-gray-400 font-bold text-sm">同步您的行程與分帳明細</p>
          </div>
          
          {/* LINE 登录按钮 */}
          <button 
            onClick={loginWithLine} 
            className="w-full bg-[#06C755] text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:brightness-95 transition active:scale-95 mb-8"
          >
            <MessageCircle size={24} fill="currentColor"/> 
            <span>使用 LINE 登入</span>
          </button>
          
          {/* LINE ID */}
          <p className="text-[10px] text-gray-300 font-bold tracking-widest uppercase">LINE ID: 2009107386</p>
        </div>
      </div>
    );
  }

  if (!currentProjectId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl space-y-8">
          <div className="flex items-center gap-4 border-b pb-6">
            <img src={user.photoURL} className="w-12 h-12 rounded-full border-2 border-emerald-500" />
            <div><p className="text-[10px] font-black text-gray-400 uppercase">已登入</p><p className="font-black text-gray-800">{user.displayName}</p></div>
          </div>
          <div className="space-y-4">
            <input type="text" placeholder="建立新旅程標題..." className="w-full border-2 rounded-2xl px-5 py-4 outline-none font-bold" onKeyDown={async e => {
              if (e.key === 'Enter' && e.target.value) {
                const id = Math.random().toString(36).substring(2, 9).toUpperCase();
                await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id), {
                  id, name: e.target.value, members: [{ id: user.uid, name: user.displayName, pic: user.photoURL }],
                  itinerary: [], accommodations: [], expenses: [], createdAt: new Date().toISOString()
                });
                setCurrentProjectId(id);
              }
            }} />
            <div className="relative py-2 text-center text-[10px] font-black text-gray-300 uppercase">或輸入邀請碼加入</div>
            <input type="text" placeholder="旅程 ID..." className="w-full border-2 rounded-2xl px-5 py-4 outline-none uppercase font-mono tracking-widest text-center bg-gray-50" onKeyDown={async e => {
              if (e.key === 'Enter') {
                const id = e.target.value.toUpperCase();
                const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id));
                if (snap.exists()) {
                  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id), {
                    members: arrayUnion({ id: user.uid, name: user.displayName, pic: user.photoURL })
                  });
                  setCurrentProjectId(id);
                }
              }
            }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:pl-64 text-gray-800 font-sans">
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r hidden md:flex flex-col p-8 z-10">
        <div className="mb-10 space-y-6">
          <h2 className="text-2xl font-black text-blue-600 truncate">{projectData?.name}</h2>
          <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-2xl">
            <img src={user.photoURL} className="w-8 h-8 rounded-full border border-blue-200" />
            <p className="text-xs font-black truncate">{user.displayName}</p>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {['overview', 'itinerary', 'accommodation', 'members'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-5 py-4 rounded-2xl font-black transition-all capitalize ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}>
              {tab === 'overview' ? '總覽' : tab === 'itinerary' ? '行程' : tab === 'accommodation' ? '住宿' : '旅伴'}
            </button>
          ))}
        </div>
        <button onClick={() => setCurrentProjectId(null)} className="mt-auto flex items-center gap-2 text-red-400 font-black p-4 hover:bg-red-50 rounded-xl transition"><LogOut size={18}/> 切換旅程</button>
      </nav>

      <main className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full pb-32">
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in">
            <h3 className="text-3xl font-black">旅程規劃總覽</h3>
            <div className="space-y-6 border-l-4 border-gray-100 pl-8 ml-4">
              {projectData?.itinerary?.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time)).map(item => (
                <div key={item.id} onClick={() => setDetailItem({...item, type: 'itinerary'})} className="bg-white p-6 rounded-[2rem] shadow-sm border hover:shadow-md cursor-pointer transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><MapPin size={24}/></div>
                    <div>
                      <p className="text-xs font-black text-blue-400">{item.date} {item.time}</p>
                      <h4 className="font-black text-lg">{item.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <img src={item.creatorPic} className="w-4 h-4 rounded-full border" />
                        <span className="text-[10px] font-bold text-gray-400">{item.creatorName} 建議</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        )}

        {(activeTab === 'itinerary' || activeTab === 'accommodation') && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-black">{activeTab === 'itinerary' ? '行程地點' : '住宿管理'}</h3>
              <button onClick={() => {
                setFormData({ splitWithIds: [], amount: 0, note: '', date: getNowDate(), startDate: getNowDate(), time: getNowTime() });
                setShowModal(activeTab);
              }} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg hover:scale-105 transition"><Plus size={24}/></button>
            </div>
            <div className="grid gap-4">
              {(activeTab === 'itinerary' ? projectData?.itinerary : projectData?.accommodations)?.map(i => (
                <div key={i.id} className="bg-white p-6 rounded-[2rem] border flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center font-black text-[10px] flex-col text-gray-500">
                      <span>{i.date?.slice(5) || i.startDate?.slice(5)}</span>
                      <span className="opacity-60">{i.time || '整日'}</span>
                    </div>
                    <div>
                      <h4 className="font-black text-lg">{i.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <img src={i.creatorPic} className="w-3.5 h-3.5 rounded-full" />
                        <p className="text-[10px] font-bold text-gray-400">{i.creatorName} 新增</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingGeneric({...i, type: activeTab})} className="p-2 text-gray-300 hover:text-blue-500 transition"><Edit2 size={18}/></button>
                    <button onClick={async () => {
                      const field = activeTab === 'itinerary' ? 'itinerary' : 'accommodations';
                      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', currentProjectId), {
                        [field]: projectData[field].filter(item => item.id !== i.id)
                      });
                    }} className="p-2 text-gray-300 hover:text-red-500 transition"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 編輯 Modal */}
      {editingGeneric && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl space-y-6">
            <h4 className="text-2xl font-black">修改{editingGeneric.type === 'itinerary' ? '行程' : '住宿'}</h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">名稱</label>
                <input type="text" value={editingGeneric.name} className="w-full border-2 rounded-2xl px-5 py-4 font-bold outline-none focus:border-blue-500" onChange={e => setEditingGeneric({...editingGeneric, name: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">日期</label>
                  <input type="date" value={editingGeneric.date || editingGeneric.startDate} className="w-full border-2 rounded-2xl px-4 py-4 text-sm font-bold outline-none" onChange={e => setEditingGeneric({...editingGeneric, [editingGeneric.type==='itinerary'?'date':'startDate']: e.target.value})} />
                </div>
                {editingGeneric.type === 'itinerary' && (
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">時間</label>
                    <input type="time" value={editingGeneric.time} className="w-full border-2 rounded-2xl px-4 py-4 text-sm font-bold outline-none" onChange={e => setEditingGeneric({...editingGeneric, time: e.target.value})} />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">備註</label>
                <textarea value={editingGeneric.note || ''} rows="3" className="w-full border-2 rounded-2xl px-5 py-4 text-sm font-bold resize-none outline-none focus:border-blue-500" onChange={e => setEditingGeneric({...editingGeneric, note: e.target.value})}></textarea>
              </div>
            </div>
            <button onClick={async () => {
              const field = editingGeneric.type === 'itinerary' ? 'itinerary' : 'accommodations';
              const newList = projectData[field].map(item => item.id === editingGeneric.id ? editingGeneric : item);
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', currentProjectId), { [field]: newList });
              setEditingGeneric(null);
            }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-colors">儲存修改</button>
            <button onClick={() => setEditingGeneric(null)} className="w-full text-gray-400 font-bold py-2">取消返回</button>
          </div>
        </div>
      )}

      {/* 新增 Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-sm">
          <form onSubmit={handleFormSubmit} className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center">
              <h4 className="text-2xl font-black">計畫新{showModal==='itinerary'?'行程':'住宿'}</h4>
              <button type="button" onClick={() => setShowModal(null)} className="text-gray-300 hover:text-gray-600"><X/></button>
            </div>
            <div className="space-y-4">
              <input required type="text" placeholder="標題名稱..." className="w-full border-2 rounded-2xl px-5 py-4 font-bold outline-none focus:border-blue-500" onChange={e => setFormData({...formData, name: e.target.value})} />
              <div className="flex gap-4">
                <input required type="date" value={formData.date} className="w-full border-2 rounded-2xl px-4 py-4 text-sm font-bold outline-none" onChange={e => setFormData({...formData, date: e.target.value, startDate: e.target.value})} />
                {showModal === 'itinerary' && <input required type="time" value={formData.time} className="w-full border-2 rounded-2xl px-4 py-4 text-sm font-bold outline-none" onChange={e => setFormData({...formData, time: e.target.value})} />}
              </div>
              <textarea placeholder="詳細備註..." rows="3" className="w-full border-2 rounded-2xl px-5 py-4 text-sm font-bold resize-none outline-none focus:border-blue-500" onChange={e => setFormData({...formData, note: e.target.value})}></textarea>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700">發佈到旅程</button>
          </form>
        </div>
      )}

      {/* 詳情展示 Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-gray-900/60 backdrop-blur-lg">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative">
            <button onClick={() => setDetailItem(null)} className="absolute top-8 right-8 text-gray-300 hover:text-gray-600 transition-colors"><X/></button>
            <div className="space-y-8">
              <div className="w-16 h-16 bg-blue-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg"><MapPin size={32}/></div>
              <div>
                <h2 className="text-3xl font-black">{detailItem.name}</h2>
                <p className="text-gray-400 font-bold mt-1">{detailItem.date} {detailItem.time}</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-[2rem] space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> 備註內容</p>
                <p className="text-sm font-bold text-gray-600 italic leading-relaxed">{detailItem.note || "無備註事項。"}</p>
                <div className="pt-4 border-t border-gray-200 flex items-center gap-3">
                  <img src={detailItem.creatorPic} className="w-8 h-8 rounded-full border shadow-sm" />
                  <p className="text-xs font-black text-gray-500">{detailItem.creatorName} 新增此行程</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 挂载 React 应用到 DOM
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('找不到 #root 元素，无法挂载 React 应用');
}