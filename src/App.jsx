import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, // <--- NEW: Needed for batch updating order
  doc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Layout, Plus, Code, ExternalLink, Box, 
  ArrowLeft, Lock, User, LogOut, Globe, Search, Loader2,
  Pencil, Trash2, GripVertical, Check // <--- NEW ICONS
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

// --- Configuration ---
// Define available accent colors
const COLORS = {
  indigo: { name: 'Indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', hover: 'hover:border-indigo-300', shadow: 'hover:shadow-indigo-200/50', ring: 'ring-indigo-500' },
  emerald: { name: 'Emerald', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', hover: 'hover:border-emerald-300', shadow: 'hover:shadow-emerald-200/50', ring: 'ring-emerald-500' },
  amber:   { name: 'Amber',   bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200',   hover: 'hover:border-amber-300',   shadow: 'hover:shadow-amber-200/50',   ring: 'ring-amber-500' },
  rose:    { name: 'Rose',    bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-200',    hover: 'hover:border-rose-300',    shadow: 'hover:shadow-rose-200/50',    ring: 'ring-rose-500' },
  cyan:    { name: 'Cyan',    bg: 'bg-cyan-50',    text: 'text-cyan-600',    border: 'border-cyan-200',    hover: 'hover:border-cyan-300',    shadow: 'hover:shadow-cyan-200/50',    ring: 'ring-cyan-500' },
  purple:  { name: 'Purple',  bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200',  hover: 'hover:border-purple-300',  shadow: 'hover:shadow-purple-200/50',  ring: 'ring-purple-500' },
};

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

// --- Component: Upload/Edit Form ---
const UploadForm = ({ initialData, onCancel, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState('indigo'); // Default color
  const [loading, setLoading] = useState(false);

  // FIX: Ensure form populates when initialData changes (switching between Edit/New)
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDesc(initialData.description || '');
      setCode(initialData.code || '');
      setColor(initialData.color || 'indigo');
    } else {
      // Reset if "New Project"
      setTitle('');
      setDesc('');
      setCode('');
      setColor('indigo');
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(title, desc, code, color);
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <button onClick={onCancel} className="text-slate-500 hover:text-slate-800 flex items-center gap-2 mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Hub
      </button>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? 'Edit Project' : 'New Project'}
          </h2>
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
          
          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Accent Color</label>
            <div className="flex gap-3">
              {Object.entries(COLORS).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${val.bg} ${color === key ? `ring-2 ring-offset-2 ${val.ring}` : 'hover:scale-110'}`}
                  title={val.name}
                >
                  {color === key && <Check className={`w-4 h-4 ${val.text}`} />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Source Code</label>
            <textarea required value={code} onChange={e => setCode(e.target.value)} className="w-full bg-slate-900 text-slate-300 font-mono text-xs rounded-lg p-4 border border-slate-800 h-64" spellCheck="false" />
          </div>
          <div className="pt-4 flex justify-end gap-4">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg shadow-sm">
              {loading ? 'Saving...' : (initialData ? 'Update Project' : 'Deploy Project')}
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
  const [authLoading, setAuthLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(null);

  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState(null);

  // 1. Authentication 
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsCreator(!!u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // 2. Data Sync (Sort by orderIndex)
  useEffect(() => {
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'hub_projects');
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort by orderIndex (ascending), fallback to createdAt
      data.sort((a, b) => {
        if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
          return a.orderIndex - b.orderIndex;
        }
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      
      setProjects(data);
    }, (error) => {
       console.log("DB Error:", error.message);
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
        if (editingProject) setEditingProject(null);
      } else {
        setView('list');
        setActiveProjectId(null);
        setEditingProject(null);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [editingProject]);

  const navigate = (path) => window.location.hash = path;

  // --- ACTIONS ---

  const handleSave = async (title, desc, code, color) => {
    if (editingProject) {
      // UPDATE
      const projectRef = doc(db, 'artifacts', appId, 'public', 'data', 'hub_projects', editingProject.id);
      await updateDoc(projectRef, {
        title,
        description: desc,
        code: cleanCode(code),
        color,
        updatedAt: serverTimestamp()
      });
    } else {
      // CREATE (Put at end of list)
      const newOrderIndex = projects.length; 
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'hub_projects'), {
        title, 
        description: desc, 
        code: cleanCode(code), 
        color,
        orderIndex: newOrderIndex,
        authorId: user.uid, 
        createdAt: serverTimestamp()
      });
    }
    setEditingProject(null);
    navigate('#/');
  };

  const handleEdit = (project, e) => {
    e.stopPropagation();
    setEditingProject(project);
    navigate('#/upload');
  };

  const handleDelete = async (projectId, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'hub_projects', projectId));
    }
  };

  // --- DRAG AND DROP LOGIC ---
  const handleDragStart = (e, index) => {
    setDraggedItem(projects[index]);
    e.dataTransfer.effectAllowed = "move";
    // Hide the ghost image a bit or style it if desired
    e.dataTransfer.setDragImage(e.target.parentNode, 20, 20);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    const draggedOverItem = projects[index];

    // If the item is dragged over itself, ignore
    if (draggedItem === draggedOverItem) return;

    // Filter out the dragged item
    let items = projects.filter(item => item !== draggedItem);

    // Add the dragged item at the new position
    items.splice(index, 0, draggedItem);

    setProjects(items);
  };

  const handleDragEnd = async () => {
    setDraggedItem(null);
    
    // Batch update Firestore with new orderIndices
    const batch = writeBatch(db);
    projects.forEach((proj, index) => {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'hub_projects', proj.id);
        batch.update(ref, { orderIndex: index });
    });
    
    try {
        await batch.commit();
        console.log("Order saved!");
    } catch (err) {
        console.error("Failed to save order", err);
    }
  };


  const toggleLogin = async () => {
    if (!isCreator) {
      setAuthLoading(true);
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("Login failed", error);
        setAuthLoading(false);
      }
    } else {
      await signOut(auth);
    }
  };

  // --- VIEW LOGIC ---
  const activeProject = projects.find(p => p.id === activeProjectId);
  const filteredProjects = projects.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase()));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Checking Access...</p>
      </div>
    );
  }

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
    return <UploadForm initialData={editingProject} onCancel={() => navigate('#/')} onSubmit={handleSave} />;
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
            <button onClick={() => { setEditingProject(null); navigate('#/upload'); }} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md shadow-slate-200"><Plus className="w-4 h-4" /> New Project</button>
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
            <button onClick={() => { setEditingProject(null); navigate('#/upload'); }} className="text-indigo-600 font-medium hover:underline">Upload Project</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((p, index) => {
               const theme = COLORS[p.color || 'indigo'];
               return (
              <div 
                key={p.id}
                onClick={() => navigate(`#/project/${p.id}`)}
                onDragOver={(e) => isCreator && handleDragOver(e, index)}
                className={`group bg-white border rounded-xl overflow-hidden transition-all cursor-pointer flex flex-col h-[280px] relative ${theme.border} ${theme.shadow} hover:shadow-xl`}
              >
                
                {/* --- CREATOR ACTIONS --- */}
                {isCreator && (
                  <div className="absolute top-3 right-3 flex gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* DRAG HANDLE */}
                    <div 
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-white text-slate-400 hover:text-slate-800 border border-slate-200 rounded-full shadow-sm cursor-grab active:cursor-grabbing"
                      title="Drag to Reorder"
                    >
                       <GripVertical className="w-4 h-4" />
                    </div>

                    <button 
                      onClick={(e) => handleEdit(p, e)}
                      className="p-2 bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-all"
                      title="Edit Project"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(p.id, e)}
                      className="p-2 bg-white text-slate-500 hover:text-red-600 border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-all"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* ----------------------- */}

                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme.bg} ${theme.text}`}>
                      <Code className="w-5 h-5" />
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                  </div>
                  <h3 className={`text-lg font-bold text-slate-900 mb-2 line-clamp-1 group-hover:${theme.text}`}>{p.title}</h3>
                  <p className="text-slate-500 text-sm line-clamp-3 leading-relaxed">{p.description}</p>
                </div>
                <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 group-hover:bg-white transition-colors flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded">Web App</span>
                  <span className={`text-xs font-medium opacity-0 group-hover:opacity-100 flex items-center gap-1 ${theme.text}`}>Launch <ArrowLeft className="w-3 h-3 rotate-180" /></span>
                </div>
              </div>
            )})}
          </div>
        )}
      </main>
    </div>
  );
}