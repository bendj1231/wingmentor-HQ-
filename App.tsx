
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Contact, NewContact, CustomGroup, AppLanguage, Tool, NewTool, AppSection, BoardItem, BoardLink } from './types';
import { INITIAL_CONTACTS, INITIAL_TOOLS, SUPPORTED_LANGUAGES, TRANSLATIONS } from './constants';
import ContactForm from './components/ContactForm';
import ContactCard from './components/ContactCard';
import Button from './components/Button';

// --- TYPES ---
type GroupMode = 'company' | 'position' | 'dateJoined';
type ViewMode = 'list' | 'grid';
type User = 'Benjamin' | 'Karl';

interface Task {
  id: string;
  title: string;
  assignedToId?: string;
  status: 'todo' | 'in-progress' | 'done';
  dueDate: string;
}

interface Objective {
  id: string;
  title: string;
  progress: number;
  status: 'On Track' | 'At Risk' | 'Behind';
}

// --- MOCK DATA ---
const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Q3 Financial Audit', status: 'in-progress', dueDate: '2024-10-15' },
  { id: '2', title: 'Client Onboarding Protocols', status: 'todo', dueDate: '2024-10-20' },
  { id: '3', title: 'Server Migration', status: 'done', dueDate: '2024-09-30' },
];

const INITIAL_OBJECTIVES: Objective[] = [
  { id: '1', title: 'Increase Annual Revenue by 25%', progress: 65, status: 'On Track' },
  { id: '2', title: 'Expand to European Market', progress: 30, status: 'At Risk' },
  { id: '3', title: 'Reduce Churn Rate to < 2%', progress: 88, status: 'On Track' },
  { id: '4', title: 'Hire 5 Senior Engineers', progress: 10, status: 'Behind' },
];

// Initial Whiteboard Data - Structured Hierarchy
const INITIAL_BOARD_ITEMS: BoardItem[] = [
  // 1. Objective on Top
  { id: '1', type: 'objective', content: 'Mission: Alpha Launch', x: 550, y: 50, isCompleted: false },
  
  // 2. Task Note (Sticky) in Center
  { id: '2', type: 'sticky', content: 'Core Task: Develop MVP', x: 600, y: 300, color: 'bg-yellow-200' },
  
  // 3. Idea Strips surrounding
  { id: '3', type: 'idea-strip', content: 'User Auth Flow', x: 250, y: 300 },
  { id: '4', type: 'idea-strip', content: 'Payment Gateway', x: 950, y: 300 },
  
  // 4. Finish Node at Bottom
  { id: '5', type: 'goal', content: 'Public Release', x: 630, y: 600, isCompleted: false },
];

const INITIAL_BOARD_LINKS: BoardLink[] = [
  { id: 'l1', fromId: '1', toId: '2', variant: 'critical' }, // Objective -> Task
  { id: 'l2', fromId: '3', toId: '2', variant: 'neutral' },  // Idea -> Task
  { id: 'l3', fromId: '4', toId: '2', variant: 'neutral' },  // Idea -> Task
  { id: 'l4', fromId: '2', toId: '5', variant: 'positive' }   // Task -> Goal
];

const App: React.FC = () => {
  // --- STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>('Benjamin');
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tools, setTools] = useState<Tool[]>(() => {
    const saved = localStorage.getItem('nexus_tools');
    return saved ? JSON.parse(saved) : INITIAL_TOOLS;
  });
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('nexus_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [objectives, setObjectives] = useState<Objective[]>(INITIAL_OBJECTIVES);

  // Lifted Board State
  const [boardTitle, setBoardTitle] = useState(() => localStorage.getItem('nexus_board_title') || 'Case File: #8841');
  const [boardItems, setBoardItems] = useState<BoardItem[]>(() => {
    const saved = localStorage.getItem('nexus_board_items');
    return saved ? JSON.parse(saved) : INITIAL_BOARD_ITEMS;
  });
  const [boardLinks, setBoardLinks] = useState<BoardLink[]>(() => {
    const saved = localStorage.getItem('nexus_board_links');
    return saved ? JSON.parse(saved) : INITIAL_BOARD_LINKS;
  });

  const [currentSection, setCurrentSection] = useState<AppSection>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>(undefined);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  
  // Tool Dashboard State
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [toolFormData, setToolFormData] = useState<NewTool>({
     name: '', url: '', description: '', iconUrl: '', category: 'General'
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('nexus_view_mode') as ViewMode) || 'list';
  });

  const [language, setLanguage] = useState<AppLanguage>(() => {
    return (localStorage.getItem('nexus_language') as AppLanguage) || 'en';
  });

  const t = (key: string) => TRANSLATIONS[language][key] || key;

  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(() => {
    const saved = localStorage.getItem('nexus_custom_groups');
    return saved ? JSON.parse(saved) : [];
  });

  const [groupMode, setGroupMode] = useState<GroupMode>(() => {
    return (localStorage.getItem('nexus_group_mode') as GroupMode) || 'company';
  });

  const [selectedGroup, setSelectedGroup] = useState<string | null>(() => {
    return localStorage.getItem('nexus_selected_group') || null;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('nexus_theme');
    return saved === 'dark';
  });

  // --- LOGIN COMPONENT ---
  const LoginScreen = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      const user = username.trim().toLowerCase();
      const pass = password.trim();
      
      if (user === 'benjamin' && (pass === 'RPC 1884' || pass === 'RPC1884')) {
        setCurrentUser('Benjamin');
        setIsAuthenticated(true);
      } else if (user === 'karl' && (pass === 'RPC 1993' || pass === 'RPC1993')) {
        setCurrentUser('Karl');
        setIsAuthenticated(true);
      } else {
        setError('Invalid Security Clearance');
      }
    };

    return (
      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className={`w-full max-w-md p-8 rounded-[2rem] shadow-2xl ${isDarkMode ? 'bg-slate-900 shadow-none border border-slate-800' : 'bg-white shadow-slate-200/50 border border-white'}`}>
          <div className="flex flex-col items-center mb-8">
            <div className="w-full flex justify-center mb-6">
              <img 
                src="https://lh3.googleusercontent.com/d/1KgVuIuCv8mKxTcJ4rClCUCdaQ3fxm0x6" 
                alt="WingMentor HQ" 
                className="h-24 w-auto object-contain" 
              />
            </div>
            <h1 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>WingMentor HQ</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Personnel Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Identity</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl outline-none border transition-all font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                placeholder="Username (Benjamin / Karl)"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Access Key</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl outline-none border transition-all font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                placeholder="Password"
              />
            </div>
            {error && (
              <p className="text-center text-xs font-bold text-red-500 animate-pulse">{error}</p>
            )}
            <Button className="w-full py-4 rounded-xl shadow-lg mt-4 font-bold tracking-wide uppercase text-xs" variant="primary">Authenticate</Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-center">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
               {isDarkMode ? (
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 16.243l.707.707M7.757 7.757l.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" /></svg>
               ) : (
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
               )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- EFFECT HOOKS ---
  useEffect(() => {
    const saved = localStorage.getItem('nexus_contacts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((c: any) => ({
          ...c,
          position: c.position || c.role || ''
        }));
        setContacts(migrated);
      } catch (e) {
        setContacts(INITIAL_CONTACTS);
      }
    } else {
      setContacts(INITIAL_CONTACTS);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nexus_language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const triggerSaveNotification = () => {
    setShowSaveIndicator(true);
    setTimeout(() => setShowSaveIndicator(false), 2000);
  };

  useEffect(() => {
    localStorage.setItem('nexus_contacts', JSON.stringify(contacts));
    if (contacts.length > 0) triggerSaveNotification();
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem('nexus_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('nexus_tools', JSON.stringify(tools));
  }, [tools]);

  useEffect(() => {
    localStorage.setItem('nexus_board_items', JSON.stringify(boardItems));
    localStorage.setItem('nexus_board_links', JSON.stringify(boardLinks));
    localStorage.setItem('nexus_board_title', boardTitle);
  }, [boardItems, boardLinks, boardTitle]);

  useEffect(() => {
    localStorage.setItem('nexus_custom_groups', JSON.stringify(customGroups));
    triggerSaveNotification();
  }, [customGroups]);

  useEffect(() => {
    localStorage.setItem('nexus_group_mode', groupMode);
    localStorage.setItem('nexus_view_mode', viewMode);
    if (selectedGroup) {
      localStorage.setItem('nexus_selected_group', selectedGroup);
    } else {
      localStorage.removeItem('nexus_selected_group');
    }
    triggerSaveNotification();
  }, [groupMode, selectedGroup, viewMode]);

  useEffect(() => {
    localStorage.setItem('nexus_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    triggerSaveNotification();
  }, [isDarkMode]);

  // --- MEMOIZED DATA ---
  const groups = useMemo(() => {
    if (groupMode === 'dateJoined') {
      const counts: Record<string, number> = {};
      contacts.forEach(c => {
        const key = c.dateJoined ? c.dateJoined.substring(0, 7) : 'Unspecified';
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([name, count]) => [name, count, name] as [string, number, string]);
    }

    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      const val = groupMode === 'company' ? c.company : c.position;
      const key = val || 'Unspecified';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => [name, count, name] as [string, number, string]);
  }, [contacts, groupMode]);

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const company = (c.company || '').toLowerCase();
      const position = (c.position || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      
      const matchesSearch = fullName.includes(query) || company.includes(query) || position.includes(query);
      
      let matchesGroup = true;
      if (selectedGroup) {
        if (groupMode === 'dateJoined') {
          matchesGroup = (c.dateJoined || 'Unspecified').startsWith(selectedGroup);
        } else {
          const val = groupMode === 'company' ? c.company : c.position;
          matchesGroup = (val || 'Unspecified') === selectedGroup;
        }
      }

      return matchesSearch && matchesGroup;
    }).sort((a, b) => {
      if (groupMode === 'dateJoined') {
        return (b.dateJoined || '').localeCompare(a.dateJoined || '');
      }
      return a.firstName.localeCompare(b.firstName);
    });
  }, [contacts, searchQuery, selectedGroup, groupMode]);

  const filteredTools = useMemo(() => {
    if (!searchQuery) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.description.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  // --- HANDLERS ---
  const handleAddOrUpdate = (data: NewContact | Contact) => {
    if ('id' in data) {
      setContacts(prev => prev.map(c => c.id === data.id ? (data as Contact) : c));
    } else {
      const newContact: Contact = {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: Date.now(),
        avatarUrl: data.avatarUrl || `https://picsum.photos/seed/${data.firstName + Date.now()}/200`
      } as Contact;
      setContacts(prev => [...prev, newContact]);
    }
    setIsFormOpen(false);
    setEditingContact(undefined);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this record permanently?')) {
      setContacts(prev => prev.filter(c => c.id !== id));
      if (filteredContacts.length <= 1) setSelectedGroup(null);
    }
  };

  const handleResetData = () => {
    if (window.confirm('WARNING: This will erase all contacts and groups permanently. Proceed?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const openAddForm = () => {
    setEditingContact(undefined);
    setIsFormOpen(true);
  };

  const toggleGroupMode = (mode: GroupMode) => {
    setGroupMode(mode);
    setSelectedGroup(null);
  };

  const ensureAbsoluteUrl = (url: string, platform?: 'instagram' | 'facebook') => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (platform === 'instagram' && url.startsWith('@')) return `https://instagram.com/${url.substring(1)}`;
    if (platform === 'facebook' && !url.includes('.com')) return `https://facebook.com/${url}`;
    return `https://${url}`;
  };

  const handleTaskAssign = (taskId: string, contactId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignedToId: contactId } : t));
  };

  const handleAddTool = (e: React.FormEvent) => {
    e.preventDefault();
    const newTool: Tool = {
      ...toolFormData,
      id: Math.random().toString(36).substr(2, 9)
    };
    setTools(prev => [...prev, newTool]);
    setIsToolModalOpen(false);
    setToolFormData({ name: '', url: '', description: '', iconUrl: '', category: 'General' });
  };

  // --- SUB-COMPONENTS ---
  
  const BrowserOverlay = () => {
    if (!activeTool) return null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-slate-900 shadow-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveTool(null)} 
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
              <img src={activeTool.iconUrl || `https://www.google.com/s2/favicons?domain=${activeTool.url}&sz=64`} className="w-6 h-6 rounded-lg" alt="" />
              <h3 className="font-bold text-white">{activeTool.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full border border-slate-700 text-xs text-slate-400 font-mono">
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               {activeTool.url}
             </div>
             <a 
               href={activeTool.url} 
               target="_blank" 
               rel="noopener noreferrer" 
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
             >
               {t('openExternal')}
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
             </a>
          </div>
        </div>
        <div className="flex-1 relative bg-white">
          <iframe 
            src={activeTool.url} 
            className="w-full h-full border-none"
            title={activeTool.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
          {/* Fallback info overlay if iframe fails to load due to X-Frame-Options */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10">
             <div className="flex flex-col items-center text-slate-400">
                <svg className="w-12 h-12 mb-4 animate-spin opacity-20" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p>Loading application interface...</p>
                <p className="text-xs mt-2 opacity-50 max-w-sm text-center">{t('browserError')}</p>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const CompanyOverview = () => {
    // Defines all apps with their icon view (idle) and widget view (hover)
    const apps = [
      {
        id: 'timeline',
        name: 'Timeline',
        color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
        widget: (
          <div className="space-y-4">
             <div className="flex items-center justify-between mb-4">
               <h4 className="font-bold text-slate-900 dark:text-white">Next Milestone</h4>
               <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded">Jan 2024</span>
             </div>
             <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                   <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm"></div>
                   <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 my-1"></div>
                </div>
                <div>
                   <p className="text-xs font-bold text-slate-900 dark:text-white">Launch & Go-to-Market</p>
                   <p className="text-[10px] text-slate-500">Formalize Products & Socials</p>
                </div>
             </div>
             <div className="mt-auto pt-2 text-xs font-bold text-emerald-500">View Roadmap &rarr;</div>
          </div>
        )
      },
      {
        id: 'mindmap',
        name: 'Mindmap',
        color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
        icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
        widget: (
          <div className="h-full flex flex-col">
             <h4 className="font-bold text-slate-900 dark:text-white mb-4">Structure</h4>
             <div className="flex-1 flex flex-col justify-center gap-2 items-center opacity-70">
                <div className="w-16 h-8 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg"></div>
                <div className="w-0.5 h-4 bg-indigo-200 dark:bg-indigo-800"></div>
                <div className="flex gap-2">
                   <div className="w-8 h-6 border-2 border-indigo-200 dark:border-indigo-800 rounded-md"></div>
                   <div className="w-8 h-6 border-2 border-indigo-200 dark:border-indigo-800 rounded-md"></div>
                </div>
             </div>
             <div className="mt-auto text-xs font-bold text-indigo-500 text-center">4 Depts Mapped</div>
          </div>
        )
      },
      {
        id: 'planning',
        name: 'Planning',
        color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
        widget: (
          <div className="space-y-3">
             <h4 className="font-bold text-slate-900 dark:text-white">Investigation Board</h4>
             <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500">Nodes</span>
                <span className="text-xs font-black text-violet-600">{boardItems.length}</span>
             </div>
             <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                <span className="text-[10px] font-bold text-slate-500">Connections</span>
                <span className="text-xs font-black text-violet-600">{boardLinks.length}</span>
             </div>
             <div className="mt-auto pt-2 text-xs font-bold text-violet-500">Enter War Room &rarr;</div>
          </div>
        )
      },
      {
        id: 'simulation',
        name: 'Simulator',
        color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        icon: 'M13 10V3L4 14h7v7l9-11h-7z',
        widget: (
          <div className="h-full flex flex-col relative overflow-hidden">
             <h4 className="font-bold text-slate-900 dark:text-white mb-2">Business Flow</h4>
             <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                <div className="w-10 h-10 rounded-full border-2 border-orange-400 flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm animate-pulse">
                   <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                </div>
                <div className="w-0.5 h-6 bg-orange-200 dark:bg-orange-900/50"></div>
                <div className="flex gap-2">
                   <div className="w-6 h-6 rounded border-2 border-slate-200 dark:border-slate-700"></div>
                   <div className="w-6 h-6 rounded border-2 border-slate-200 dark:border-slate-700"></div>
                </div>
             </div>
             <div className="mt-auto pt-1 text-xs font-bold text-orange-500 text-center">Run Simulation &rarr;</div>
          </div>
        )
      },
      {
        id: 'sales',
        name: 'Sales',
        color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        widget: (
          <div>
             <h4 className="font-bold text-slate-900 dark:text-white mb-2">Total Revenue</h4>
             <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mb-4">$842k</div>
             <div className="h-8 flex items-end gap-1 opacity-50">
               <div className="w-full bg-blue-500 h-[40%] rounded-t-sm"></div>
               <div className="w-full bg-blue-500 h-[70%] rounded-t-sm"></div>
               <div className="w-full bg-blue-500 h-[50%] rounded-t-sm"></div>
               <div className="w-full bg-blue-500 h-[90%] rounded-t-sm"></div>
             </div>
             <div className="mt-4 text-xs font-bold text-blue-500">+12% vs last month</div>
          </div>
        )
      },
      {
        id: 'marketing',
        name: 'Analytics',
        color: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
        icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
        widget: (
          <div className="space-y-3">
             <h4 className="font-bold text-slate-900 dark:text-white mb-1">Social Traction</h4>
             <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded text-center">
                   <div className="text-[10px] text-slate-400 font-bold">TikTok</div>
                   <div className="text-sm font-black text-pink-500">892K</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded text-center">
                   <div className="text-[10px] text-slate-400 font-bold">Downloads</div>
                   <div className="text-sm font-black text-pink-500">14.2k</div>
                </div>
             </div>
             <div className="mt-auto text-xs font-bold text-pink-500">View Data &rarr;</div>
          </div>
        )
      },
      {
        id: 'tasks',
        name: 'Tasks',
        color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
        widget: (
          <div className="space-y-3">
             <h4 className="font-bold text-slate-900 dark:text-white mb-2">Recent Tasks</h4>
             {tasks.slice(0, 2).map(task => (
               <div key={task.id} className="flex items-center gap-2">
                 <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'done' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                 <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">{task.title}</span>
               </div>
             ))}
             <div className="mt-auto pt-2 text-xs font-bold text-amber-500">{tasks.length} Active Items &rarr;</div>
          </div>
        )
      },
      {
        id: 'tools',
        name: 'Apps',
        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z',
        widget: (
          <div className="flex flex-col h-full">
             <h4 className="font-bold text-slate-900 dark:text-white mb-4">Company Tools</h4>
             <div className="flex -space-x-2 mb-4">
                {tools.slice(0, 3).map(tool => (
                   <div key={tool.id} className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 border-2 border-slate-50 dark:border-slate-900 flex items-center justify-center">
                      <img src={tool.iconUrl} className="w-4 h-4" alt="" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                   </div>
                ))}
             </div>
             <div className="mt-auto text-xs font-bold text-slate-500">{tools.length} Installed &rarr;</div>
          </div>
        )
      },
      {
        id: 'team',
        name: 'Team',
        color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
        widget: (
          <div className="flex flex-col h-full">
             <h4 className="font-bold text-slate-900 dark:text-white mb-2">Directory</h4>
             <div className="text-3xl font-black text-rose-500">{contacts.length || 24}</div>
             <span className="text-[10px] font-bold text-slate-400 mb-4">Active Members</span>
             <div className="mt-auto flex -space-x-2">
                {contacts.slice(0, 4).map(c => (
                  <img key={c.id} src={c.avatarUrl} className="w-6 h-6 rounded-full border border-white dark:border-slate-900" alt="" />
                ))}
             </div>
          </div>
        )
      }
    ];

    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="mb-10">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Platform Overview</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-medium">Access all applications. Hover for a quick preview.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {apps.map((app) => (
            <div 
              key={app.id}
              onClick={() => setCurrentSection(app.id as AppSection)}
              className="group relative h-48 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
            >
              {/* Default View: Icon & Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 transition-all duration-300 group-hover:opacity-0 group-hover:scale-90">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${app.color}`}>
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={app.icon} />
                  </svg>
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{app.name}</h3>
              </div>

              {/* Hover View: Widget Summary */}
              <div className="absolute inset-0 p-6 opacity-0 scale-105 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 bg-white dark:bg-slate-900">
                {app.widget}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SimulationView = () => (
    <div className="p-8 h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      
      {/* Background Operations Layer */}
      <div className="absolute top-20 flex gap-32 opacity-30 z-0">
        <div className="flex flex-col items-center gap-2">
          <div className="w-24 h-16 rounded-xl bg-slate-300 dark:bg-slate-700 flex items-center justify-center border-2 border-slate-400 border-dashed">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Marketing</span>
          </div>
          <svg className="w-1 h-24 text-slate-300" viewBox="0 0 4 100"><line x1="2" y1="0" x2="2" y2="100" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" /></svg>
        </div>
        <div className="flex flex-col items-center gap-2 mt-8">
          <div className="w-24 h-16 rounded-xl bg-slate-300 dark:bg-slate-700 flex items-center justify-center border-2 border-slate-400 border-dashed">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">CRM Mgmt</span>
          </div>
          <svg className="w-1 h-24 text-slate-300" viewBox="0 0 4 100"><line x1="2" y1="0" x2="2" y2="100" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" /></svg>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-24 h-16 rounded-xl bg-slate-300 dark:bg-slate-700 flex items-center justify-center border-2 border-slate-400 border-dashed">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Developers</span>
          </div>
          <svg className="w-1 h-24 text-slate-300" viewBox="0 0 4 100"><line x1="2" y1="0" x2="2" y2="100" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" /></svg>
        </div>
      </div>

      {/* Main Flow Layer */}
      <div className="relative z-10 flex flex-col items-center gap-20">
        
        {/* Node: WingMentor (Central Hub) */}
        <div className="relative group">
          <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
          <div className="w-40 h-40 rounded-full bg-white dark:bg-slate-900 border-8 border-blue-500 flex flex-col items-center justify-center shadow-2xl relative z-20">
            <img 
                src="https://lh3.googleusercontent.com/d/1KgVuIuCv8mKxTcJ4rClCUCdaQ3fxm0x6" 
                alt="Logo" 
                className="w-12 h-12 object-contain mb-2"
            />
            <span className="text-sm font-black uppercase tracking-tighter text-slate-900 dark:text-white">WingMentor</span>
            <span className="text-[9px] font-bold text-slate-400">HQ Core</span>
          </div>
          
          {/* Vertical Connection to Program */}
          <div className="absolute left-1/2 top-full -translate-x-1/2 h-20 w-1 bg-gradient-to-b from-blue-500 to-emerald-500"></div>
        </div>

        {/* Node: Program (Product) */}
        <div className="relative">
           <div className="w-64 h-32 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500 rounded-2xl flex flex-col items-center justify-center shadow-xl p-4">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">The Product</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white text-center">WingMentor Program</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-2 max-w-[200px]">Aviation career acceleration & mentorship path</p>
           </div>
        </div>

      </div>

      {/* Client Interaction Layer */}
      <div className="absolute bottom-20 right-1/4 translate-x-1/2 flex items-center gap-4">
         <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 border-4 border-slate-400 flex items-center justify-center">
               <svg className="w-8 h-8 text-slate-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-2 uppercase">Mentee / Client</span>
         </div>

         {/* Arrow of Interest */}
         <div className="flex flex-col items-center -mt-12 -ml-4">
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1 animate-bounce">Interest</span>
            <svg className="w-32 h-12 text-orange-400" viewBox="0 0 100 40" fill="none">
               <path d="M100 20 L0 20" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="animate-[dash_1s_linear_infinite]" />
               <path d="M10 10 L0 20 L10 30" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
         </div>
      </div>

      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: 8; }
        }
      `}</style>
    </div>
  );

  const TimelineView = () => (
    <div className="p-8 pb-96">
      <div className="flex items-center justify-between mb-8">
        <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>WingMentor Journey</h2>
        <span className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest">Roadmap</span>
      </div>
      
      <div className="space-y-8 pl-4 border-l-2 border-slate-200 dark:border-slate-800 relative">
        {[
          { 
            date: 'July', 
            year: '2023',
            title: 'Inception', 
            desc: 'Initial concept generation for a comprehensive aviation mentorship program.', 
            status: 'completed' 
          },
          { 
            date: 'August', 
            year: '2023',
            title: 'Validation & Utility', 
            desc: 'Formalizing the program structure and identifying core utility for pilot career progression.', 
            status: 'completed' 
          },
          { 
            date: 'October', 
            year: '2023',
            title: 'Brand Identity', 
            desc: 'Development of visual identity, logos, and official formation of the WingMentor brand.', 
            status: 'completed' 
          },
          { 
            date: 'November', 
            year: '2023',
            title: 'AI Integration & Architecture', 
            desc: 'Began mastering Google Studio AI and architecting the WingMentor app ecosystem.', 
            status: 'completed' 
          },
          { 
            date: 'December', 
            year: '2023',
            title: 'Platform Development', 
            desc: 'Achieved full development of the mobile and desktop application MVP.', 
            status: 'completed' 
          },
          { 
            date: 'January', 
            year: '2024',
            title: 'Launch & Go-to-Market', 
            desc: 'Formalizing product sales points, establishing social media presence, and content marketing. Finalizing core products: Books, Programs, Simulators, and Pilot Database (CPL, PPL, IR, ME). Targeting aspiring aviators on the traditional flight instructor route. Core Mission: We provide consultation, support, and guidance—not direct flight instruction.', 
            status: 'active' 
          }
        ].map((item, i) => (
          <div key={i} className="relative pl-8 group">
             {/* Timeline Dot */}
             <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 transition-all duration-300 z-10 bg-slate-50 dark:bg-slate-950 ${
               item.status === 'active' 
                 ? 'border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.2)] scale-110' 
                 : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-400'
             }`}>
               {item.status === 'completed' && (
                 <div className="w-full h-full bg-slate-300 dark:bg-slate-600 rounded-full scale-50"></div>
               )}
               {item.status === 'active' && (
                 <div className="w-full h-full bg-blue-500 rounded-full scale-50 animate-pulse"></div>
               )}
             </div>
             
             {/* Content Card */}
             <div className={`p-5 rounded-2xl border transition-all duration-300 ${
               item.status === 'active'
                 ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/30 shadow-lg shadow-blue-500/5'
                 : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'
             }`}>
               <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-2">
                 <span className={`text-sm font-black uppercase tracking-widest ${item.status === 'active' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                   {item.date} {item.year}
                 </span>
                 <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
               </div>
               <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                 {item.desc}
               </p>
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  const MindmapView = () => (
     <div className="p-8 h-full flex flex-col">
       <div className="flex-1 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          <div className="flex flex-col items-center gap-8 relative z-10">
             <div className="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/30">Central Node</div>
             <div className="flex gap-12 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 w-px h-8 bg-slate-300 dark:bg-slate-600"></div>
                <div className="absolute top-0 left-12 right-12 -translate-y-8 h-px bg-slate-300 dark:bg-slate-600"></div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex flex-col items-center">
                     <div className="w-px h-8 bg-slate-300 dark:bg-slate-600 -mt-8 mb-0"></div>
                     <div className={`px-5 py-2 rounded-lg border font-bold text-sm ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>Branch {i}</div>
                  </div>
                ))}
             </div>
          </div>
       </div>
     </div>
  );

  const SalesView = () => (
    <div className="p-8">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Revenue', value: '$842,000', change: '+12%', color: 'blue' },
            { label: 'New Deals', value: '24', change: '+5%', color: 'emerald' },
            { label: 'Conversion Rate', value: '18.2%', change: '-2%', color: 'rose' },
          ].map((stat, i) => (
             <div key={i} className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <div className="flex items-end justify-between mt-2">
                   <h3 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stat.value}</h3>
                   <span className={`text-xs font-bold px-2 py-1 rounded bg-${stat.color}-100 text-${stat.color}-600`}>{stat.change}</span>
                </div>
             </div>
          ))}
       </div>
       <div className={`h-96 rounded-[2rem] border flex items-center justify-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <p className="text-slate-400 font-bold">Sales Performance Chart Placeholder</p>
       </div>
    </div>
  );

  const MarketingView = () => {
    // Analytics Dashboard Data
    const socialStats = [
      { id: 'tiktok', name: 'TikTok', count: '892.4k', trend: '+12%', color: 'text-pink-500', bg: 'bg-black text-white', icon: (
        <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.35-1.17 1.09-1.24 1.9-.04.65.04 1.4.55 1.87.67.63 1.8.71 2.65.28.8-.4 1.37-1.25 1.39-2.15V.02h2z" /></svg>
      )},
      { id: 'fb', name: 'Facebook', count: '124.2k', trend: '+3%', color: 'text-blue-500', bg: 'bg-blue-600 text-white', icon: (
        <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      )},
      { id: 'insta', name: 'Instagram', count: '450.8k', trend: '+8%', color: 'text-pink-600', bg: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 text-white', icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
      )},
      { id: 'twitter', name: 'Twitter / X', count: '210.5k', trend: '-2%', color: 'text-slate-500', bg: 'bg-black text-white', icon: (
        <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      )},
      { id: 'forums', name: 'Forums', count: '54.2k', trend: '+15%', color: 'text-purple-500', bg: 'bg-purple-600 text-white', icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
      )},
      { id: 'shop', name: 'Shop Site', count: '32.1k', trend: '+24%', color: 'text-emerald-500', bg: 'bg-emerald-600 text-white', icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
      )}
    ];

    return (
      <div className="p-8 pb-32 max-w-[1600px] mx-auto space-y-8">
         {/* Social Traction Section */}
         <div>
            <div className="flex items-center justify-between mb-6">
               <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Social Media Traction</h3>
               <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Metrics</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
               {socialStats.map(stat => (
                  <div key={stat.id} className={`p-4 rounded-2xl border transition-all hover:shadow-lg ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-blue-200'}`}>
                     <div className="flex items-start justify-between mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${stat.bg}`}>
                           {stat.icon}
                        </div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${stat.trend.startsWith('+') ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                           {stat.trend}
                        </span>
                     </div>
                     <div className="text-2xl font-black text-slate-900 dark:text-white mb-1">{stat.count}</div>
                     <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.name}</div>
                  </div>
               ))}
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* App Ecosystem Downloads */}
            <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
               <h3 className={`text-xl font-black mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>App Ecosystem Downloads</h3>
               <div className="flex flex-col md:flex-row gap-8">
                  {/* Desktop App */}
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                           <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-6 h-6" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                           <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Desktop App</div>
                           <div className="text-2xl font-black text-slate-900 dark:text-white">142,893</div>
                        </div>
                     </div>
                     <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: '75%' }}></div>
                     </div>
                     <div className="mt-2 text-[10px] font-bold text-right text-blue-500">75% Conversion from Web</div>
                  </div>

                  {/* Mobile App */}
                  <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/20">
                           <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-6 h-6" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                           <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Mobile App</div>
                           <div className="text-2xl font-black text-slate-900 dark:text-white">89,204</div>
                        </div>
                     </div>
                     <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: '45%' }}></div>
                     </div>
                     <div className="mt-2 text-[10px] font-bold text-right text-purple-500">45% Conversion from Web</div>
                  </div>
               </div>
            </div>

            {/* Inbound Traffic Sources */}
            <div className={`p-8 rounded-[2.5rem] border flex flex-col justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
               <div>
                  <h3 className={`text-xl font-black mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Referral Traffic</h3>
                  <p className="text-xs text-slate-500 font-bold mb-6">Inbound Link Performance</p>
               </div>
               
               <div className="space-y-6">
                  <div>
                     <div className="flex justify-between text-sm font-bold mb-2">
                        <span className="text-slate-500">Program Referral Links</span>
                        <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>24,500</span>
                     </div>
                     <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: '65%' }}></div>
                     </div>
                  </div>
                  <div>
                     <div className="flex justify-between text-sm font-bold mb-2">
                        <span className="text-slate-500">Shortcut Clicks (Direct)</span>
                        <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>12,105</span>
                     </div>
                     <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: '35%' }}></div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Aviation Search Engine Stats */}
         <div className={`relative p-10 rounded-[3rem] overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-blue-600'}`}>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
               <div>
                  <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-white text-[10px] font-black uppercase tracking-widest mb-4">Core Utility</div>
                  <h3 className="text-3xl md:text-4xl font-black text-white mb-2">Aviation Search Engine</h3>
                  <p className="text-blue-100 font-medium max-w-md">Total unique users utilizing the integrated aviation database search tools this month.</p>
               </div>
               <div className="text-center md:text-right">
                  <div className="text-6xl md:text-7xl font-black text-white tracking-tighter">42.8k</div>
                  <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">Active Users</span>
               </div>
            </div>
            
            {/* Background Decor */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-black opacity-10 rounded-full blur-3xl"></div>
         </div>
      </div>
    );
  };

  const ObjectivesView = () => (
    <div className="p-8">
       <div className="grid gap-4">
          {objectives.map(obj => (
             <div key={obj.id} className={`p-6 rounded-2xl border flex items-center gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${
                  obj.status === 'On Track' ? 'bg-emerald-100 text-emerald-600' : 
                  obj.status === 'At Risk' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                }`}>
                   {obj.progress}%
                </div>
                <div className="flex-1">
                   <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{obj.title}</h3>
                   <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full rounded-full ${
                        obj.status === 'On Track' ? 'bg-emerald-500' : 
                        obj.status === 'At Risk' ? 'bg-amber-500' : 'bg-rose-500'
                      }`} style={{ width: `${obj.progress}%` }}></div>
                   </div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${
                   obj.status === 'On Track' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 
                   obj.status === 'At Risk' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'
                }`}>{obj.status}</span>
             </div>
          ))}
       </div>
    </div>
  );
  
  const PlanningView = () => {
    // Uses lifted state `boardItems` and `setBoardItems`
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [pendingLinkStart, setPendingLinkStart] = useState<string | null>(null);
    const [activeLinkVariant, setActiveLinkVariant] = useState<BoardLink['variant']>('critical');
    const [boardBackground, setBoardBackground] = useState<'stone' | 'blue'>('stone');
    const containerRef = useRef<HTMLDivElement>(null);

    const handleAddItem = (type: BoardItem['type'], parentId?: string) => {
      let startX = 400;
      let startY = 300;
      
      startX += Math.random() * 50 - 25;
      startY += Math.random() * 50 - 25;

      const newItem: BoardItem = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        content: type === 'image' ? 'https://picsum.photos/300/200' : (
          type === 'sticky' ? 'Note' : 
          (type === 'objective' ? 'New Objective' : 
          (type === 'idea-strip' ? 'New Idea Strip' : 
          (type === 'goal' ? 'New Goal' : 'Card')))
        ),
        x: startX,
        y: startY,
        color: type === 'sticky' ? 'bg-yellow-200' : undefined,
        isCompleted: false
      };
      setBoardItems(prev => [...prev, newItem]);
      setSelectedId(newItem.id);
    };

    const handleUpdateItem = (id: string, updates: Partial<BoardItem>) => {
      setBoardItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    };

    const handleDeleteItem = (id: string) => {
      setBoardItems(prev => prev.filter(item => item.id !== id));
      setBoardLinks(prev => prev.filter(l => l.fromId !== id && l.toId !== id));
      if (selectedId === id) setSelectedId(null);
    };

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      // Link Logic: If shift is held, or pending link exists
      if (e.shiftKey) {
        if (pendingLinkStart && pendingLinkStart !== id) {
           // Create Link
           const newLink: BoardLink = {
             id: Math.random().toString(36).substr(2, 9),
             fromId: pendingLinkStart,
             toId: id,
             variant: activeLinkVariant
           };
           setBoardLinks(prev => [...prev, newLink]);
           setPendingLinkStart(null);
        } else {
           setPendingLinkStart(id);
        }
        return;
      }

      setPendingLinkStart(null);
      const item = boardItems.find(i => i.id === id);
      if (!item) return;
      setSelectedId(id);
      setDraggingId(id);
    };

    const handleContainerMouseMove = (e: React.MouseEvent) => {
      if (draggingId) {
        setBoardItems(prev => prev.map(item => {
          if (item.id === draggingId) {
            return {
              ...item,
              x: item.x + e.movementX,
              y: item.y + e.movementY
            };
          }
          return item;
        }));
      }
    };

    const handleContainerMouseUp = () => {
      setDraggingId(null);
    };

    const toggleCompletion = (id: string) => {
       const item = boardItems.find(i => i.id === id);
       if (item) handleUpdateItem(id, { isCompleted: !item.isCompleted });
    };

    const connections = useMemo(() => {
      return boardLinks.map(link => {
        const from = boardItems.find(i => i.id === link.fromId);
        const to = boardItems.find(i => i.id === link.toId);
        
        if (!from || !to) return null;

        // Approximate center based on type
        const getCenter = (item: BoardItem) => {
           // Adjusted for new types
           let w = 160, h = 160;
           if (item.type === 'image') { w = 256; h = 200; }
           else if (item.type === 'text') { w = 180; h = 60; }
           else if (item.type === 'objective') { w = 256; h = 140; } // Adjusted height for folder
           else if (item.type === 'idea-strip') { w = 256; h = 64; }
           else if (item.type === 'goal') { w = 160; h = 160; }
           
           return { x: item.x + w/2, y: item.y + h/2 };
        };

        const p1 = getCenter(from);
        const p2 = getCenter(to);

        const colorMap = {
           critical: '#ef4444', // Red
           positive: '#22c55e', // Green
           alternative: '#3b82f6', // Blue
           neutral: '#9ca3af' // Gray
        };

        // Calculate "String" Curve (Quadratic Bezier)
        // Adds a gravity effect (sag) to lines to look like strings
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Sag amount
        const sag = Math.min(dist * 0.2, 100); 
        const controlY = midY + sag;

        return (
          <g key={link.id}>
             <path 
              d={`M ${p1.x} ${p1.y} Q ${midX} ${controlY} ${p2.x} ${p2.y}`}
              stroke={colorMap[link.variant]}
              strokeWidth="2"
              fill="none"
              className="drop-shadow-sm opacity-90"
              strokeLinecap="round"
            />
            {/* Dots */}
            <circle cx={p1.x} cy={p1.y} r="3" fill={colorMap[link.variant]} className="shadow-sm" />
            <circle cx={p2.x} cy={p2.y} r="3" fill={colorMap[link.variant]} className="shadow-sm" />
          </g>
        );
      });
    }, [boardItems, boardLinks]);

    const handlePrint = () => {
       window.print();
    };

    return (
      <div className={`flex flex-col h-full relative overflow-hidden font-serif planning-board transition-colors duration-500 ${boardBackground === 'stone' ? 'bg-[#1c1917]' : 'bg-[#0f172a]'}`}>
        {/* Dark Corkboard Texture Effect */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` 
        }}></div>

        {/* Legend Overlay */}
        <div className="absolute bottom-8 right-8 z-30 p-4 bg-stone-900/90 backdrop-blur border border-stone-700 rounded-xl shadow-2xl pointer-events-none no-print min-w-[200px]">
           <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 border-b border-stone-700 pb-2">Mission Legend</h4>
           <div className="space-y-2">
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 rounded-full bg-red-500"></div>
                 <span className="text-xs font-bold text-stone-300">Critical Path</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 rounded-full bg-green-500"></div>
                 <span className="text-xs font-bold text-stone-300">Positive Outcome</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                 <span className="text-xs font-bold text-stone-300">Alternative Route</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                 <span className="text-xs font-bold text-stone-300">Neutral / Optional</span>
              </div>
           </div>
        </div>

        {/* Header - Editable */}
        <div className="absolute top-6 left-8 z-30 no-print">
           <input 
             value={boardTitle}
             onChange={(e) => setBoardTitle(e.target.value)}
             className="bg-transparent text-white/50 focus:text-white text-xl font-black uppercase tracking-widest outline-none border-b border-transparent focus:border-white/20 transition-all placeholder-white/20 w-80"
             placeholder="UNTITLED OPERATION"
           />
        </div>

        {/* Detective Toolbar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 p-2 rounded-xl bg-stone-800 border-2 border-stone-600 shadow-2xl no-print">
          {/* Node Types */}
          <div className="flex gap-2 pr-4 border-r border-stone-600">
             <button onClick={() => handleAddItem('objective')} className="flex flex-col items-center group" title="Add Objective">
                <div className="w-10 h-10 bg-emerald-900/50 border border-emerald-500/50 rounded flex items-center justify-center text-emerald-400 group-hover:bg-emerald-900 group-hover:text-emerald-300 transition-colors">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-[8px] font-bold text-stone-400 uppercase mt-1">Goal</span>
             </button>
             <button onClick={() => handleAddItem('idea-strip')} className="flex flex-col items-center group" title="Add Idea Strip">
                <div className="w-10 h-10 bg-stone-100 border border-stone-300 rounded shadow-sm flex items-center justify-center group-hover:-translate-y-0.5 transition-transform">
                   <div className="w-6 h-2 bg-stone-300 rounded-sm"></div>
                </div>
                <span className="text-[8px] font-bold text-stone-400 uppercase mt-1">Strip</span>
             </button>
             <button onClick={() => handleAddItem('sticky')} className="flex flex-col items-center group" title="Add Note">
                <div className="w-10 h-10 bg-yellow-200 border border-yellow-400 shadow-sm flex items-center justify-center group-hover:-translate-y-0.5 transition-transform"></div>
                <span className="text-[8px] font-bold text-stone-400 uppercase mt-1">Note</span>
             </button>
             <button onClick={() => handleAddItem('goal')} className="flex flex-col items-center group" title="Add Finish Flag">
                <div className="w-10 h-10 bg-white border-2 border-black shadow-sm flex items-center justify-center group-hover:-translate-y-0.5 transition-transform overflow-hidden">
                   <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHZpZXdCb3g9IjAgMCA4IDgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMSIvPjwvc3ZnPg==')] opacity-20"></div>
                   <svg className="w-5 h-5 absolute text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M4 15a1 1 0 001 1h1v4a1 1 0 002 0v-4h1l.22.44c.6 1.2 1.96 1.81 3.28 1.54l5.3-1.06a1 1 0 00.8-1V5.07a1 1 0 00-1.2-.98l-5.3 1.06c-1.32.27-2.68-.34-3.28-1.54L9 3.16V3a1 1 0 00-2 0v1H6a1 1 0 00-1 1v10z"/></svg>
                </div>
                <span className="text-[8px] font-bold text-stone-400 uppercase mt-1">Finish</span>
             </button>
             <button onClick={() => handleAddItem('image')} className="flex flex-col items-center group" title="Add Photo">
                <div className="w-10 h-10 bg-stone-200 border-2 border-white shadow-sm flex items-center justify-center group-hover:-translate-y-0.5 transition-transform overflow-hidden">
                   <div className="w-full h-full bg-stone-400"></div>
                </div>
                <span className="text-[8px] font-bold text-stone-400 uppercase mt-1">Pic</span>
             </button>
          </div>

          {/* Connection Colors */}
          <div className="flex flex-col items-center px-2">
             <div className="flex gap-2 bg-stone-900 p-1.5 rounded-lg border border-stone-700">
                {([['critical', 'bg-red-500'], ['positive', 'bg-green-500'], ['alternative', 'bg-blue-500'], ['neutral', 'bg-stone-400']] as const).map(([variant, colorClass]) => (
                   <button 
                     key={variant}
                     onClick={() => setActiveLinkVariant(variant as any)}
                     className={`w-4 h-4 rounded-full ${colorClass} ${activeLinkVariant === variant ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-100'}`}
                     title={`${variant} line`}
                   />
                ))}
             </div>
             <span className="text-[8px] font-bold text-stone-500 uppercase mt-1">Ink Color</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pl-4 border-l border-stone-600">
             <button onClick={() => setBoardBackground(prev => prev === 'stone' ? 'blue' : 'stone')} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-white transition-colors" title="Toggle Background">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.357 1.657 1.357" /></svg>
             </button>
             <button onClick={() => { setBoardItems([]); setBoardLinks([]); }} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-red-400 transition-colors" title="Clear Board">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </button>
             <button onClick={handlePrint} className="p-2 hover:bg-stone-700 rounded text-stone-400 hover:text-blue-400 transition-colors" title="Print / Export">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
             </button>
          </div>
        </div>

        {/* Pending Link Indicator */}
        {pendingLinkStart && (
           <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold animate-pulse shadow-lg pointer-events-none no-print">
              Select target node (Shift + Click to cancel)
           </div>
        )}

        {/* Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseMove={handleContainerMouseMove}
          onMouseUp={handleContainerMouseUp}
          onMouseLeave={handleContainerMouseUp}
          onClick={() => { setSelectedId(null); setPendingLinkStart(null); }}
        >
          {/* SVG Layer for Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
            {connections}
            {/* Draw pending line if needed (advanced feature omitted for simplicity, relying on cursor hint) */}
          </svg>

          {/* Items */}
          {boardItems.map((item, index) => {
             // Generate a deterministic random rotation based on ID
             const rotation = (parseInt(item.id.substr(0, 4), 36) % 6) - 3;
             const isSelected = selectedId === item.id;
             const isLinkingSource = pendingLinkStart === item.id;
             
             return (
            <div
              key={item.id}
              className={`absolute group touch-none select-none transition-shadow duration-200 z-10 ${
                isSelected ? 'z-50' : ''
              }`}
              style={{ 
                left: item.x, 
                top: item.y,
                transform: `rotate(${rotation}deg)`
              }}
              onMouseDown={(e) => handleMouseDown(e, item.id)}
            >
              <div className={`relative ${isSelected ? 'ring-4 ring-blue-500/50' : (isLinkingSource ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-black' : '')}`}>
                
                {/* Context Menu for Selected Item */}
                {isSelected && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1 bg-stone-800 p-1.5 rounded shadow-xl border border-stone-600 z-50 no-print">
                     {/* Complete/Stamp Toggle (Only for Objective/Sticky/Card/Goal/IdeaStrip) */}
                     {item.type !== 'image' && (
                       <button onClick={(e) => { e.stopPropagation(); toggleCompletion(item.id); }} className={`p-1 rounded ${item.isCompleted ? 'bg-green-900 text-green-400' : 'hover:bg-stone-700 text-stone-300'}`} title="Toggle Stamp">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       </button>
                     )}
                     <div className="w-px bg-stone-600 mx-1"></div>
                     <button onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} className="p-1 hover:bg-red-900/50 rounded text-red-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     </button>
                  </div>
                )}

                {/* --- ITEM RENDERERS --- */}

                {/* 0. Objective (Target Folder) */}
                {item.type === 'objective' && (
                   <div className="w-64 bg-[#1e293b] border-2 border-stone-500 rounded-lg shadow-2xl flex flex-col overflow-hidden relative">
                      {/* Folder Tab */}
                      <div className="h-6 bg-stone-600 w-24 rounded-tr-lg mb-[-1px] z-10 flex items-center px-2">
                         <span className="text-[8px] font-black text-white uppercase tracking-wider">Top Secret</span>
                      </div>
                      <div className="bg-[#0f172a] p-4 flex-1 border-t border-stone-600 relative">
                         {item.isCompleted && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                               <div className="border-4 border-green-500 text-green-500 font-black text-2xl px-4 py-2 uppercase transform -rotate-12 opacity-80" style={{ mixBlendMode: 'plus-lighter', maskImage: 'url(https://grainy-gradients.vercel.app/noise.svg)' }}>
                                  COMPLETED
                               </div>
                            </div>
                         )}
                         <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-red-900/50 border border-red-500 flex items-center justify-center text-red-500">
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <span className="text-xs font-bold text-slate-300 uppercase">Mission Objective</span>
                         </div>
                         <textarea 
                           value={item.content}
                           onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })}
                           className="w-full bg-transparent resize-none outline-none font-mono text-sm leading-snug text-white placeholder-slate-600 h-16"
                           placeholder="Define objective..."
                           onMouseDown={(e) => e.stopPropagation()} 
                         />
                      </div>
                   </div>
                )}

                {/* 1. Idea Strip (Wide Paper) */}
                {item.type === 'idea-strip' && (
                   <div className="w-64 h-16 bg-[#fdfbf7] shadow-md border border-stone-300 flex items-center px-4 relative">
                      {/* Tape Visuals */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-10 bg-white/40 border-l border-r border-white/20 shadow-sm rotate-3 backdrop-blur-[1px]"></div>
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-10 bg-white/40 border-l border-r border-white/20 shadow-sm -rotate-2 backdrop-blur-[1px]"></div>
                      
                      {item.isCompleted && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                           <div className="border-2 border-green-800 text-green-800 font-black text-xs px-2 py-0.5 uppercase transform -rotate-2 opacity-60">
                              DONE
                           </div>
                        </div>
                      )}
                      <input 
                        value={item.content}
                        onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })}
                        className="w-full bg-transparent outline-none text-sm font-serif font-bold text-stone-800 text-center placeholder-stone-400"
                        placeholder="New Idea..."
                        onMouseDown={(e) => e.stopPropagation()} 
                      />
                   </div>
                )}

                {/* 2. Goal (Racing Flag) */}
                {item.type === 'goal' && (
                   <div className="w-40 h-40 bg-white border-4 border-black flex flex-col items-center relative shadow-2xl overflow-hidden group-hover:scale-105 transition-transform">
                      {/* Checkered Pattern Header */}
                      <div className="absolute inset-x-0 top-0 h-6 w-full" style={{ backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiIHZpZXdCb3g9IjAgMCA4IDgiPjxwYXRoIGQ9Ik0wIDBoNHY0SDB6bTQgNGg0djRINHoiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMSIvPjwvc3ZnPg==")` }}></div>
                      
                      {item.isCompleted && (
                         <div className="absolute inset-0 bg-yellow-400/20 z-10 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="bg-black text-white px-3 py-1 font-black uppercase text-xl transform -rotate-12 border-4 border-white shadow-xl">
                               WIN
                            </div>
                         </div>
                      )}

                      <div className="flex-1 flex flex-col items-center justify-center pt-6 px-2 w-full">
                         <span className="text-2xl font-black italic uppercase tracking-tighter leading-none mb-2">FINISH</span>
                         <textarea 
                           value={item.content}
                           onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })}
                           className="w-full bg-transparent resize-none outline-none font-sans font-bold text-xs text-center text-stone-600 placeholder-stone-400 h-12"
                           placeholder="Goal Name"
                           onMouseDown={(e) => e.stopPropagation()} 
                         />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-2 bg-black"></div>
                   </div>
                )}

                {/* 3. Sticky Note (Clue) */}
                {item.type === 'sticky' && (
                  <div className={`w-40 h-40 p-4 shadow-xl ${item.color || 'bg-yellow-200'} text-slate-900 transform transition-transform hover:scale-105`}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-sm border border-red-700 z-20"></div> {/* Pin */}
                    {item.isCompleted && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                           <div className="border-4 border-red-800 text-red-900 font-black text-xl px-2 py-1 uppercase transform -rotate-12 opacity-70">
                              SOLVED
                           </div>
                        </div>
                     )}
                    <textarea 
                      value={item.content}
                      onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })}
                      className="w-full h-full bg-transparent resize-none outline-none font-serif text-lg leading-snug placeholder-slate-500/50"
                      placeholder="Clue details..."
                      onMouseDown={(e) => e.stopPropagation()} 
                    />
                  </div>
                )}

                {/* 4. Text Card (Legacy) */}
                {item.type === 'text' && (
                  <div className="bg-white px-4 py-3 min-w-[180px] max-w-[240px] shadow-lg border border-stone-300 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-8 bg-slate-200/50 border border-slate-300 transform -rotate-2"></div> {/* Tape */}
                    {item.isCompleted && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                           <div className="border-2 border-slate-800 text-slate-900 font-black text-lg px-2 uppercase transform -rotate-6 opacity-60 bg-white/50">
                              VERIFIED
                           </div>
                        </div>
                     )}
                    <input 
                      value={item.content}
                      onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })}
                      className="w-full bg-transparent outline-none text-base font-bold font-mono text-slate-800 text-center"
                      placeholder="SUSPECT NAME"
                      onMouseDown={(e) => e.stopPropagation()} 
                    />
                  </div>
                )}

                {/* 5. Polaroid (Evidence) */}
                {item.type === 'image' && (
                  <div className="p-3 pb-8 bg-white shadow-xl border border-stone-200 w-64 transform transition-transform hover:scale-105">
                     <div className="absolute -top-2 right-1/2 translate-x-1/2 w-32 h-8 bg-rose-500/30 rotate-2 mix-blend-multiply"></div> {/* Tape */}
                    <div className="w-full h-40 bg-stone-100 overflow-hidden mb-2 filter sepia-[.3] contrast-125">
                       <img src={item.content} alt="" className="w-full h-full object-cover" />
                    </div>
                    <input 
                      value={item.content}
                      onChange={(e) => handleUpdateItem(item.id, { content: e.target.value })}
                      className="w-full text-center text-xs font-handwriting text-slate-500 outline-none bg-transparent"
                      placeholder="Paste Image URL"
                      onMouseDown={(e) => e.stopPropagation()} 
                    />
                     <div className="mt-1 text-center font-serif text-sm italic text-slate-800">Exhibit #{index + 1}</div>
                  </div>
                )}

              </div>
            </div>
          )})}
        </div>
        
        {/* Print Styles */}
        <style>{`
          @media print {
            aside, header, .no-print { display: none !important; }
            .planning-board { position: fixed; inset: 0; z-index: 9999; background: white !important; }
            .planning-board svg { z-index: 0; }
            body { overflow: visible !important; }
          }
        `}</style>
      </div>
    );
  };

  const TasksView = () => (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>My Tasks</h2>
        <Button size="sm" variant="primary">New Task</Button>
      </div>
      <div className="space-y-2">
         {tasks.map(task => (
            <div key={task.id} className={`flex items-center p-4 rounded-xl border transition-all hover:shadow-md ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
               <button className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${task.status === 'done' ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                  {task.status === 'done' && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
               </button>
               <span className={`flex-1 font-medium ${task.status === 'done' ? 'line-through text-slate-400' : (isDarkMode ? 'text-white' : 'text-slate-900')}`}>{task.title}</span>
               <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                 task.status === 'in-progress' ? 'bg-amber-100 text-amber-600' :
                 task.status === 'done' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
               }`}>{task.status}</span>
            </div>
         ))}
      </div>
    </div>
  );

  const ToolsView = () => (
    <div className="p-8">
       <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Company Applications</h2>
            <p className="text-sm text-slate-500 mt-1">Access external tools and internal utilities</p>
          </div>
          <Button onClick={() => setIsToolModalOpen(true)} variant="primary">Add App</Button>
       </div>
       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredTools.map(tool => (
             <div 
               key={tool.id} 
               onClick={() => setActiveTool(tool)}
               className={`group relative p-6 rounded-2xl border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-500/30'}`}
             >
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 mb-4 flex items-center justify-center overflow-hidden">
                   <img src={tool.iconUrl} alt="" className="w-8 h-8 object-contain" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                </div>
                <h3 className={`font-bold mb-1 truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{tool.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-2">{tool.description}</p>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </div>
             </div>
          ))}
       </div>
    </div>
  );

  // --- RENDER ---
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className={`h-screen w-full flex flex-col md:flex-row relative transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}`}>
      <BrowserOverlay />
      
      {/* Sidebar Navigation */}
      <aside className={`w-full md:w-80 h-full p-6 flex flex-col shrink-0 overflow-y-auto border-b md:border-b-0 md:border-r transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
        <div className="flex flex-col items-center text-center gap-4 mb-10 group cursor-default">
          <img 
            src="https://lh3.googleusercontent.com/d/1KgVuIuCv8mKxTcJ4rClCUCdaQ3fxm0x6" 
            alt="WingMentor HQ" 
            className="h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
          />
          <div className="flex flex-col">
            <h1 className={`text-xl font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{t('title')}</h1>
            <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{t('masterDatabase')}</span>
          </div>
        </div>

        <div className="mb-10 space-y-2">
          {/* ... navigation buttons ... */}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Workspace</p>
          {[
            { id: 'overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 14a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 14a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', label: t('overview') },
            { id: 'timeline', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: t('timeline') },
            { id: 'mindmap', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z', label: t('mindmap') },
            { id: 'planning', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', label: t('planning') },
            { id: 'simulation', icon: 'M13 10V3L4 14h7v7l9-11h-7z', label: t('simulation') },
            { id: 'sales', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: t('sales') },
            { id: 'marketing', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z', label: t('marketing') },
            { id: 'tasks', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', label: t('tasks') },
            { id: 'tools', icon: 'M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z', label: t('tools') },
            { id: 'team', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', label: t('masterDirectory') },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => {
                setCurrentSection(item.id as AppSection);
                if (item.id !== 'tools') setActiveTool(null);
              }} 
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all relative overflow-hidden group ${
                currentSection === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800 dark:text-slate-400'
              }`}
            >
               <svg className={`w-5 h-5 relative z-10 transition-colors ${currentSection === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} /></svg>
               <span className="relative z-10">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Dynamic Filters - Only Show when Team is Active */}
        {currentSection === 'team' && (
          <div className="flex-1 space-y-1 mb-10 overflow-hidden flex flex-col animate-in fade-in slide-in-from-left-4 duration-300">
            <div className="flex items-center justify-between mb-4 ml-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('sortLogic')}</p>
            </div>
             <div className="flex p-1 rounded-2xl transition-colors duration-300 mb-6 bg-slate-200/50 dark:bg-slate-800">
              <button onClick={() => toggleGroupMode('company')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${groupMode === 'company' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('company')}</button>
              <button onClick={() => toggleGroupMode('position')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${groupMode === 'position' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('position')}</button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <button onClick={() => setSelectedGroup(null)} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 mb-2 ${selectedGroup === null ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                <span className="flex items-center gap-3">{t('allRecordsLabel')}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${selectedGroup === null ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>{contacts.length}</span>
              </button>
              
              <div className="space-y-1">
                {groups.map(([name, count, id]) => (
                  <button key={id} onClick={() => setSelectedGroup(id)} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 group/item ${selectedGroup === id ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                    <span className="truncate pr-4 group-hover/item:translate-x-1 transition-transform flex items-center gap-2">{name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex-shrink-0 ${selectedGroup === id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
           {/* User Profile Card */}
           <div className="p-4 rounded-2xl flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-sm">
               {currentUser?.[0]}
             </div>
             <div className="flex flex-col">
               <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{currentUser}</span>
               <span className="text-[9px] font-bold text-slate-400 uppercase">HQ Administrator</span>
             </div>
           </div>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white"
          >
            <svg className="w-5 h-5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {t('settings')}
          </button>
        </div>
      </aside>
      
      {/* ... rest of the component (Main Content Area, etc.) ... */}
      <main className={`flex-1 flex flex-col overflow-hidden relative z-10 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <header className={`px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-6 sticky top-0 z-10 backdrop-blur-xl border-b ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
           <h2 className={`text-2xl font-black tracking-tight capitalize drop-shadow-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
             {currentSection === 'team' ? t('masterDirectory') : (currentSection === 'tools' ? t('tools') : (TRANSLATIONS[language][currentSection] || currentSection))}
           </h2>
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* Show search only on Team or Tools view */}
            {(currentSection === 'team' || currentSection === 'tools') && (
              <div className="relative w-full sm:w-[300px] group">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input 
                  type="text"
                  placeholder={currentSection === 'tools' ? "Search tools..." : t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-6 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'}`}
                />
              </div>
            )}

            {currentSection === 'team' && (
              <>
              <div className={`flex p-1 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? (isDarkMode ? 'bg-slate-700 text-blue-400' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? (isDarkMode ? 'bg-slate-700 text-blue-400' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 14a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 14a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </button>
              </div>
              
              <Button onClick={openAddForm} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl shadow-lg shadow-blue-500/20" variant="primary">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                {t('addRecord')}
              </Button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
          {currentSection === 'overview' && <CompanyOverview />}
          {currentSection === 'timeline' && <TimelineView />}
          {currentSection === 'mindmap' && <MindmapView />}
          {currentSection === 'planning' && <PlanningView />}
          {currentSection === 'simulation' && <SimulationView />}
          {currentSection === 'sales' && <SalesView />}
          {currentSection === 'marketing' && <MarketingView />}
          {currentSection === 'objectives' && <ObjectivesView />}
          {currentSection === 'tasks' && <TasksView />}
          {currentSection === 'tools' && <ToolsView />}
          {currentSection === 'team' && (
            <div className="p-8">
               <div className="max-w-7xl mx-auto">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className={`text-3xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {selectedGroup 
                      ? selectedGroup
                      : t('allRecordsLabel')}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold mt-2 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    {selectedGroup ? t('filteredView') : t('fullDatabaseIndex')}
                  </p>
                </div>
                {selectedGroup && (
                  <button 
                    onClick={() => setSelectedGroup(null)}
                    className={`px-4 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest flex items-center gap-2 border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    {t('clearSelection')}
                  </button>
                )}
              </div>

              {filteredContacts.length > 0 ? (
                viewMode === 'list' ? (
                  <div className={`rounded-[2rem] overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className={`border-b ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('identity')}</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('position')}</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('company')}</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('action')}</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                          {filteredContacts.map(contact => (
                            <tr key={contact.id} className={`transition-colors group ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                  <img src={contact.avatarUrl} className={`w-10 h-10 rounded-xl shadow-sm object-cover border ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`} alt="" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{contact.firstName} {contact.lastName}</p>
                                      <div className="flex items-center gap-1.5">
                                        {contact.facebook && (
                                          <div className="relative">
                                            <a href={ensureAbsoluteUrl(contact.facebook, 'facebook')} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-500 transition-colors block">
                                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                            </a>
                                            <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                          </div>
                                        )}
                                        {contact.instagram && (
                                           <div className="relative">
                                            <a href={ensureAbsoluteUrl(contact.instagram, 'instagram')} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-pink-500 transition-colors block">
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                                            </a>
                                            <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">{contact.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                                  (groupMode === 'position' && selectedGroup === contact.position)
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {contact.position || t('personnel')}
                                </span>
                              </td>
                              <td className={`px-8 py-5 text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                 {contact.company || t('privatePractice')}
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                  <button onClick={() => handleEdit(contact)} className="p-2 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                  <button onClick={() => handleDelete(contact.id)} className="p-2 rounded-lg transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredContacts.map(contact => (
                      <ContactCard 
                        key={contact.id} 
                        contact={contact} 
                        onEdit={handleEdit} 
                        onDelete={handleDelete} 
                        t={t}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className={`flex flex-col items-center justify-center py-32 border border-dashed rounded-[3rem] text-center ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-inner ${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-white text-slate-200'}`}>
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t('noEntries')}</h3>
                  <p className="text-slate-400 max-w-xs mt-2 text-xs font-bold leading-relaxed px-4">{t('noEntriesSub')}</p>
                  <Button variant="primary" onClick={openAddForm} className="mt-8 px-10 py-3 rounded-2xl shadow-lg shadow-blue-500/20">{t('createProfile')}</Button>
                </div>
              )}
            </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal Systems */}
      {(isFormOpen || isSettingsOpen || isToolModalOpen) && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300 ${isDarkMode ? 'bg-slate-900/80' : 'bg-white/60'}`}>
          <div className={`w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-white shadow-slate-200'}`}>
            <div className={`px-8 py-6 border-b flex items-center justify-between ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'}`}>
              <h2 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {isToolModalOpen ? t('addTool') : (isSettingsOpen ? t('settings') : (editingContact ? t('modify') : t('addRecord')))}
              </h2>
              <button 
                onClick={() => { setIsFormOpen(false); setIsSettingsOpen(false); setIsToolModalOpen(false); }} 
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className={`p-8 overflow-y-auto max-h-[80vh] custom-scrollbar ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50/50'}`}>
              {isToolModalOpen ? (
                 <form onSubmit={handleAddTool} className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('toolName')}</label>
                      <input 
                        required
                        value={toolFormData.name}
                        onChange={(e) => setToolFormData(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl outline-none border transition-all text-sm font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'}`}
                        placeholder="My App"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{t('toolUrl')}</label>
                      <input 
                        required
                        type="url"
                        value={toolFormData.url}
                        onChange={(e) => setToolFormData(prev => ({ ...prev, url: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl outline-none border transition-all text-sm font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'}`}
                        placeholder="https://app.example.com"
                      />
                    </div>
                     <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Icon URL (Optional)</label>
                      <input 
                        type="url"
                        value={toolFormData.iconUrl}
                        onChange={(e) => setToolFormData(prev => ({ ...prev, iconUrl: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl outline-none border transition-all text-sm font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'}`}
                        placeholder="https://example.com/favicon.ico"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Description</label>
                      <textarea 
                        value={toolFormData.description}
                        onChange={(e) => setToolFormData(prev => ({ ...prev, description: e.target.value }))}
                        className={`w-full px-4 py-3 rounded-xl outline-none border transition-all text-sm font-medium resize-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'}`}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button variant="primary" type="submit" className="px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20">{t('addTool')}</Button>
                    </div>
                 </form>
              ) : isSettingsOpen ? (
                <div className="space-y-10">
                  <div className="space-y-6">
                    {/* Appearance */}
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('appearance')}</h4>
                      <div 
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`group flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-300 border ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:border-blue-200 shadow-sm'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 ${isDarkMode ? 'bg-slate-700 text-blue-400' : 'bg-slate-100 text-amber-500'}`}>
                            {isDarkMode ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 16.243l.707.707M7.757 7.757l.707-.707M12 5a7 7 0 100 14 7 7 0 000-14z" /></svg>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isDarkMode ? t('darkUI') : t('lightUI')}</span>
                            <span className="text-[10px] font-bold text-slate-400">{t('toggleTheme')}</span>
                          </div>
                        </div>
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${isDarkMode ? 'bg-blue-600' : 'bg-slate-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </div>
                    </div>

                    {/* Language Selection */}
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('language')}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => setLanguage(lang.code)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all border text-left ${
                              language === lang.code
                                ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20'
                                : isDarkMode 
                                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-lg">{lang.flag}</span>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-xs font-bold truncate">{lang.nativeName}</span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider opacity-60 ${language === lang.code ? 'text-white' : 'text-slate-400'}`}>
                                {lang.name}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Maintenance */}
                    <div className={`pt-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('maintenance')}</h4>
                      <button 
                        onClick={handleResetData}
                        className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-300 border border-dashed border-red-200 text-red-500 hover:bg-red-50 ${isDarkMode ? 'border-red-900/30 hover:bg-red-900/20' : ''}`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold">{t('purgeDatabase')}</span>
                          <span className="text-[10px] font-bold opacity-60">{t('factoryReset')}</span>
                        </div>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <button 
                        onClick={() => setIsAuthenticated(false)}
                        className={`mt-3 w-full flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-300 border ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold">Log Out</span>
                          <span className="text-[10px] font-bold opacity-60">End current session</span>
                        </div>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4">
                    <Button variant="primary" onClick={() => setIsSettingsOpen(false)} className="px-10 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-purple-500/20">
                      {t('closeSettings')}
                    </Button>
                  </div>
                </div>
              ) : (
                <ContactForm 
                  initialData={editingContact}
                  availableGroups={customGroups}
                  onSubmit={handleAddOrUpdate}
                  onCancel={() => setIsFormOpen(false)}
                  t={t}
                />
              )}
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        [dir="rtl"] .ml-2 { margin-left: 0; margin-right: 0.5rem; }
        [dir="rtl"] .mr-2 { margin-right: 0; margin-left: 0.5rem; }
        [dir="rtl"] .text-left { text-align: right; }
        [dir="rtl"] .text-right { text-align: left; }
      `}</style>
    </div>
  );
};

export default App;
