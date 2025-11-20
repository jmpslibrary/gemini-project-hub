import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider, 
  signInWithRedirect,
  getRedirectResult 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Layout, Plus, Code, ExternalLink, Box, 
  ArrowLeft, Lock, User, LogOut, Globe, Search, Loader2
} from 'lucide-react';

// --- Firebase Setup ---
const env = import.meta.env; 
const firebaseConfig = {
  apiKey: env.VITE_API_KEY,
  authDomain: env.VITE_AUTH_DOMAIN,
  projectId: env.VITE_PROJECT_ID,
  storageBucket: env.VITE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_MESSAGING_SENDER_ID,
  appId: env.VITE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'gemini-project-hub';

// --- Utility ---
const cleanCode = (input) => input.replace(/^```[a-z]*\n/i, '').replace(/```$/, '').trim();

// --- Component: Project Viewer ---
const ProjectViewer = ({ project, onExit }) => {
  const iframeRef = useRef(null);
  useEffect(() => {
    if (iframeRef.current && project) {
      const doc = iframeRef.current.contentDocument;
      doc.open();
      const script = `<script>window.onerror = function(m){document.body.innerHTML='<div style="color:red;padding:20px;font-family:sans-serif"><h3>Runtime Error</h3>'+m+'</div>'}</script>`;
      doc.write(script + project.code);
      doc.close();
    }
  }, [project]);

  if (!project) return <div className="flex items-center justify-center h-screen text-slate-500">Loading Project...</div>;

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-slate-800">{project.title}</h1>
            <span className="text-xs text-slate-500 flex items-center gap-1"><Globe className="w-3 h-3" /> Hosted on Gemini Hub</span>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-slate-200 p-4 overflow-hidden">
        <div className="w-full h-full bg-white rounded-lg shadow-lg overflow-hidden border border-slate-300 relative">
          <iframe ref={iframeRef} title="Project View" className="w-full h-full border-0" sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin" />
        </div>
      </div>
    </div>
  );
};

// --- Component: Upload Form ---
const UploadForm = ({ onCancel, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(title, desc, code);
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <button onClick={onCancel} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Hub
      </button>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">New Project</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm px-4 py-2.5 border outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
            <textarea required value={desc} onChange={e => setDesc(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm px-4 py-2.5 border outline-none h-24 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Source Code</label>
            <textarea required value={code} onChange={e => setCode(e.target.value)} className="w-full bg-slate-900 text-slate-300 font-mono text-xs rounded-lg p-4 border border-slate-800 h-64" spellCheck="false" />
          </div>
          <div className="pt-4 flex justify-end gap-4">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg shadow-sm">
              {loading ? 'Deploying...' : 'Deploy Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Main App ---
export default function ProjectHub() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('list'); 
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreator, setIsCreator] = useState(false); 
  
  // NEW: Loading state to prevent "Flash of Access Denied"
  const [authLoading, setAuthLoading] = useState(true);

  // 1. Authentication 
  useEffect(() => {
    // Handle Google Redirect Result
    getRedirectResult(auth)
      .then((result) => {
        if (result) console.log("Redirect Login Success:", result.user.email);
      })
      .catch(err => console.error("Redirect error", err));

    // Listen for Auth Changes
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsCreator(!!u);
      setAuthLoading(false); // <--- STOP LOADING only when we know the result
    });
    
    return () => unsub();
  }, []);

  // 2. Data Sync
  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'hub_projects');
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setProjects(data);
    }, (error) => {
       console.log("Database Read Error:", error.message);
    });
    return () => unsub();
  }, []);

  // 3. Routing
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h.startsWith('#/project/')) {
        setActiveProjectId(h.replace('#/project/', ''));
        setView('view');
      } else if (h === '#/upload') {
        setView('upload');
        setActiveProjectId(null);
      } else {
        setView('list');
        setActiveProjectId(null);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigate = (path) => window.location.hash = path;

  const handleUpload = async (title, desc, code) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'hub_projects'), {
      title, description: desc, code: cleanCode(code), authorId: user.uid, createdAt: serverTimestamp()
    });
    navigate('#/');
  };

  const toggleLogin = async () => {
    if (!isCreator) {
      setAuthLoading(true); // Show spinner immediately
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } else {
      await signOut(auth);
    }
  };

  // View Logic
  const activeProject = projects.find(p => p.id === activeProjectId);
  const filteredProjects = projects.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- LOADING SCREEN ---
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Connecting to Google...</p>
      </div>
    );
  }
  // ----------------------

  if (view === 'view' && activeProject) return <ProjectViewer project={activeProject} onExit={() => navigate('#/')} />;

  if (view === 'upload') {
    if (!isCreator) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8 text-indigo-600" /></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Creator Access Only</h2>
            <p className="text-slate-500 mb-8">You must be logged in to contribute.</p>
            <button onClick={toggleLogin} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">Log In with Google</button>
            <button onClick={() => navigate('#/')} className="mt-4 text-slate-400 hover:text-slate-600 text-sm">Cancel</button>
          </div>
        </div>
      );
    }
    return <UploadForm onCancel={() => navigate('#/')} onSubmit={handleUpload} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('#/')}>
            <div className="bg-indigo-600 text-white p-1.5 rounded-md shadow-sm"><Box className="w-5 h-5" /></div>
            <span className="font-bold text-xl tracking-tight text-slate-800">GeminiHub</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Find projects..." className="pl-9 pr-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64 outline-none" />
            </div>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <button onClick={toggleLogin} className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${isCreator ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:bg-slate-100'}`}>
              {isCreator ? <User className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
              <span className="hidden sm:inline">{isCreator ? 'Creator' : 'Guest'}</span>
            </button>
            <button onClick={() => navigate('#/upload')} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md shadow-slate-200"><Plus className="w-4 h-4" /> New Project</button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Project Repository</h1>
          <p className="text-slate-500 max-w-2xl">A collection of web applications, tools, and experiments created with Gemini.</p>
        </div>
        {projects.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center bg-slate-50/50">
            <Layout className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No projects yet</h3>
            <button onClick={() => navigate('#/upload')} className="text-indigo-600 font-medium hover:underline">Upload Project</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(p => (
              <div key={p.id} onClick={() => navigate(`#/project/${p.id}`)} className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 hover:border-indigo-200 transition-all cursor-pointer flex flex-col h-[280px]">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><Code className="w-5 h-5" /></div>
                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1 group-hover:text-indigo-600">{p.title}</h3>
                  <p className="text-slate-500 text-sm line-clamp-3 leading-relaxed">{p.description}</p>
                </div>
                <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 group-hover:bg-white transition-colors flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded">Web App</span>
                  <span className="text-xs font-medium text-indigo-600 opacity-0 group-hover:opacity-100 flex items-center gap-1">Launch <ArrowLeft className="w-3 h-3 rotate-180" /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}