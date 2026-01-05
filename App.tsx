
import React, { useState, useEffect, useRef } from 'react';
import { translations } from './translations';
import { User, DiagnosticResult, Language, BlogPost, ChatMessage } from './types';
import { diagnoseRepair, startRepairChat } from './services/gemini';
import { 
  Camera, 
  BookOpen, 
  History as HistoryIcon, 
  Settings, 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle,
  X,
  CreditCard,
  Globe,
  Loader2,
  Wrench,
  Search,
  MessageCircle,
  Send,
  Sparkles,
  Zap,
  Clock,
  ThumbsUp,
  Share2
} from 'lucide-react';

const MOCK_REPAIRS = [
  { img: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=400", label: "Engine Repair" },
  { img: "https://images.unsplash.com/photo-1503691657017-d53344605963?auto=format&fit=crop&q=80&w=400", label: "Roof Patching" },
  { img: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=400", label: "Electrical Fix" },
  { img: "https://images.unsplash.com/photo-1621905235294-75812b481b6a?auto=format&fit=crop&q=80&w=400", label: "Sink Plumbing" }
];

const MOCK_BLOGS: BlogPost[] = [
  {
    id: '1',
    title: '5 DIY Roof Inspections',
    excerpt: 'How to spot leaks before they ruin your attic. Essential tips for every homeowner.',
    content: 'Roof maintenance is critical for the longevity of your home. Start by checking for missing or damaged shingles after every major storm. Look for granules in your gutters, which indicate aging shingles. Inside, check for water stains on your ceiling or damp insulation in the attic. Use binoculars from the ground for safety if you are uncomfortable with heights!',
    image: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&q=80&w=800',
    date: 'Today',
    category: 'Home'
  },
  {
    id: '2',
    title: 'Essential Car Fluids',
    excerpt: 'Keep your engine running smooth with this simple fluids checklist.',
    content: 'Your car relies on various fluids to operate correctly. Check your oil level monthly; it is the lifeblood of your engine. Coolant prevents overheating, while brake fluid is vital for safety. Don\'t forget power steering and windshield washer fluids. Regular checks can save you thousands in mechanical repairs down the line.',
    image: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&q=80&w=800',
    date: 'Yesterday',
    category: 'Auto'
  },
  {
    id: '3',
    title: 'Fixing a Leaky Faucet',
    excerpt: 'Stop the drip and save on your water bill with this 15-minute fix.',
    content: 'A dripping faucet is often caused by a worn-out washer or O-ring. Turn off the water supply under the sink first. Disassemble the handle, replace the rubber seal, and reassemble. It\'s a quick fix that anyone can do with a basic wrench set.',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800',
    date: '2 days ago',
    category: 'Plumbing'
  },
  {
    id: '4',
    title: 'Winterize Your Home',
    excerpt: 'Protect your pipes and lower heating costs before the first frost hits.',
    content: 'Seal windows with weatherstripping, insulate outdoor pipes, and service your furnace. Taking these steps early ensures comfort and prevents costly emergency repairs in the dead of winter.',
    image: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?auto=format&fit=crop&q=80&w=800',
    date: '3 days ago',
    category: 'Home'
  }
];

export default function App() {
  const [view, setView] = useState<'welcome' | 'signup' | 'home' | 'diagnose' | 'results' | 'blog' | 'history' | 'settings' | 'subscribe' | 'chat' | 'blog_post'>('welcome');
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('fixit_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [lang, setLang] = useState<Language>('en');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<DiagnosticResult | null>(null);
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);
  const [history, setHistory] = useState<DiagnosticResult[]>(() => {
    const saved = localStorage.getItem('fixit_history');
    return saved ? JSON.parse(saved) : [];
  });

  // UI States
  const [problemDescription, setProblemDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatSessionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];

  useEffect(() => {
    if (user) {
      localStorage.setItem('fixit_user', JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('fixit_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, view]);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email: 'user@fixit.pro',
      name: 'Global Maker',
      isSubscribed: false,
      freeUsesRemaining: 5
    };
    setUser(newUser);
    setView('home');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const runDiagnosis = async () => {
    if (!user) return;
    if (!problemDescription && !selectedImage) {
      alert("Please provide a description or a photo.");
      return;
    }

    if (!user.isSubscribed && user.freeUsesRemaining <= 0) {
      setView('subscribe');
      return;
    }

    setIsAnalyzing(true);
    setView('diagnose');

    try {
      const base64 = selectedImage ? selectedImage.split(',')[1] : null;
      const result = await diagnoseRepair(base64, problemDescription, lang);
      
      setLastResult(result);
      setHistory(prev => [result, ...prev]);
      
      if (!user.isSubscribed) {
        setUser(prev => prev ? { ...prev, freeUsesRemaining: Math.max(0, prev.freeUsesRemaining - 1) } : null);
      }
      
      setProblemDescription('');
      setSelectedImage(null);
      setIsAnalyzing(false);
      setView('results');
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
      alert('Diagnostic failed. Please check your connection.');
      setView('home');
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    if (!chatSessionRef.current) {
      chatSessionRef.current = await startRepairChat();
    }

    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    try {
      const response = await chatSessionRef.current.sendMessage({ message: chatInput });
      const modelMsg: ChatMessage = { role: 'model', text: response.text || 'Sorry, I missed that.' };
      setChatMessages(prev => [...prev, modelMsg]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: 'Error connecting to 24/7 support.' }]);
    }
  };

  const handleSubscribe = () => {
    setUser(prev => prev ? { ...prev, isSubscribed: true } : null);
    setView('home');
  };

  const renderTab = (icon: React.ReactNode, label: string, active: boolean, onClick: () => void) => (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full transition-all duration-300 ${active ? 'text-blue-600 scale-110' : 'text-gray-400 opacity-70'}`}
    >
      <div className={`mb-1 p-1 rounded-lg ${active ? 'bg-blue-50' : ''}`}>{icon}</div>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );

  const Nav = () => (
    <nav className="fixed bottom-0 left-0 right-0 ios-blur border-t border-gray-100 safe-area-bottom h-16 flex items-center justify-around z-50 px-2 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
      {renderTab(<Zap size={20} />, t.diagnose, view === 'home' || view === 'results', () => setView('home'))}
      {renderTab(<MessageCircle size={20} />, 'Chat', view === 'chat', () => setView('chat'))}
      {renderTab(<BookOpen size={20} />, 'Blogs', view === 'blog' || view === 'blog_post', () => setView('blog'))}
      {renderTab(<HistoryIcon size={20} />, t.history, view === 'history', () => setView('history'))}
    </nav>
  );

  const Header = ({ title, showBack, onBack }: { title: string, showBack?: boolean, onBack?: () => void }) => (
    <div className="sticky top-0 z-40 ios-blur h-14 border-b border-gray-100 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {showBack && (
          <button onClick={onBack || (() => setView('home'))} className="text-blue-600 p-1 active:scale-90 transition-transform">
            <ArrowLeft size={24} />
          </button>
        )}
        <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => setView('settings')} className="text-gray-400 p-1 hover:bg-gray-50 rounded-full transition-colors">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );

  // Welcome / Onboarding
  if (!user && view === 'welcome') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center p-8">
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] flex items-center justify-center shadow-2xl rotate-3">
              <Wrench size={48} className="text-white -rotate-12" />
            </div>
            <div className="absolute -top-2 -right-2 bg-yellow-400 text-white rounded-full p-2 shadow-lg animate-bounce">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter text-gray-900 leading-[0.9]">
              FIX IT <br/><span className="text-blue-600">ANYTHING.</span>
            </h1>
            <p className="text-gray-500 text-lg font-medium max-w-xs mx-auto">Instant expert repair guidance for your world.</p>
          </div>
        </div>
        <div className="w-full space-y-4 pb-12">
          <button 
            onClick={() => setView('signup')}
            className="w-full bg-blue-600 text-white font-bold py-5 rounded-3xl shadow-[0_15px_30px_rgba(37,99,235,0.3)] active:scale-95 transition-all"
          >
            {t.getStarted}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'signup') {
    return (
      <div className="min-h-screen bg-white p-6">
        <button onClick={() => setView('welcome')} className="text-blue-600 mb-8 flex items-center gap-1 font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="text-3xl font-black tracking-tight mb-2">Join Pro</h2>
        <p className="text-gray-500 mb-10 font-medium">Start diagnosing repairs with AI in seconds.</p>
        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-1 block">Full Name</label>
            <input type="text" placeholder="John Doe" className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-1 block">Email</label>
            <input type="email" placeholder="john@example.com" className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-100 mt-6 active:scale-95 transition-transform">
            Get My First 5 Fixes Free
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 overflow-y-auto bg-[#F8F9FC]">
      {view === 'home' && (
        <>
          <Header title="FixIt Pro" />
          <main className="p-4 space-y-6">
            
            <header className="flex flex-col gap-1">
              <h2 className="text-2xl font-black tracking-tight text-gray-900">Hello, {user?.name.split(' ')[0]}!</h2>
              <p className="text-gray-500 text-sm font-medium">What needs fixing today?</p>
            </header>

            {user && !user.isSubscribed && user.freeUsesRemaining === 0 && (
              <div className="bg-gradient-to-br from-indigo-600 to-purple-800 rounded-[2rem] p-6 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xl font-black">Trial Ended</h3>
                  <p className="text-indigo-100 text-sm mt-1 font-medium leading-tight">Join Pro for unlimited AI repairs, 24/7 chat support, and more.</p>
                  <button 
                    onClick={() => setView('subscribe')}
                    className="w-full bg-white text-indigo-700 font-black py-3 rounded-2xl shadow-lg mt-5 active:scale-95 transition-transform"
                  >
                    UPGRADE TO PRO
                  </button>
                </div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
              </div>
            )}

            <section className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-5">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><Zap size={18} /></div>
                  <h3 className="font-black text-lg">Quick Diagnostic</h3>
                </div>
                {!user?.isSubscribed && (
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
                    {user?.freeUsesRemaining} Free Fixes
                  </span>
                )}
              </div>
              
              <div className="relative">
                <textarea 
                  placeholder="Describe your issue (e.g., 'Dishwasher won't drain')..."
                  className="w-full min-h-[110px] bg-gray-50 rounded-3xl p-5 text-sm font-medium border-2 border-transparent focus:border-blue-100 focus:ring-0 transition-all resize-none placeholder-gray-400"
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-3 items-center">
                <label className="flex items-center justify-center gap-2 bg-gray-50 text-gray-700 px-4 py-4 rounded-2xl cursor-pointer hover:bg-gray-100 active:scale-95 transition-all flex-1 border border-gray-200">
                  <Camera size={20} className="text-blue-600" />
                  <span className="text-xs font-black uppercase tracking-wider">Add Photo</span>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
                
                <button 
                  onClick={runDiagnosis}
                  className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[0_10px_20px_rgba(37,99,235,0.2)] active:scale-95 transition-all"
                >
                  Diagnose
                </button>
              </div>

              {selectedImage && (
                <div className="relative mt-2 animate-in zoom-in-90 duration-300">
                  <img src={selectedImage} className="w-24 h-24 object-cover rounded-2xl border-2 border-blue-50 shadow-md" />
                  <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-lg active:scale-75 transition-transform">
                    <X size={14} />
                  </button>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-end px-1">
                <h3 className="font-black text-lg">Repair Showcase</h3>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Popular</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
                {MOCK_REPAIRS.map((item, i) => (
                  <div key={i} className="flex-shrink-0 w-52 h-36 rounded-3xl overflow-hidden shadow-md relative group active:scale-95 transition-transform">
                    <img src={item.img} className="w-full h-full object-cover brightness-90 group-hover:brightness-100 transition-all" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                      <span className="text-white text-xs font-black tracking-tight">{item.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-black text-lg">Daily Blogs</h3>
                <button onClick={() => setView('blog')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest">See All</button>
              </div>
              <div className="grid gap-5">
                {MOCK_BLOGS.slice(0, 2).map(post => (
                  <button 
                    key={post.id} 
                    onClick={() => { setSelectedBlog(post); setView('blog_post'); }}
                    className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm text-left active:scale-[0.98] transition-all"
                  >
                    <img src={post.image} className="w-full h-44 object-cover" />
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">{post.category}</span>
                        <span className="text-[9px] font-bold text-gray-400">• {post.date}</span>
                      </div>
                      <h4 className="font-black text-xl mt-1 leading-tight text-gray-900">{post.title}</h4>
                      <p className="text-gray-500 text-sm mt-2 line-clamp-2 font-medium">{post.excerpt}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </main>
          <Nav />
        </>
      )}

      {view === 'blog' && (
        <>
          <Header title="Daily Blog" showBack />
          <main className="p-4 space-y-6">
            <header className="px-1 pt-2">
              <h2 className="text-2xl font-black tracking-tight">Latest Repair Tips</h2>
              <p className="text-gray-500 text-sm font-medium">Expert advice delivered daily.</p>
            </header>
            <div className="grid gap-6">
              {MOCK_BLOGS.map(post => (
                <button 
                  key={post.id} 
                  onClick={() => { setSelectedBlog(post); setView('blog_post'); }}
                  className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm text-left active:scale-[0.98] transition-all"
                >
                  <img src={post.image} className="w-full h-48 object-cover" />
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">{post.category}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">• {post.date}</span>
                    </div>
                    <h4 className="font-black text-xl mt-1 leading-tight text-gray-900">{post.title}</h4>
                    <p className="text-gray-500 text-sm mt-2 font-medium">{post.excerpt}</p>
                    <div className="mt-4 flex items-center gap-2 text-blue-600">
                      <span className="text-xs font-black uppercase tracking-widest">Read More</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </main>
          <Nav />
        </>
      )}

      {view === 'blog_post' && selectedBlog && (
        <>
          <Header title="Read Tips" showBack onBack={() => setView('blog')} />
          <main className="pb-8">
            <img src={selectedBlog.image} className="w-full h-72 object-cover" />
            <div className="p-6 -mt-10 bg-[#F8F9FC] rounded-t-[3rem] relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-4 py-1 rounded-full uppercase tracking-widest">{selectedBlog.category}</span>
                <span className="text-xs font-bold text-gray-400">{selectedBlog.date}</span>
              </div>
              <h2 className="text-3xl font-black tracking-tighter text-gray-900 leading-[0.9]">{selectedBlog.title}</h2>
              <div className="flex gap-4 border-y border-gray-100 py-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <ThumbsUp size={16} /> <span className="text-xs font-bold">1.2k</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <MessageCircle size={16} /> <span className="text-xs font-bold">48</span>
                </div>
                <div className="flex-1"></div>
                <button className="text-blue-600"><Share2 size={18} /></button>
              </div>
              <div className="space-y-4 text-gray-700 font-medium leading-relaxed">
                {selectedBlog.content.split('\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
              
              <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white space-y-4 shadow-xl shadow-blue-100">
                <h3 className="text-xl font-black">Need custom help?</h3>
                <p className="text-blue-100 text-sm font-medium">Chat with our 24/7 AI Repair Assistant for real-time guidance.</p>
                <button 
                  onClick={() => setView('chat')}
                  className="bg-white text-blue-600 font-black py-3 px-8 rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-transform"
                >
                  START CHATTING
                </button>
              </div>
            </div>
          </main>
          <Nav />
        </>
      )}

      {view === 'chat' && (
        <div className="flex flex-col h-screen bg-white pb-16">
          <Header title="24/7 Expert Chat" />
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#F8F9FC]">
            {chatMessages.length === 0 && (
              <div className="text-center py-16 px-6 max-w-sm mx-auto space-y-6">
                <div className="relative inline-block">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-white shadow-2xl rotate-3">
                    <MessageCircle size={36} className="-rotate-3" />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-yellow-400 text-white rounded-full p-2 shadow-lg">
                    <Sparkles size={16} />
                  </div>
                </div>
                <div>
                  <h3 className="font-black text-2xl tracking-tight text-gray-900">Expert Help, Anytime.</h3>
                  <p className="text-gray-500 text-sm mt-3 font-medium leading-relaxed">Ask me any question about cars, roofs, appliances, or DIY projects. I'm here 24/7.</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <button onClick={() => setChatInput("How do I fix a flat tire?")} className="bg-white border border-gray-100 p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-blue-600 active:scale-95 transition-all">"How do I fix a flat tire?"</button>
                  <button onClick={() => setChatInput("My roof is leaking, help!")} className="bg-white border border-gray-100 p-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-blue-600 active:scale-95 transition-all">"My roof is leaking, help!"</button>
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-[1.75rem] p-5 text-sm font-medium ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-100' 
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-50 shadow-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-100 ios-blur flex gap-2">
            <input 
              type="text" 
              placeholder="Type your repair question..." 
              className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            />
            <button 
              onClick={handleSendChat}
              className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-100 active:scale-90 transition-all"
            >
              <Send size={20} />
            </button>
          </div>
          <Nav />
        </div>
      )}

      {view === 'diagnose' && (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="relative">
            <Loader2 size={80} className="text-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap size={24} className="text-blue-600" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">{t.analyzing}</h2>
            <p className="text-gray-500 font-medium mt-2 max-w-xs mx-auto">Searching reliable global databases for the best repair instructions...</p>
          </div>
        </div>
      )}

      {view === 'results' && lastResult && (
        <>
          <Header title="Expert Solution" showBack />
          <main className="p-4 space-y-6">
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-50 shadow-sm space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Wrench size={40} /></div>
              <h3 className="font-black text-2xl text-blue-600 leading-tight">{lastResult.problem}</h3>
              <p className="text-gray-700 font-medium text-sm leading-relaxed">{lastResult.diagnosis}</p>
            </div>

            <section className="space-y-4">
              <h3 className="font-black text-xl px-1 flex items-center gap-2">
                <CheckCircle size={22} className="text-green-500" />
                Step-by-Step Fix
              </h3>
              <div className="space-y-4">
                {lastResult.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4 p-6 bg-white rounded-[2rem] border border-gray-50 shadow-sm relative">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xs font-black shadow-lg shadow-blue-100">
                      {idx + 1}
                    </span>
                    <p className="text-gray-800 text-sm font-medium leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="font-black text-xl px-1">Required Toolkit</h3>
              <div className="flex flex-wrap gap-2">
                {lastResult.toolsNeeded.map((tool, idx) => (
                  <span key={idx} className="bg-white text-gray-800 px-5 py-3 rounded-2xl text-xs font-black border border-gray-100 shadow-sm uppercase tracking-wider">
                    {tool}
                  </span>
                ))}
              </div>
            </section>

            <section className="space-y-4 pb-8">
              <h3 className="font-black text-xl px-1">Reliable Sources</h3>
              <div className="space-y-3">
                {lastResult.sources.map((source, idx) => (
                  <a 
                    key={idx} href={source.uri} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between p-5 bg-white border border-gray-50 rounded-[2rem] shadow-sm active:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-black text-gray-900 text-sm line-clamp-1">{source.title}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate max-w-[200px]">{source.uri}</span>
                    </div>
                    <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><ChevronRight size={18} /></div>
                  </a>
                ))}
              </div>
            </section>
          </main>
          <Nav />
        </>
      )}

      {view === 'history' && (
        <>
          <Header title="My History" />
          <main className="p-4 space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-24 text-gray-400 space-y-4">
                <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto opacity-40">
                  <HistoryIcon size={40} />
                </div>
                <p className="font-medium">You haven't diagnosed anything yet.</p>
                <button onClick={() => setView('home')} className="text-blue-600 font-black uppercase text-xs tracking-widest">Start First Fix</button>
              </div>
            ) : (
              history.map((item, idx) => (
                <button 
                  key={idx} 
                  onClick={() => { setLastResult(item); setView('results'); }}
                  className="w-full text-left bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all"
                >
                  <div className="flex-1 pr-4 space-y-1">
                    <h4 className="font-black text-gray-900 line-clamp-1">{item.problem}</h4>
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-gray-300" />
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-tight">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl text-gray-300 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                    <ChevronRight size={18} />
                  </div>
                </button>
              ))
            )}
          </main>
          <Nav />
        </>
      )}

      {view === 'settings' && (
        <>
          <Header title="Settings" showBack />
          <main className="p-4 space-y-8 pt-6">
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Profile & Account</h3>
              <div className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-50 shadow-sm">
                <div className="p-6 flex items-center justify-between border-b border-gray-50">
                  <span className="font-black text-sm">Language</span>
                  <select 
                    value={lang} 
                    onChange={(e) => setLang(e.target.value as Language)}
                    className="bg-gray-50 text-blue-600 font-black text-xs px-4 py-2 rounded-xl focus:outline-none uppercase tracking-widest"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="zh">中文</option>
                  </select>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <span className="font-black text-sm">Subscription Status</span>
                  <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${user?.isSubscribed ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {user?.isSubscribed ? 'Pro Member' : 'Free Member'}
                  </div>
                </div>
              </div>
            </section>

            {!user?.isSubscribed && (
              <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white space-y-4 shadow-xl shadow-blue-100 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xl font-black">Go Unlimited</h3>
                  <p className="text-blue-100 text-sm font-medium">Unlock all features including unlimited diagnostics and 24/7 priority support.</p>
                  <button 
                    onClick={() => setView('subscribe')}
                    className="w-full bg-white text-blue-600 font-black py-4 rounded-2xl shadow-lg mt-4 active:scale-95 transition-transform"
                  >
                    UPGRADE NOW
                  </button>
                </div>
                <Zap size={100} className="absolute -bottom-10 -right-5 text-white opacity-10 rotate-12" />
              </div>
            )}

            <button 
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="w-full bg-red-50 text-red-600 font-black py-5 rounded-[2rem] active:bg-red-100 transition-colors uppercase text-xs tracking-widest"
            >
              Sign Out Account
            </button>
            <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">FixIt Pro v1.0.4 Global</p>
          </main>
          <Nav />
        </>
      )}

      {view === 'subscribe' && (
        <div className="min-h-screen bg-white flex flex-col p-6">
          <button onClick={() => setView('home')} className="self-end text-gray-400 p-2 hover:bg-gray-50 rounded-full transition-colors">
            <X size={24} />
          </button>
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
            <div className="relative">
              <div className="bg-amber-100 w-24 h-24 rounded-[2rem] flex items-center justify-center text-amber-600 shadow-xl rotate-6">
                <CreditCard size={40} className="-rotate-6" />
              </div>
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-2 rounded-full shadow-lg">
                <CheckCircle size={16} />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter text-gray-900">{t.pro}</h2>
              <p className="text-gray-500 max-w-xs mx-auto text-sm font-medium leading-relaxed">Join thousands of makers worldwide using AI to fix their world.</p>
            </div>
            <div className="bg-white p-8 rounded-[3rem] border-2 border-blue-600 w-full shadow-2xl shadow-blue-50 space-y-8">
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <span className="block text-xl font-black text-gray-900">Unlimited Pro</span>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Billed Monthly</span>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-blue-600 tracking-tighter">$4.99</span>
                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">/ Month</span>
                </div>
              </div>
              <ul className="text-left space-y-4">
                {[
                  "Unlimited AI Photo Diagnostics",
                  "24/7 Expert Support Chat",
                  "Exclusive Weekly Repair Guides",
                  "Offline Repair Database Access"
                ].map((perk, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium text-gray-600">
                    <div className="bg-green-50 text-green-600 rounded-full p-1"><CheckCircle size={14} /></div> {perk}
                  </li>
                ))}
              </ul>
              <button 
                onClick={handleSubscribe}
                className="w-full bg-blue-600 text-white font-black py-5 rounded-[2rem] shadow-[0_20px_40px_rgba(37,99,235,0.3)] active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Start My Pro Membership
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Cancel Anytime • Secure SSL</p>
              <div className="flex justify-center gap-2 opacity-20 brightness-0">
                <CreditCard size={16} /> <CreditCard size={16} /> <CreditCard size={16} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
