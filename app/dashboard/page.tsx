'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, FileText, Brain, History, Settings, 
  Search, BarChart2, Layers, StopCircle, Paperclip, 
  Send, Download, Eye, ChevronDown, ChevronRight, 
  Terminal, Hexagon, User, FileCode2, CheckCircle2, X,
  AlertCircle, Save, Trash2, FileOutput, Play,
  MoreVertical, FileArchive, Activity, Database,
  Home, LogOut, Globe, ExternalLink
} from 'lucide-react';
import Link from 'next/link';

// --- Types ---
type Tab = 'chat' | 'reports' | 'memory' | 'history' | 'settings';
type AgentMode = 'Research Agent' | 'Analyst Agent' | 'Combined';

// Removed Mock Data. We now use dynamic state fetched from API.

const DEFAULT_MEMORY = `## Identity
User: Abhishek
Preferences: Prefers concise summaries, Python code (pandas/scikit-learn), and dark-themed charts.
Working Style: Fast-paced, iterative.

## Ongoing Projects
- Customer Churn Analysis: Evaluating XGBoost vs Random Forest.
- Fraud Detection: Literature review phase.

## Datasets
- \`churn_data_2026.csv\`: 10k rows, 15 features. Found 2% missing values in 'tenure'.
- \`transactions_q1.parquet\`: 5M rows. Needs anomaly detection.

## Past Decisions
- Chose XGBoost for churn due to better handling of missing values and higher recall.
- Avoided deep learning for tabular data to maintain interpretability.

## Last Session Summary
Completed EDA on churn dataset. Identified 'monthly_charges' and 'contract_type' as top features. Next step: hyperparameter tuning.`;

// --- Components ---

const Logo = ({ className = 'w-8 h-8' }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={`${className} text-white shrink-0`} fill="none" stroke="currentColor" strokeWidth="5">
    <circle cx="50" cy="50" r="42" />
    <circle cx="50" cy="50" r="14" />
    <circle cx="50" cy="36" r="28" />
    <circle cx="50" cy="36" r="28" transform="rotate(120 50 50)" />
    <circle cx="50" cy="36" r="28" transform="rotate(240 50 50)" />
  </svg>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [agentMode, setAgentMode] = useState<AgentMode>('Combined');
  const [agentStatus, setAgentStatus] = useState<'Idle' | 'Running'>('Idle');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  // Chat State
  const [messageInput, setMessageInput] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [traceExpanded, setTraceExpanded] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Backend State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  // File Upload State
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Memory State
  const [memoryContent, setMemoryContent] = useState(DEFAULT_MEMORY);

  // Web Search State
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const refreshMemory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/memory');
      if (res.ok) {
        const data = await res.json();
        setMemoryContent(data.content);
      }
    } catch (e) {
      console.error('Failed to fetch memory:', e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/sessions');
      if (res.ok) setSessions(await res.json());
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/reports');
      if (res.ok) setReports(await res.json());
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    }
  };

  const loadSession = async (currSessionId: string) => {
    try {
      setSessionId(currSessionId);
      setActiveTab('chat');
      const res = await fetch(`http://localhost:8000/api/chat/history/${currSessionId}`);
      if (res.ok) {
        const history = await res.json();
        const formatted = history.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
        }));
        setChatMessages(formatted);
      }
    } catch (e) {
      console.error('Failed to fetch chat history:', e);
    }
  };

  useEffect(() => {
    refreshMemory();
    fetchSessions();
    fetchReports();
  }, []);

  const handleSendMessage = async () => {
    if (!messageInput.trim() && attachedFiles.length === 0) return;
    
    const fileNames = attachedFiles.map(f => f.name);
    const content = attachedFiles.length > 0 
      ? `${messageInput}${messageInput ? '\n' : ''}📎 ${fileNames.join(', ')}`
      : messageInput;
    
    const newUserMsg = { id: Date.now(), role: 'user', content, attachedFiles: fileNames };
    setChatMessages(prev => [...prev, newUserMsg]);
    
    const currentMessage = messageInput;
    setMessageInput('');
    setAgentStatus('Running');
    
    try {
      let datasetPath = null;
      if (attachedFiles.length > 0) {
        const formData = new FormData();
        formData.append('file', attachedFiles[0]);
        
        const uploadRes = await fetch('http://localhost:8000/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          datasetPath = uploadData.path;
        }
      }
      
      setAttachedFiles([]);
      
      const backendMode = agentMode === 'Research Agent' ? 'research' : agentMode === 'Analyst Agent' ? 'analyst' : 'combined';
      
      const chatRes = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: currentMessage || `Analyze ${fileNames.join(', ')}`,
          agent_mode: backendMode,
          dataset_path: datasetPath
        })
      });
      
      if (!chatRes.ok) throw new Error('Failed to start chat run');
      
      const chatData = await chatRes.json();
      if (!sessionId) setSessionId(chatData.session_id);
      
      const agentMsgId = Date.now() + 1;
      setChatMessages(prev => [...prev, {
        id: agentMsgId,
        role: 'agent',
        content: '',
        trace: [],
        code: null,
        reportReady: false,
        webSearchResults: null
      }]);
      
      const eventSource = new EventSource(`http://localhost:8000/api/chat/stream/${chatData.run_id}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'done') {
          eventSource.close();
          setAgentStatus('Idle');
          refreshMemory();
          fetchSessions(); // Refresh sidebar list
          fetchReports(); // Refresh reports list if one was generated
          return;
        }
        
        if (data.type === 'error') {
          console.error('Agent Error:', data.content);
          eventSource.close();
          setAgentStatus('Idle');
          return;
        }
        
        setChatMessages(prev => prev.map(msg => {
          if (msg.id === agentMsgId) {
            const updatedMsg = { ...msg };
            if (data.type === 'message') {
              updatedMsg.content = data.content;
            } else if (['tool', 'observation', 'thought'].includes(data.type)) {
              updatedMsg.trace = [...(updatedMsg.trace || []), data];
            } else if (data.type === 'report') {
              updatedMsg.reportReady = true;
              updatedMsg.reportId = data.report_id;
            }
            return updatedMsg;
          }
          return msg;
        }));
      };
      
      eventSource.onerror = (err) => {
        console.error('SSE Error:', err);
        eventSource.close();
        setAgentStatus('Idle');
      };

    } catch (error) {
      console.error('Submission Error:', error);
      setAgentStatus('Idle');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, agentStatus]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTrace = (id: number) => {
    setTraceExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white/90 flex font-sans selection:bg-[#c4b5fd]/30">
      
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-white/10 flex flex-col bg-[#0a0a0a] shrink-0">
        <div className="p-6 flex items-center gap-4">
          <Link href="/">
            <Logo />
          </Link>
          <span className="font-medium text-sm tracking-[0.15em] uppercase text-white/90">Aether</span>
        </div>

        {/* Agent Mode Switcher */}
        <div className="px-4 mb-6 relative">
          <button 
            onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm"
          >
            <div className="flex items-center gap-3">
              {agentMode === 'Research Agent' && <Search className="w-4 h-4 text-[#c4b5fd]" />}
              {agentMode === 'Analyst Agent' && <BarChart2 className="w-4 h-4 text-[#c4b5fd]" />}
              {agentMode === 'Combined' && <Layers className="w-4 h-4 text-[#c4b5fd]" />}
              <span className="font-medium">{agentMode}</span>
            </div>
            <ChevronDown className="w-4 h-4 text-white/50" />
          </button>

          <AnimatePresence>
            {isModeDropdownOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-4 right-4 mt-2 bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                {[
                  { mode: 'Research Agent', icon: Search, desc: 'Searches web, fetches papers' },
                  { mode: 'Analyst Agent', icon: BarChart2, desc: 'Builds models, generates reports' },
                  { mode: 'Combined', icon: Layers, desc: 'End-to-end research & analysis' }
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => { setAgentMode(item.mode as AgentMode); setIsModeDropdownOpen(false); }}
                    className="w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <item.icon className="w-4 h-4 mt-0.5 text-[#c4b5fd]" />
                    <div>
                      <div className="text-sm font-medium">{item.mode}</div>
                      <div className="text-xs text-white/40">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {[
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'reports', icon: FileText, label: 'Reports' },
            { id: 'memory', icon: Brain, label: 'Memory' },
            { id: 'history', icon: History, label: 'History' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === item.id ? 'bg-[#c4b5fd]/10 text-[#c4b5fd] font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}

          <div className="mt-8 mb-2 px-3 text-xs font-semibold tracking-wider text-white/40 uppercase">
            Recent chats
          </div>
          {sessions.slice(0, 5).map((chat) => (
            <button key={chat.id} onClick={() => loadSession(chat.id)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left group">
              <span className="truncate pr-2">{chat.title || 'New Conversation'}</span>
              <span className="text-[10px] text-white/30 group-hover:text-white/50 shrink-0">
                {chat.created_at ? new Date(chat.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
              </span>
            </button>
          ))}
        </nav>
        
        {/* User Profile Snippet */}
        <div className="p-4 border-t border-white/10 relative" ref={profileMenuRef}>
          <AnimatePresence>
            {isProfileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-4 right-4 mb-2 bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <Link
                  href="/"
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  Return to Home
                </Link>
                <div className="border-t border-white/10" />
                <button
                  onClick={() => { /* handle logout */ }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-full flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c4b5fd] to-purple-500 flex items-center justify-center text-black font-bold text-xs shrink-0">
              AB
            </div>
            <div className="flex flex-col text-left flex-1 min-w-0">
              <span className="text-sm font-medium">Abhishek</span>
              <span className="text-xs text-white/40">Pro Plan</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-white/40 transition-transform duration-200 shrink-0 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* TOPBAR */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 shrink-0 bg-[#050505]/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              {agentMode === 'Research Agent' && <Search className="w-4 h-4 text-[#c4b5fd]" />}
              {agentMode === 'Analyst Agent' && <BarChart2 className="w-4 h-4 text-[#c4b5fd]" />}
              {agentMode === 'Combined' && <Layers className="w-4 h-4 text-[#c4b5fd]" />}
              {agentMode}
            </div>
            
            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
              agentStatus === 'Running' ? 'bg-[#c4b5fd]/10 border-[#c4b5fd]/30 text-[#c4b5fd]' : 'bg-white/5 border-white/10 text-white/50'
            }`}>
              {agentStatus === 'Running' && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c4b5fd] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c4b5fd]"></span>
                </span>
              )}
              {agentStatus === 'Idle' && <span className="w-2 h-2 rounded-full bg-white/30"></span>}
              {agentStatus}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {agentStatus === 'Running' && (
              <button 
                onClick={() => setAgentStatus('Idle')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium border border-red-500/20"
              >
                <StopCircle className="w-3.5 h-3.5" />
                Stop Agent
              </button>
            )}
            <div className="relative group cursor-help">
              <Brain className="w-5 h-5 text-[#c4b5fd]" />
              <div className="absolute right-0 top-full mt-2 w-48 p-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-xs text-white/70 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                Agent has loaded memory from previous sessions
              </div>
            </div>
          </div>
        </header>

        {/* TAB CONTENT */}
        <div className="flex-1 overflow-y-auto relative">
          
          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full w-full">
              <div className="flex-1 overflow-y-auto">
                
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-4">
                    <div className="w-20 h-20 text-[#c4b5fd]/20 mb-6"><Logo className="w-20 h-20" /></div>
                    <h2 className="text-2xl font-light tracking-tight mb-2">Start a conversation with your agent.</h2>
                    <p className="text-white/40 text-sm mb-10">Select a prompt below or type your own request to begin.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                      {[
                        "Analyze my dataset for anomalies",
                        "Research recent papers on fraud detection",
                        "Compare XGBoost vs GNN on my data",
                        "Summarize findings from last session"
                      ].map((prompt, i) => (
                        <button 
                          key={i}
                          onClick={() => { setMessageInput(prompt); handleSendMessage(); }}
                          className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-sm text-left text-white/70 hover:text-white flex items-center justify-between group"
                        >
                          <span>{prompt}</span>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-[#c4b5fd]" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pb-32">
                    {chatMessages.map((msg) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        key={msg.id} 
                        className={`py-5 ${msg.role === 'user' ? 'bg-transparent' : 'bg-transparent'}`}
                      >
                        <div className="max-w-3xl mx-auto px-4 md:px-8">
                          <div className="flex gap-4">
                            {/* Avatar */}
                            <div className="shrink-0 pt-0.5">
                              {msg.role === 'agent' ? (
                                <div className="w-7 h-7 rounded-full bg-[#c4b5fd] flex items-center justify-center">
                                  <Logo className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                                  AB
                                </div>
                              )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-white">{msg.role === 'user' ? 'You' : 'Aether Analyst'}</span>
                              </div>
                              
                              {msg.role === 'user' ? (
                                <p className="text-[15px] leading-7 text-white/90">{msg.content}</p>
                              ) : (
                                <div className="space-y-4">
                                  <p className="text-[15px] leading-7 text-white/85">{msg.content}</p>
                                  
                                  {/* Agent Trace */}
                                  {msg.trace && (
                                    <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0d0d0d] mt-3">
                                      <button 
                                        onClick={() => toggleTrace(msg.id)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors text-xs text-white/50"
                                      >
                                        <div className="flex items-center gap-2 font-medium">
                                          <Terminal className="w-3.5 h-3.5 text-[#c4b5fd]" />
                                          <span>View reasoning ({msg.trace.length} steps)</span>
                                        </div>
                                        {traceExpanded[msg.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                      </button>
                                      
                                      <AnimatePresence>
                                        {traceExpanded[msg.id] && (
                                          <motion.div 
                                            initial={{ height: 0 }}
                                            animate={{ height: 'auto' }}
                                            exit={{ height: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="p-4 space-y-2.5 border-t border-white/[0.06] text-xs font-mono">
                                              {msg.trace.map((step: any, i: number) => (
                                                <div key={i} className="flex gap-3 items-start">
                                                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                                                    step.type === 'thought' ? 'bg-purple-500/15 text-purple-400' : 
                                                    step.type === 'tool' ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'
                                                  }`}>
                                                    {step.type}
                                                  </span>
                                                  <span className="text-white/60 leading-relaxed">{step.content}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  )}

                                  {/* Code Block */}
                                  {msg.code && (
                                    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0d0d0d] mt-3">
                                      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] text-xs text-white/40">
                                        <span className="font-medium">python</span>
                                        <button className="hover:text-white/60 transition-colors">Copy</button>
                                      </div>
                                      <pre className="p-4 text-[13px] font-mono text-white/80 overflow-x-auto leading-6">
                                        <code>{msg.code}</code>
                                      </pre>
                                    </div>
                                  )}

                                  {/* Web Search Results */}
                                  {msg.webSearchResults && (
                                    <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0d0d0d] mt-3">
                                      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] text-xs text-white/50 font-medium">
                                        <Globe className="w-3.5 h-3.5 text-[#c4b5fd]" />
                                        <span>Searched {msg.webSearchResults.length} sources</span>
                                      </div>
                                      <div className="p-3 space-y-1">
                                        {msg.webSearchResults.map((result: any, i: number) => (
                                          <div key={i} className="px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-all group cursor-pointer">
                                            <div className="flex items-center gap-2 mb-0.5">
                                              <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center">
                                                <ExternalLink className="w-2.5 h-2.5 text-white/40" />
                                              </div>
                                              <span className="text-xs text-white/30 truncate">{result.url}</span>
                                            </div>
                                            <h5 className="text-sm font-medium text-[#c4b5fd] group-hover:text-[#d4c8fd] transition-colors mb-0.5">{result.title}</h5>
                                            <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{result.snippet}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Report Ready Card */}
                                  {msg.reportReady && (
                                    <div className="p-4 rounded-xl border border-[#c4b5fd]/20 bg-[#c4b5fd]/[0.04] flex items-center justify-between mt-3">
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-[#c4b5fd]/15 flex items-center justify-center">
                                          <FileText className="w-4.5 h-4.5 text-[#c4b5fd]" />
                                        </div>
                                        <div>
                                          <h4 className="text-sm font-medium text-white">Analysis Report Ready</h4>
                                          <p className="text-xs text-white/40">Generated just now</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        {msg.reportId && (
                                          <>
                                            <button 
                                              onClick={() => window.open(`http://localhost:8000/api/reports/${msg.reportId}/pdf`, '_blank')}
                                              className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium transition-colors flex items-center gap-1.5 text-white/70 hover:text-white"
                                            >
                                              <Eye className="w-3.5 h-3.5" /> View
                                            </button>
                                            <a 
                                              href={`http://localhost:8000/api/reports/${msg.reportId}/pdf`}
                                              download={`Report_${msg.reportId}.pdf`}
                                              className="px-3.5 py-1.5 rounded-lg bg-[#c4b5fd] text-black hover:bg-[#b3a1f8] text-xs font-medium transition-colors flex items-center gap-1.5"
                                            >
                                              <Download className="w-3.5 h-3.5" /> PDF
                                            </a>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* Typing Indicator */}
                    {agentStatus === 'Running' && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-5"
                      >
                        <div className="max-w-3xl mx-auto px-4 md:px-8">
                          <div className="flex gap-4">
                            <div className="w-7 h-7 rounded-full bg-[#c4b5fd] flex items-center justify-center shrink-0">
                              <div className="animate-pulse"><Logo className="w-4 h-4" /></div>
                            </div>
                            <div className="flex items-center gap-3 pt-1">
                              <span className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd]/60 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd]/60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd]/60 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </span>
                              <span className="text-xs text-white/40">Thinking...</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* ChatGPT-style floating input bar */}
              <div className="sticky bottom-0 w-full bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-6 pb-4 px-4">
                <div className="max-w-3xl mx-auto">
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    accept=".csv,.xlsx,.xls,.pdf,.json,.txt,.parquet"
                    className="hidden"
                  />
                  <div className="relative bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/30 focus-within:border-white/20 transition-all">
                    {/* Attached Files */}
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 px-4 pt-3">
                        {attachedFiles.map((file, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#c4b5fd]/10 border border-[#c4b5fd]/20 text-xs">
                            <FileText className="w-3.5 h-3.5 text-[#c4b5fd]" />
                            <span className="text-white/80 max-w-[150px] truncate">{file.name}</span>
                            <span className="text-white/30">{formatFileSize(file.size)}</span>
                            <button onClick={() => removeFile(i)} className="text-white/30 hover:text-white/70 transition-colors">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea 
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={attachedFiles.length > 0 ? "Add a message about your files..." : "Message Aether Analyst..."}
                      className="w-full bg-transparent border-none resize-none max-h-48 min-h-[52px] py-3.5 pl-4 pr-14 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:ring-0"
                      rows={1}
                      style={{ scrollbarWidth: 'none' }}
                    />
                    <div className="flex items-center justify-between px-3 pb-2.5">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 text-white/30 hover:text-white/60 transition-colors rounded-lg hover:bg-white/[0.06]" 
                          title="Attach file (.csv, .xlsx, .pdf, .json)"
                        >
                          <Paperclip className="w-4.5 h-4.5" />
                        </button>
                        <button 
                          onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                          className={`p-1.5 rounded-lg transition-all relative ${
                            webSearchEnabled 
                              ? 'text-[#c4b5fd] bg-[#c4b5fd]/10 hover:bg-[#c4b5fd]/15' 
                              : 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]'
                          }`}
                          title={webSearchEnabled ? 'Web search enabled' : 'Enable web search'}
                        >
                          <Globe className="w-4.5 h-4.5" />
                          {webSearchEnabled && (
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#c4b5fd] ring-2 ring-[#1a1a1a]"></span>
                          )}
                        </button>
                      </div>
                      <button 
                        onClick={handleSendMessage}
                        disabled={(!messageInput.trim() && attachedFiles.length === 0) || agentStatus === 'Running'}
                        className={`p-1.5 rounded-lg transition-all ${
                          messageInput.trim() 
                            ? 'bg-white text-black hover:bg-white/90' 
                            : 'bg-white/10 text-white/20 cursor-not-allowed'
                        }`}
                      >
                        <Send className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-center mt-3 text-[11px] text-white/20">
                  Aether Analyst remembers your previous sessions automatically.
                </div>
              </div>
            </div>
          )}

          {/* MEMORY TAB */}
          {activeTab === 'memory' && (
            <div className="max-w-4xl mx-auto p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-light tracking-tight mb-2">Agent Memory</h2>
                <p className="text-white/50 text-sm">The agent reads and writes this file at the start and end of every session to maintain continuity across conversations.</p>
              </div>

              <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[600px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                  <div className="flex items-center gap-2 text-sm font-mono text-white/60">
                    <FileCode2 className="w-4 h-4" />
                    memory.md
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors flex items-center gap-1.5 text-white/70">
                      <FileOutput className="w-3.5 h-3.5" /> Export
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-medium transition-colors flex items-center gap-1.5 text-red-400">
                      <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                    <button className="px-3 py-1.5 rounded-lg bg-[#c4b5fd] text-black hover:bg-[#b3a1f8] text-xs font-medium transition-colors flex items-center gap-1.5">
                      <Save className="w-3.5 h-3.5" /> Save Edits
                    </button>
                  </div>
                </div>
                <textarea 
                  value={memoryContent}
                  onChange={(e) => setMemoryContent(e.target.value)}
                  className="flex-1 w-full bg-transparent p-6 text-sm font-mono text-white/80 focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
              
              <div className="mt-4 flex items-start gap-2 text-amber-400/80 bg-amber-400/10 p-4 rounded-xl border border-amber-400/20">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm"><strong>Warning:</strong> Editing memory directly affects what the agent remembers next session. Be careful not to delete important context.</p>
              </div>
            </div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <div className="max-w-6xl mx-auto p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-light tracking-tight mb-2">Generated Reports</h2>
                <p className="text-white/50 text-sm">Comprehensive analysis and research documents generated by your agents.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                  <div key={report.id} className="bg-[#141414] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors group flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                        report.agent_mode?.toLowerCase() === 'research' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                        report.agent_mode?.toLowerCase() === 'analyst' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        'bg-purple-500/10 border-purple-500/20 text-purple-400'
                      }`}>
                        {report.agent_mode}
                      </div>
                      <span className="text-xs text-white/40 font-mono">
                        {report.created_at ? new Date(report.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-medium mb-2 group-hover:text-[#c4b5fd] transition-colors">{report.title}</h3>
                    <p className="text-sm text-white/50 mb-6 flex-1">Contains {report.findings_count || 0} key findings, methodology, and recommendations.</p>
                    
                    <div className="flex gap-2 mt-auto">
                      <button 
                        onClick={() => window.open(`http://localhost:8000/api/reports/${report.id}/pdf`, '_blank')}
                        className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 text-white/70 hover:text-white"
                      >
                        <Eye className="w-4 h-4" /> View
                      </button>
                      <a 
                        href={`http://localhost:8000/api/reports/${report.id}/pdf`}
                        download={`Report_${report.id}.pdf`}
                        className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 text-white/70 hover:text-white"
                      >
                        <Download className="w-4 h-4" /> PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="max-w-4xl mx-auto p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-light tracking-tight mb-2">Conversation History</h2>
                <p className="text-white/50 text-sm">Review past sessions and analyses.</p>
              </div>

              <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/40">
                      <th className="p-4 font-medium">Session Title</th>
                      <th className="p-4 font-medium">Date</th>
                      <th className="p-4 font-medium">Agent Mode</th>
                      <th className="p-4 font-medium text-right">Messages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sessions.map((session) => (
                      <tr key={session.id} onClick={() => loadSession(session.id)} className="hover:bg-white/5 transition-colors cursor-pointer group">
                        <td className="p-4 text-sm font-medium group-hover:text-[#c4b5fd] transition-colors">
                          {session.title || 'New Conversation'}
                        </td>
                        <td className="p-4 text-sm text-white/50 font-mono">
                          {session.created_at ? new Date(session.created_at).toLocaleDateString() : ''}
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-white/60 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                            {session.agent_mode}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-white/50 text-right font-mono">
                          {/* We don't have message count natively tracked without joining, but we can hide it or render a generic token */}
                          -
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl mx-auto p-8 pb-24">
              <div className="mb-8">
                <h2 className="text-2xl font-light tracking-tight mb-2">Settings</h2>
                <p className="text-white/50 text-sm">Configure your agent, memory, and execution environment.</p>
              </div>

              <div className="space-y-10">
                {/* Agent Configuration */}
                <section>
                  <h3 className="text-sm font-semibold tracking-wider text-[#c4b5fd] uppercase mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4" /> Agent Configuration
                  </h3>
                  <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">Gemini API Key</label>
                      <div className="flex gap-2">
                        <input type="password" value="AIzaSy-xxxxxxxxxxxxxxxxxxxx" readOnly className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white/50 font-mono focus:outline-none" />
                        <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors">Update</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Default Agent Mode</label>
                        <select className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-white/30 appearance-none">
                          <option>Combined</option>
                          <option>Analyst Agent</option>
                          <option>Research Agent</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Model</label>
                        <select className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-white/30 appearance-none">
                          <option>Gemini 3.1 Flash Lite Preview</option>
                          <option>Gemini 2.0 Flash</option>
                          <option>Gemini 2.5 Pro</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-white/80">Max Agent Steps</label>
                        <span className="text-sm font-mono text-white/50">20</span>
                      </div>
                      <input type="range" min="5" max="30" defaultValue="20" className="w-full accent-[#c4b5fd]" />
                    </div>
                  </div>
                </section>

                {/* Memory Settings */}
                <section>
                  <h3 className="text-sm font-semibold tracking-wider text-[#c4b5fd] uppercase mb-4 flex items-center gap-2">
                    <Database className="w-4 h-4" /> Memory Settings
                  </h3>
                  <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">Memory File Location</label>
                      <input type="text" defaultValue="~/.aether/memory.md" className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-white/80 focus:outline-none focus:border-white/30" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white/80">Auto-save memory</div>
                        <div className="text-xs text-white/50 mt-1">Update memory.md automatically after each session</div>
                      </div>
                      <div className="w-12 h-6 bg-[#c4b5fd] rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-black rounded-full shadow-sm"></div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-white/10">
                      <button className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-sm font-medium transition-colors border border-red-500/20">
                        Clear All Memory
                      </button>
                    </div>
                  </div>
                </section>

                {/* Execution Settings */}
                <section>
                  <h3 className="text-sm font-semibold tracking-wider text-[#c4b5fd] uppercase mb-4 flex items-center gap-2">
                    <Terminal className="w-4 h-4" /> Execution Settings
                  </h3>
                  <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-white/80">Code Execution Mode</div>
                        <div className="text-xs text-white/50 mt-1">Run code locally or in secure cloud sandbox</div>
                      </div>
                      <div className="flex bg-black border border-white/10 rounded-lg p-1">
                        <button className="px-3 py-1 text-xs font-medium rounded-md text-white/50 hover:text-white">Local (dev)</button>
                        <button className="px-3 py-1 text-xs font-medium rounded-md bg-white/10 text-white shadow-sm">E2B Sandbox</button>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-white/80">Max Execution Timeout</label>
                        <span className="text-sm font-mono text-white/50">60s</span>
                      </div>
                      <input type="range" min="10" max="120" defaultValue="60" className="w-full accent-[#c4b5fd]" />
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
