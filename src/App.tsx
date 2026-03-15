import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, StudyNote, Quiz, OperationType } from './types';
import { handleFirestoreError } from './utils';
import { 
  BookOpen, 
  LayoutDashboard, 
  Upload, 
  BrainCircuit, 
  GraduationCap, 
  TrendingUp, 
  Settings, 
  LogOut,
  Plus,
  FileText,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Flame,
  User as UserIcon,
  Camera,
  Search,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import Markdown from 'react-markdown';
import { summarizeNote, explainConcepts, generateQuiz } from './services/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled,
  loading
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger',
  className?: string,
  disabled?: boolean,
  loading?: boolean
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    outline: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100'
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
    >
      {loading && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn('bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm', className, onClick && 'cursor-pointer')}
  >
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedNote, setSelectedNote] = useState<StudyNote | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch profile
        try {
          const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (profileDoc.exists()) {
            setProfile(profileDoc.data() as UserProfile);
          } else {
            // Create initial profile
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Student',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              createdAt: new Date().toISOString(),
              studyStreak: 0,
              totalXp: 0,
              subjects: [],
              goals: ''
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const notesQuery = query(
      collection(db, 'notes'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyNote)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notes'));

    const quizzesQuery = query(
      collection(db, 'quizzes'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeQuizzes = onSnapshot(quizzesQuery, (snapshot) => {
      setQuizzes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'quizzes'));

    return () => {
      unsubscribeNotes();
      unsubscribeQuizzes();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium animate-pulse">AI Study Companion is warming up...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-zinc-200 flex-col p-6 fixed h-full">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <GraduationCap size={24} />
          </div>
          <h1 className="font-bold text-xl tracking-tight">StudyAI</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Upload size={20} />} label="Upload Notes" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
          <NavItem icon={<BrainCircuit size={20} />} label="AI Explainer" active={activeTab === 'explain'} onClick={() => setActiveTab('explain')} />
          <NavItem icon={<GraduationCap size={20} />} label="Quizzes" active={activeTab === 'quiz'} onClick={() => setActiveTab('quiz')} />
          <NavItem icon={<TrendingUp size={20} />} label="Progress" active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} />
        </nav>

        <div className="pt-6 border-t border-zinc-100 space-y-2">
          <NavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-10 pb-24 md:pb-10">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <Dashboard 
              profile={profile} 
              notes={notes} 
              quizzes={quizzes} 
              onNavigate={setActiveTab} 
              onSelectNote={(note) => {
                setSelectedNote(note);
                setActiveTab('explain');
              }}
            />
          )}
          {activeTab === 'upload' && <UploadScreen userId={user.uid} onComplete={() => setActiveTab('dashboard')} />}
          {activeTab === 'explain' && <ExplainScreen notes={notes} selectedNote={selectedNote} onSelectNote={setSelectedNote} />}
          {activeTab === 'quiz' && <QuizScreen notes={notes} quizzes={quizzes} userId={user.uid} />}
          {activeTab === 'progress' && <ProgressScreen quizzes={quizzes} profile={profile} />}
          {activeTab === 'settings' && <SettingsScreen profile={profile} onLogout={handleLogout} />}
        </AnimatePresence>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 flex justify-between items-center z-50">
        <MobileNavItem icon={<LayoutDashboard size={24} />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavItem icon={<Upload size={24} />} active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} />
        <MobileNavItem icon={<BrainCircuit size={24} />} active={activeTab === 'explain'} onClick={() => setActiveTab('explain')} />
        <MobileNavItem icon={<GraduationCap size={24} />} active={activeTab === 'quiz'} onClick={() => setActiveTab('quiz')} />
        <MobileNavItem icon={<UserIcon size={24} />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>
    </div>
  );
}

// --- Sub-Screens ---

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <Card className="max-w-md w-full p-10 text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-200">
          <GraduationCap size={32} />
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">AI Study Companion</h1>
        <p className="text-zinc-500 mb-10">Study smarter, not harder. Let AI transform your notes into interactive learning tools.</p>
        
        <div className="space-y-4">
          <Button onClick={onLogin} className="w-full py-4 text-lg">
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 mr-2" alt="Google" />
            Continue with Google
          </Button>
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-100"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-zinc-400">Or continue with email</span></div>
          </div>
          <input type="email" placeholder="Email address" className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
          <input type="password" placeholder="Password" className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
          <Button variant="outline" className="w-full py-3">Sign In</Button>
        </div>
        
        <p className="mt-8 text-sm text-zinc-400">By continuing, you agree to our Terms of Service and Privacy Policy.</p>
      </Card>
    </div>
  );
}

function Dashboard({ profile, notes, quizzes, onNavigate, onSelectNote }: { 
  profile: UserProfile | null, 
  notes: StudyNote[], 
  quizzes: Quiz[],
  onNavigate: (tab: string) => void,
  onSelectNote: (note: StudyNote) => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900">Welcome back, {profile?.displayName?.split(' ')[0]}! 👋</h2>
          <p className="text-zinc-500">You've studied for 3 days straight. Keep it up!</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-orange-50 text-orange-600 px-4 py-2 rounded-full font-bold">
            <Flame size={20} />
            {profile?.studyStreak || 3} Day Streak
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full font-bold">
            <GraduationCap size={20} />
            {profile?.totalXp || 1250} XP
          </div>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard 
          icon={<Plus className="text-indigo-600" />} 
          title="Upload Notes" 
          color="bg-indigo-50" 
          onClick={() => onNavigate('upload')}
        />
        <QuickActionCard 
          icon={<BrainCircuit className="text-emerald-600" />} 
          title="AI Explain" 
          color="bg-emerald-50" 
          onClick={() => onNavigate('explain')}
        />
        <QuickActionCard 
          icon={<GraduationCap className="text-amber-600" />} 
          title="Take Quiz" 
          color="bg-amber-50" 
          onClick={() => onNavigate('quiz')}
        />
        <QuickActionCard 
          icon={<TrendingUp className="text-rose-600" />} 
          title="Progress" 
          color="bg-rose-50" 
          onClick={() => onNavigate('progress')}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent Notes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-zinc-900">Recent Notes</h3>
            <Button variant="ghost" className="text-indigo-600" onClick={() => onNavigate('explain')}>View all</Button>
          </div>
          <div className="grid gap-4">
            {notes.slice(0, 3).map(note => (
              <Card key={note.id} className="group hover:border-indigo-200 transition-all cursor-pointer" onClick={() => onSelectNote(note)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900">{note.title}</h4>
                      <p className="text-sm text-zinc-500 flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(note.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-zinc-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
              </Card>
            ))}
            {notes.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-2xl">
                <p className="text-zinc-400">No notes uploaded yet. Start by uploading your first note!</p>
                <Button variant="outline" className="mt-4" onClick={() => onNavigate('upload')}>Upload Now</Button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Quizzes */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-zinc-900">Recent Quizzes</h3>
          <div className="space-y-4">
            {quizzes.slice(0, 3).map(quiz => (
              <Card key={quiz.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Quiz Result</span>
                  <span className={cn(
                    "px-2 py-1 rounded-md text-xs font-bold",
                    (quiz.score || 0) / quiz.totalQuestions >= 0.7 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {quiz.score}/{quiz.totalQuestions}
                  </span>
                </div>
                <h4 className="font-bold text-zinc-900 line-clamp-1">{notes.find(n => n.id === quiz.noteId)?.title || 'Study Quiz'}</h4>
                <div className="mt-3 w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full rounded-full" 
                    style={{ width: `${((quiz.score || 0) / quiz.totalQuestions) * 100}%` }}
                  />
                </div>
              </Card>
            ))}
            {quizzes.length === 0 && (
              <p className="text-center py-8 text-zinc-400 text-sm">No quizzes taken yet.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function UploadScreen({ userId, onComplete }: { userId: string, onComplete: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!title || !content) return;
    setLoading(true);
    try {
      const noteData = {
        userId,
        title,
        content,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'notes'), noteData);
      onComplete();
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onComplete} className="p-2"><ArrowLeft size={24} /></Button>
        <h2 className="text-3xl font-bold text-zinc-900">Upload Notes</h2>
      </div>

      <Card className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Note Title</label>
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Introduction to Photosynthesis" 
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Note Content</label>
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your notes here or summarize your thoughts..." 
            className="w-full h-64 px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button variant="outline" className="py-4">
            <Camera size={20} />
            Scan with Camera
          </Button>
          <Button variant="outline" className="py-4">
            <Upload size={20} />
            Upload PDF/Image
          </Button>
        </div>

        <Button 
          onClick={handleUpload} 
          className="w-full py-4 text-lg" 
          loading={loading}
          disabled={!title || !content}
        >
          Save & Process with AI
        </Button>
      </Card>
    </motion.div>
  );
}

function ExplainScreen({ notes, selectedNote, onSelectNote }: { 
  notes: StudyNote[], 
  selectedNote: StudyNote | null,
  onSelectNote: (note: StudyNote | null) => void
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedNote) {
      if (selectedNote.summary) setSummary(selectedNote.summary);
      else setSummary(null);
      
      if (selectedNote.explanation) setExplanation(selectedNote.explanation);
      else setExplanation(null);
    }
  }, [selectedNote]);

  const handleProcess = async (type: 'summary' | 'explanation') => {
    if (!selectedNote) return;
    setLoading(true);
    try {
      let result = '';
      if (type === 'summary') {
        result = await summarizeNote(selectedNote.content);
        setSummary(result);
        await updateDoc(doc(db, 'notes', selectedNote.id), { summary: result });
      } else {
        result = await explainConcepts(selectedNote.content);
        setExplanation(result);
        await updateDoc(doc(db, 'notes', selectedNote.id), { explanation: result });
      }
    } catch (error) {
      console.error("AI processing failed:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedNote) {
    return (
      <div className="space-y-8">
        <h2 className="text-3xl font-bold text-zinc-900">AI Explainer</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
            <Card key={note.id} className="hover:border-indigo-200 cursor-pointer transition-all" onClick={() => onSelectNote(note)}>
              <h4 className="font-bold text-zinc-900 mb-2">{note.title}</h4>
              <p className="text-sm text-zinc-500 line-clamp-2">{note.content}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => onSelectNote(null)} className="p-2"><ArrowLeft size={24} /></Button>
          <h2 className="text-3xl font-bold text-zinc-900">{selectedNote.title}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleProcess('summary')} loading={loading && !summary}>
            Generate Summary
          </Button>
          <Button variant="primary" onClick={() => handleProcess('explanation')} loading={loading && !explanation}>
            Explain Concepts
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <FileText className="text-indigo-600" />
            Original Notes
          </h3>
          <Card className="h-[600px] overflow-y-auto prose prose-zinc max-w-none">
            <p className="whitespace-pre-wrap">{selectedNote.content}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <BrainCircuit className="text-emerald-600" />
            AI Insights
          </h3>
          <div className="space-y-4 h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {summary && (
              <Card className="bg-indigo-50/50 border-indigo-100">
                <h4 className="font-bold text-indigo-900 mb-3 uppercase text-xs tracking-widest">AI Summary</h4>
                <div className="markdown-body prose prose-indigo prose-sm max-w-none">
                  <Markdown>{summary}</Markdown>
                </div>
              </Card>
            )}
            {explanation && (
              <Card className="bg-emerald-50/50 border-emerald-100">
                <h4 className="font-bold text-emerald-900 mb-3 uppercase text-xs tracking-widest">Concept Breakdown</h4>
                <div className="markdown-body prose prose-emerald prose-sm max-w-none">
                  <Markdown>{explanation}</Markdown>
                </div>
              </Card>
            )}
            {!summary && !explanation && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center p-10 border-2 border-dashed border-zinc-200 rounded-2xl">
                <BrainCircuit size={48} className="text-zinc-200 mb-4" />
                <p className="text-zinc-400">Select an AI action above to analyze your notes.</p>
              </div>
            )}
            {loading && (
              <div className="flex flex-col items-center justify-center h-full text-center p-10">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-zinc-500 font-medium">Gemini is thinking...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function QuizScreen({ notes, quizzes, userId }: { notes: StudyNote[], quizzes: Quiz[], userId: string }) {
  const [selectedNote, setSelectedNote] = useState<StudyNote | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerateQuiz = async (note: StudyNote) => {
    setLoading(true);
    setSelectedNote(note);
    try {
      const questions = await generateQuiz(note.content);
      const newQuiz: Quiz = {
        id: '',
        userId,
        noteId: note.id,
        questions,
        totalQuestions: questions.length,
        createdAt: new Date().toISOString()
      };
      setCurrentQuiz(newQuiz);
      setAnswers({});
      setShowResults(false);
    } catch (error) {
      console.error("Quiz generation failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentQuiz) return;
    let score = 0;
    currentQuiz.questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswer) score++;
    });
    
    const finalQuiz = { ...currentQuiz, score };
    try {
      await addDoc(collection(db, 'quizzes'), finalQuiz);
      setShowResults(true);
    } catch (error) {
      console.error("Failed to save quiz:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-zinc-900">Generating your personalized quiz...</h2>
        <p className="text-zinc-500">Gemini is analyzing "{selectedNote?.title}"</p>
      </div>
    );
  }

  if (currentQuiz) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-zinc-900">Quiz: {selectedNote?.title}</h2>
          <Button variant="ghost" onClick={() => setCurrentQuiz(null)}>Cancel</Button>
        </div>

        <div className="space-y-6">
          {currentQuiz.questions.map((q, idx) => (
            <Card key={idx} className={cn(
              "space-y-4 transition-all",
              showResults && answers[idx] === q.correctAnswer && "border-emerald-200 bg-emerald-50/30",
              showResults && answers[idx] !== q.correctAnswer && "border-red-200 bg-red-50/30"
            )}>
              <div className="flex items-start gap-4">
                <span className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center font-bold text-zinc-500 flex-shrink-0">
                  {idx + 1}
                </span>
                <p className="text-lg font-medium text-zinc-900 pt-1">{q.question}</p>
              </div>
              
              <div className="grid gap-2 ml-12">
                {q.options.map(option => (
                  <button
                    key={option}
                    disabled={showResults}
                    onClick={() => setAnswers(prev => ({ ...prev, [idx]: option }))}
                    className={cn(
                      "text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between",
                      answers[idx] === option ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-medium" : "border-zinc-200 hover:border-zinc-300",
                      showResults && option === q.correctAnswer && "border-emerald-500 bg-emerald-50 text-emerald-700",
                      showResults && answers[idx] === option && option !== q.correctAnswer && "border-red-500 bg-red-50 text-red-700"
                    )}
                  >
                    {option}
                    {showResults && option === q.correctAnswer && <CheckCircle2 size={18} />}
                    {showResults && answers[idx] === option && option !== q.correctAnswer && <XCircle size={18} />}
                  </button>
                ))}
              </div>

              {showResults && (
                <div className="ml-12 mt-4 p-4 bg-white/50 rounded-xl border border-zinc-100 text-sm text-zinc-600">
                  <p className="font-bold text-zinc-900 mb-1">Explanation:</p>
                  {q.explanation}
                </div>
              )}
            </Card>
          ))}
        </div>

        {!showResults ? (
          <Button onClick={handleSubmit} className="w-full py-4 text-lg" disabled={Object.keys(answers).length < currentQuiz.totalQuestions}>
            Submit Quiz
          </Button>
        ) : (
          <div className="space-y-4">
            <Card className="bg-indigo-600 text-white text-center p-8">
              <h3 className="text-2xl font-bold mb-2">Quiz Complete!</h3>
              <p className="text-indigo-100 text-lg">You scored {currentQuiz.score} out of {currentQuiz.totalQuestions}</p>
              <div className="mt-6 flex justify-center gap-4">
                <Button variant="secondary" onClick={() => setCurrentQuiz(null)}>Back to Quizzes</Button>
              </div>
            </Card>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-zinc-900">Quizzes</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notes.map(note => (
          <Card key={note.id} className="flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-zinc-900 mb-2">{note.title}</h4>
              <p className="text-sm text-zinc-500 line-clamp-2 mb-4">{note.content}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => handleGenerateQuiz(note)}>
              Generate Quiz
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProgressScreen({ quizzes, profile }: { quizzes: Quiz[], profile: UserProfile | null }) {
  const data = quizzes.slice().reverse().map((q, i) => ({
    name: `Quiz ${i + 1}`,
    score: (q.score || 0) / q.totalQuestions * 100
  }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <h2 className="text-3xl font-bold text-zinc-900">Study Progress</h2>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="text-center">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Flame size={24} />
          </div>
          <h4 className="text-3xl font-bold text-zinc-900">{profile?.studyStreak || 3}</h4>
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider">Day Streak</p>
        </Card>
        <Card className="text-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={24} />
          </div>
          <h4 className="text-3xl font-bold text-zinc-900">{profile?.totalXp || 1250}</h4>
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider">Total XP</p>
        </Card>
        <Card className="text-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="text-3xl font-bold text-zinc-900">{quizzes.length}</h4>
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider">Quizzes Taken</p>
        </Card>
      </div>

      <Card className="p-8">
        <h3 className="text-xl font-bold text-zinc-900 mb-8">Score Improvement</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  );
}

function SettingsScreen({ profile, onLogout }: { profile: UserProfile | null, onLogout: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-3xl font-bold text-zinc-900">Settings</h2>

      <Card className="divide-y divide-zinc-100">
        <div className="p-6 flex items-center gap-6">
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 text-2xl font-bold overflow-hidden">
            {profile?.photoURL ? <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" /> : profile?.displayName?.[0]}
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900">{profile?.displayName}</h3>
            <p className="text-zinc-500">{profile?.email}</p>
            <Button variant="outline" className="mt-2 py-1 px-3 text-xs">Edit Profile</Button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-zinc-900">Dark Mode</h4>
              <p className="text-sm text-zinc-500">Adjust the app appearance for night study.</p>
            </div>
            <div className="w-12 h-6 bg-zinc-200 rounded-full relative cursor-pointer">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-zinc-900">Study Notifications</h4>
              <p className="text-sm text-zinc-500">Get reminded to keep your streak alive.</p>
            </div>
            <div className="w-12 h-6 bg-indigo-600 rounded-full relative cursor-pointer">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
            </div>
          </div>
        </div>

        <div className="p-6">
          <Button variant="danger" className="w-full" onClick={onLogout}>
            <LogOut size={20} />
            Logout from AI Study Companion
          </Button>
        </div>
      </Card>

      <div className="text-center text-zinc-400 text-sm">
        <p>AI Study Companion v1.0.0</p>
        <p>© 2026 StudyAI Inc.</p>
      </div>
    </motion.div>
  );
}

// --- Helpers ---

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
        active ? "bg-indigo-50 text-indigo-600" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavItem({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 rounded-xl transition-all",
        active ? "text-indigo-600 bg-indigo-50" : "text-zinc-400"
      )}
    >
      {icon}
    </button>
  );
}

function QuickActionCard({ icon, title, color, onClick }: { icon: React.ReactNode, title: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="bg-white border border-zinc-100 p-4 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all text-left flex flex-col gap-3 group"
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", color)}>
        {icon}
      </div>
      <span className="font-bold text-zinc-900 text-sm">{title}</span>
    </button>
  );
}
