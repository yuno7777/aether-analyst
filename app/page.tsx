'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Search, ArrowRight, Github, Twitter, Linkedin, X, Database, BrainCircuit, LineChart, FileText, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'motion/react';
import Lenis from 'lenis';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 5000 },
  { name: 'Apr', value: 4500 },
  { name: 'May', value: 6000 },
  { name: 'Jun', value: 5500 },
  { name: 'Jul', value: 7000 },
];

export default function Page() {
  const [hoveredProject, setHoveredProject] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const { scrollYProgress } = useScroll();
  
  // Parallax effects
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const heroTextY = useTransform(scrollYProgress, [0, 1], ['0%', '40%']);
  const houseY = useTransform(scrollYProgress, [0, 1], ['0%', '-15%']);

  const coastImages = [
    "https://picsum.photos/seed/data1/800/600",
    "https://picsum.photos/seed/data2/800/600",
    "https://picsum.photos/seed/data3/800/600",
  ];

  // Mouse tracking for gallery
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { damping: 20, stiffness: 100, mass: 0.5 });
  const smoothY = useSpring(mouseY, { damping: 20, stiffness: 100, mass: 0.5 });

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Delay chart render until layout is stable
    const timer = setTimeout(() => setChartReady(true), 500);

    return () => {
      lenis.destroy();
      clearTimeout(timer);
    };
  }, []);

  return (
    <main className="min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen w-full bg-black flex flex-col justify-between overflow-hidden">
        {/* Navigation */}
        <motion.nav 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl rounded-full bg-white/[0.02] backdrop-blur-2xl border border-white/10 p-2 flex justify-between items-center"
        >
          {/* Left Circle (Logo) */}
          <div className="flex items-center gap-6 pl-1">
            <svg 
              viewBox="0 0 100 100" 
              className="w-10 h-10 text-white shrink-0" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="5"
            >
              <circle cx="50" cy="50" r="42" />
              <circle cx="50" cy="50" r="14" />
              <circle cx="50" cy="36" r="28" />
              <circle cx="50" cy="36" r="28" transform="rotate(120 50 50)" />
              <circle cx="50" cy="36" r="28" transform="rotate(240 50 50)" />
            </svg>
            <span className="font-medium text-sm hidden sm:block tracking-[0.2em] uppercase text-white/90">Aether</span>
          </div>

          {/* Center Links (Desktop) */}
          <div className="hidden md:flex items-center gap-12 text-xs font-medium tracking-[0.2em] uppercase text-white/50">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#agent-modes" className="hover:text-white transition-colors">Agent Modes</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4 pr-1">
            <Link href="/dashboard" className="hidden md:flex px-6 py-2.5 rounded-full border border-white/10 hover:bg-white/5 text-xs font-medium tracking-widest uppercase transition-colors text-white/70 hover:text-white">
              Log in
            </Link>
            {/* Right Circle / CTA */}
            <Link href="/dashboard" className="hidden md:flex h-10 px-6 rounded-full bg-white text-black text-xs font-bold tracking-widest uppercase items-center justify-center hover:bg-gray-200 transition-colors shrink-0">
              Start free
            </Link>
            
            {/* Mobile Menu Toggle (Right Circle on Mobile) */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors shrink-0"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </motion.nav>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-24 left-4 right-4 z-40 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex flex-col gap-6 md:hidden"
          >
            <div className="flex flex-col gap-4 text-sm font-medium tracking-[0.2em] uppercase text-white/70">
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-white transition-colors py-2 border-b border-white/5">How it works</a>
              <a href="#agent-modes" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-white transition-colors py-2 border-b border-white/5">Agent Modes</a>
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-white transition-colors py-2 border-b border-white/5">Features</a>
              <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-white transition-colors py-2 border-b border-white/5">Dashboard</Link>
            </div>
            <div className="flex flex-col gap-3 mt-4">
              <Link href="/dashboard" className="w-full py-3 rounded-full border border-white/10 text-xs font-medium tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/5 transition-colors text-center block">
                Log in
              </Link>
              <Link href="/dashboard" className="w-full py-3 rounded-full bg-white text-black text-xs font-bold tracking-widest uppercase hover:bg-gray-200 transition-colors text-center block">
                Start for free
              </Link>
            </div>
          </motion.div>
        )}

        {/* Main Content */}
        <div className="relative z-10 flex-1 flex items-start justify-center px-4 md:px-6 pt-24 pb-12 md:pt-32 md:pb-20 w-full">
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left: Typography */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <motion.h1 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-thin tracking-tight leading-[1.1] text-white"
              >
                Your AI data<br />
                scientist that<br />
                <span className="text-[#c4b5fd] italic pr-4 font-extralight">never forgets.</span>
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="mt-6 md:mt-8 text-base sm:text-lg md:text-xl text-white/50 max-w-xl leading-relaxed font-extralight tracking-wide"
              >
                Aether Analyst is an autonomous AI agent that researches the web, analyzes your data, builds models, and generates full reports — through a simple chat interface. It remembers every session, every dataset, every decision.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="flex flex-wrap items-center gap-4 mt-8 md:mt-10"
              >
                <Link href="/dashboard" className="px-6 md:px-8 py-3 md:py-4 rounded-full bg-[#c4b5fd] text-black font-semibold hover:bg-white transition-colors flex items-center gap-2 text-sm md:text-base">
                  Start for free <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="px-6 md:px-8 py-3 md:py-4 rounded-full border border-white/20 text-white font-medium hover:bg-white/5 transition-colors text-sm md:text-base">
                  Watch demo
                </button>
              </motion.div>
            </div>

            {/* Right: Visuals */}
            <div className="lg:col-span-5 relative h-[300px] sm:h-[350px] lg:h-[450px] w-full mt-8 lg:mt-0 flex items-center justify-center">
              {/* Massive Background Text */}
              <motion.div 
                style={{ y: heroTextY }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[20vw] lg:text-[12vw] font-bold text-white/5 leading-none tracking-tighter select-none pointer-events-none z-0"
              >
                Aether
              </motion.div>

              <div className="relative w-full max-w-[500px] h-full">
                {/* Chart Card */}
                <motion.div 
                  style={{ y: heroY }}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
                  className="absolute top-4 lg:top-10 right-0 w-[95%] lg:w-[110%] h-[200px] lg:h-[260px] bg-black border border-white/10 rounded-2xl p-4 lg:p-6 z-10"
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#c4b5fd]" />
                      <span className="text-[10px] lg:text-xs font-medium text-white/80 uppercase tracking-wider">Model Performance</span>
                    </div>
                    <span className="text-[10px] lg:text-xs text-white/40 font-mono">Epoch 42/100</span>
                  </div>
                  <div className="h-[120px] lg:h-[180px] w-full overflow-hidden">
                    {chartReady && (
                      <AreaChart data={data} width={500} height={180}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                          itemStyle={{ color: '#c4b5fd' }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#c4b5fd" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                      </AreaChart>
                    )}
                  </div>
                </motion.div>

                {/* Active Session Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.1 }}
                  className="absolute bottom-4 lg:bottom-10 left-0 lg:-left-8 bg-black border border-white/10 p-4 lg:p-5 rounded-xl text-white w-[240px] lg:w-[280px] z-20"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-xs lg:text-sm flex items-center gap-2">
                      <BrainCircuit className="w-3 h-3 lg:w-4 lg:h-4 text-[#c4b5fd]"/> Active Session
                    </h3>
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-[#c4b5fd] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c4b5fd]"></span>
                    </span>
                  </div>
                  <p className="text-[10px] lg:text-xs text-white/60 leading-relaxed mb-3">Training XGBoost model on customer churn dataset...</p>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="bg-[#c4b5fd] h-1.5 rounded-full" style={{ width: '85%' }}></div>
                  </div>
                  <div className="flex justify-between mt-2 text-[8px] lg:text-[10px] text-white/40 font-mono">
                    <span>Progress</span>
                    <span>85%</span>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Elements */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="relative z-20 flex flex-col md:flex-row justify-between items-center md:items-end p-6 pb-10 text-white gap-6 md:gap-0"
        >
          <div className="flex gap-3 order-2 md:order-1">
            <button className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors backdrop-blur-sm">
              <Twitter className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors backdrop-blur-sm">
              <Github className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-colors backdrop-blur-sm">
              <Linkedin className="w-4 h-4" />
            </button>
          </div>
          <div className="md:absolute md:left-1/2 md:-translate-x-1/2 md:bottom-10 text-sm font-medium text-white/80 order-3 md:order-2">
            <p>© 2026</p>
          </div>
          <div className="max-w-xs text-center md:text-right text-sm opacity-90 font-medium order-1 md:order-3">
            <p>Built for real work. 3 specialized agent modes, persistent memory, and 6 autonomous tools per agent.</p>
          </div>
        </motion.div>
      </section>

      {/* How it works Section */}
      <section id="how-it-works" className="bg-black py-24 px-6 text-white relative overflow-hidden border-t border-white/10">
        {/* Large Background Text */}
        <motion.div 
          style={{ y: useTransform(scrollYProgress, [0, 1], ['-20%', '20%']) }}
          className="absolute right-0 top-0 opacity-[0.03] text-[25vw] font-bold leading-none tracking-tighter select-none pointer-events-none"
        >
          WORK
        </motion.div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-24 items-center">
            <div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex items-center gap-3 mb-8"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd]"></div>
                <span className="text-xs font-medium tracking-[0.2em] text-[#c4b5fd] uppercase">Workflow</span>
              </motion.div>
              <motion.h2 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-5xl lg:text-6xl xl:text-7xl font-thin leading-[0.9] tracking-tight mb-12 text-white"
              >
                Talk to it<br />
                like a<br />
                <span className="font-extralight italic text-[#c4b5fd]">data scientist.</span>
              </motion.h2>
              
              <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="space-y-4 text-white/70 max-w-lg w-full"
              >
                {[
                  { num: '01', title: 'Choose your agent mode', desc: 'Select Research, Analyst, or Combined based on your goal.' },
                  { num: '02', title: 'Chat naturally', desc: 'Upload a dataset or describe what you need in plain English.' },
                  { num: '03', title: 'Watch it work', desc: 'It researches, writes code, runs models, and builds charts.' },
                  { num: '04', title: 'Get a full PDF report', desc: 'Complete with findings, methodologies, and recommendations.' },
                  { num: '05', title: 'Come back next session', desc: 'It remembers everything from your previous interactions.' },
                ].map((step, i) => (
                  <div key={i} className="group flex gap-5 items-start p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all backdrop-blur-sm">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#c4b5fd]/10 border border-[#c4b5fd]/20 flex items-center justify-center">
                      <span className="text-[#c4b5fd] font-mono text-xs">{step.num}</span>
                    </div>
                    <div>
                      <strong className="text-white font-light block mb-1.5 text-base">{step.title}</strong>
                      <span className="text-white/50 font-extralight text-sm leading-relaxed">{step.desc}</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            <div className="relative flex justify-center lg:justify-end mt-12 lg:mt-0">
              <motion.div 
                style={{ y: houseY }}
                className="relative z-10 w-full max-w-md xl:max-w-[500px]"
              >
                <motion.div
                  initial={{ rotate: 2, y: 20, opacity: 0 }}
                  whileInView={{ rotate: -1, y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  whileHover={{ rotate: 0, scale: 1.02 }}
                  className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-8 text-white w-full shadow-2xl relative overflow-hidden"
                >
                  {/* Glassmorphism highlight */}
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none"></div>

                  <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-[#c4b5fd]/10 border border-[#c4b5fd]/20 flex items-center justify-center">
                      <Search className="w-5 h-5 text-[#c4b5fd]" />
                    </div>
                    <div>
                      <h3 className="font-light text-lg tracking-wide">Research Agent</h3>
                      <p className="text-xs text-white/40 font-mono mt-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Fetching ArXiv papers...
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-6 text-sm relative z-10">
                    <div className="bg-black/40 p-4 md:p-5 rounded-2xl border border-white/5 backdrop-blur-md">
                      <p className="text-white/70 font-extralight leading-relaxed">&quot;Searches the web, fetches ArXiv papers, summarizes the latest techniques and findings relevant to your problem. Use it before touching any data.&quot;</p>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-[#c4b5fd]/10 text-[#c4b5fd] p-4 md:p-5 rounded-2xl border border-[#c4b5fd]/20 max-w-[85%] backdrop-blur-md">
                        <p className="font-light leading-relaxed">Found 3 relevant papers on GNNs for fraud detection. Synthesizing methodologies now.</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Modes Section */}
      <section id="agent-modes" className="bg-black pb-32 px-6 pt-12 relative">
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl lg:text-7xl font-thin mb-20 tracking-tight text-center text-white"
          >
            Three agents, <span className="text-[#c4b5fd] italic font-extralight">one interface.</span>
          </motion.h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                title: 'Research Agent', 
                icon: <Search className="w-6 h-6 text-[#c4b5fd]" />,
                desc: 'Gathers context before touching data. Summarizes the latest techniques relevant to your problem.',
                points: ['Web & ArXiv scraping', 'Literature synthesis', 'Methodology extraction', 'Contextual grounding']
              },
              { 
                title: 'Analyst Agent', 
                icon: <LineChart className="w-6 h-6 text-[#c4b5fd]" />,
                desc: 'Executes the data science lifecycle. Trains models, generates charts, and delivers structured insights.',
                points: ['Automated EDA', 'Model selection & tuning', 'Feature engineering', 'PDF report generation']
              },
              { 
                title: 'Combined Agent', 
                icon: <BrainCircuit className="w-6 h-6 text-[#c4b5fd]" />,
                desc: 'End-to-end autonomous pipeline. Researches best approaches first, then applies them directly to your data.',
                points: ['End-to-end execution', 'Research-backed modeling', 'Autonomous decisions', 'Full traceability']
              },
            ].map((item, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-2xl border border-white/10 hover:border-white/20 rounded-3xl p-8 text-white flex flex-col transition-all duration-500 cursor-pointer overflow-hidden"
              >
                {/* Subtle top gradient highlight */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#c4b5fd]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="z-10 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    {item.icon}
                  </div>
                  <h4 className="font-light text-2xl mb-3 tracking-wide">{item.title}</h4>
                  <p className="text-sm text-white/50 leading-relaxed font-extralight mb-8">{item.desc}</p>
                  
                  <ul className="space-y-3">
                    {item.points.map((point, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm text-white/70 font-extralight">
                        <div className="w-1 h-1 rounded-full bg-[#c4b5fd]/50"></div>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Large background icon */}
                <div className="absolute -bottom-12 -right-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 scale-[3]">
                  {item.icon}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Memory Feature Section */}
      <section className="bg-black py-32 px-6 text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-20">
            <motion.h2 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-5xl md:text-7xl lg:text-8xl font-thin leading-[0.85] tracking-tight"
            >
              It<br />
              remembers<span className="text-[#c4b5fd] font-extralight italic">.</span>
            </motion.h2>
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:pl-12 flex flex-col justify-center items-start"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd]"></div>
                <span className="text-xs font-medium tracking-[0.2em] text-[#c4b5fd] uppercase">Persistent Memory</span>
              </div>
              <p className="text-white/70 mb-8 max-w-md leading-relaxed text-sm md:text-base font-extralight">
                Most AI tools forget everything the moment you close the tab. Aether Analyst writes a memory file after every session — your projects, your datasets, your past decisions, what worked and what didn&apos;t. Next time you open it, it picks up exactly where you left off.
              </p>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              { label: 'Past Decision', value: 'Analyzed Elliptic Bitcoin dataset — GNN outperformed XGBoost (F1: 0.93)' },
              { label: 'User Preference', value: 'User prefers concise reports with visual summaries' },
              { label: 'Active Context', value: 'Ongoing project: fraud detection pipeline for fintech client' },
            ].map((stat, i) => (
              <div key={i} className="group relative bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-2xl border border-white/10 hover:border-white/20 rounded-3xl p-8 text-white flex flex-col transition-all duration-500 cursor-pointer overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#c4b5fd]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd]"></div>
                  <p className="text-xs text-[#c4b5fd] uppercase tracking-[0.2em] font-medium">{stat.label}</p>
                </div>
                <p className="text-sm font-extralight text-white/70 leading-relaxed">{stat.value}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features List Section */}
      <section id="features" className="bg-black text-white py-32 px-6 overflow-hidden border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-20 gap-8">
            <motion.h2 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl md:text-7xl lg:text-8xl font-thin tracking-tight leading-[0.9]"
            >
              Everything in<br/>one place
            </motion.h2>
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex items-center gap-3 pb-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#c4b5fd]"></div>
              <span className="text-xs font-medium tracking-[0.2em] text-[#c4b5fd] uppercase">Features</span>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 border-t border-white/10 pt-12">
            {[
              "Natural chat interface — talk to your agent like a colleague",
              "Three agent modes — research only, analysis only, or both combined",
              "Persistent memory — remembers projects, datasets and past decisions",
              "Web search and ArXiv paper fetching for research-backed work",
              "Live sandboxed Python execution — pandas, sklearn, xgboost, matplotlib",
              "Auto EDA on every dataset — stats, distributions, correlations",
              "PDF report generation with methodology, findings, recommendations",
              "Full agent trace visible inside every chat message — transparent reasoning",
              "Works on any tabular dataset — CSV, Excel, PDF"
            ].map((feature, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group flex items-start gap-4 py-4 border-b border-white/5 hover:border-white/20 transition-colors"
              >
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#c4b5fd]/50 group-hover:bg-[#c4b5fd] shrink-0 transition-colors"></div>
                <p className="text-sm text-white/70 font-extralight group-hover:text-white/90 transition-colors">{feature}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white pt-24 pb-12 px-6 border-t border-white/10 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-xs text-white/40 uppercase tracking-[0.2em] mb-32 font-medium gap-4">
            <span>Aether Analyst</span>
            <span>Python // FastAPI // React // ChromaDB // Claude API // Docker</span>
            <span>Ready when you are</span>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row justify-between items-center mb-40 relative gap-8"
          >
            <span className="text-[#c4b5fd] text-3xl hidden md:block animate-pulse font-extralight">+</span>
            <div className="text-center">
              <h3 className="text-4xl md:text-6xl lg:text-7xl font-thin tracking-tight mb-8">No setup. No forgetting. Just results.</h3>
              <button className="px-8 py-4 bg-[#c4b5fd] text-black rounded-full text-base font-medium hover:bg-white transition-all hover:scale-105 active:scale-95">
                Get started free
              </button>
            </div>
            <span className="text-[#c4b5fd] text-3xl hidden md:block animate-pulse font-extralight">+</span>
          </motion.div>

          <div className="flex flex-col md:flex-row justify-between items-end text-xs text-white/40 uppercase tracking-[0.2em] mb-16 font-medium gap-8">
            <div>
              <p className="mb-1">All Rights Reserved.</p>
              <p>©2026 Aether Analyst</p>
            </div>
            <div className="text-left md:text-center">
              <p className="mb-1">Built for real work</p>
              <p>Works on any dataset</p>
            </div>
            <div className="text-left md:text-right flex flex-col gap-2">
              <a href="#" className="hover:text-white transition-colors hover:translate-x-1 transform inline-block">Twitter</a>
              <a href="#" className="hover:text-white transition-colors hover:translate-x-1 transform inline-block">LinkedIn</a>
              <a href="#" className="hover:text-white transition-colors hover:translate-x-1 transform inline-block">Privacy Policy</a>
            </div>
          </div>

          {/* Massive Footer Text */}
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative w-full flex justify-center mt-12"
          >
            <h1 className="text-[18vw] font-thin text-[#c4b5fd] leading-[0.7] tracking-tighter select-none hover:text-white transition-colors duration-700 cursor-default">
              aether
            </h1>
          </motion.div>
        </div>
      </footer>
    </main>
  );
}
