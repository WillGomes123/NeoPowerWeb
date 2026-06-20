import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { 
  Sparkles, 
  MessageSquare, 
  History, 
  Activity, 
  Plus, 
  Trash2, 
  Send, 
  RefreshCw, 
  X, 
  Check, 
  AlertTriangle, 
  Loader2 
} from 'lucide-react';

interface MessagePart {
  text: string;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: MessagePart[];
  animate?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  history: ChatMessage[];
  createdAt: string;
}

interface Subroutine {
  id: string;
  name: string;
  description: string;
  active: boolean;
  lastRun: string;
  status: 'ok' | 'alert' | 'idle';
  statusText: string;
}

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  onType?: () => void;
  formatFn: (t: string) => React.ReactNode;
}

const TypewriterText = ({ text, speed = 8, onComplete, onType, formatFn }: TypewriterTextProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);
  const textRef = useRef(text);

  useEffect(() => {
    textRef.current = text;
    setDisplayedText('');
    indexRef.current = 0;
    
    if (!text) {
      onComplete?.();
      return;
    }

    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayedText(textRef.current.substring(0, indexRef.current));
      onType?.();
      
      if (indexRef.current >= textRef.current.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return <>{formatFn(displayedText)}</>;
};

export const KairosChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'subroutines'>('chat');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Estados das Sub-rotinas e Alertas
  const [subroutines, setSubroutines] = useState<Subroutine[]>(() => {
    const saved = localStorage.getItem('kairos_subroutines');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: 'faturamento',
        name: 'Alerta de Faturamento',
        description: 'Alerta se o faturamento do mês atual for menor que o anterior.',
        active: true,
        lastRun: 'Nunca',
        status: 'idle',
        statusText: 'Aguardando varredura'
      },
      {
        id: 'ociosidade',
        name: 'Monitor de Ociosidade',
        description: 'Alerta se um carregador ficar sem transações por 48h.',
        active: true,
        lastRun: 'Nunca',
        status: 'idle',
        statusText: 'Aguardando varredura'
      }
    ];
  });

  const [newSubroutineText, setNewSubroutineText] = useState('');
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

  // Carrega e sincroniza sessões do chat
  useEffect(() => {
    const saved = localStorage.getItem('kairos_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map(s => ({
            ...s,
            history: s.history.map((m: ChatMessage) => ({ ...m, animate: false }))
          }));
          setSessions(cleaned);
          setActiveSessionId(cleaned[0].id);
          return;
        }
      } catch {}
    }
    
    // Inicializa com uma sessão padrão se não houver nenhuma
    const newId = 'session_' + Date.now();
    const defaultS: ChatSession = {
      id: newId,
      title: 'Conversa Inicial',
      history: [
        {
          role: 'model',
          parts: [{ text: 'Olá! Sou o **KAIROS**, o assistente inteligente da NeoPower.\n\nNo momento, estou operando em **Modo de Demonstração** (pois a chave `GEMINI_API_KEY` não foi encontrada nas variáveis de ambiente).\n\nEu posso ajudar a tirar dúvidas de fluxo do sistema e explicar como funciona a operação.\n\nSe quiser simular as minhas capacidades administrativas, você pode pedir para eu **"alterar a tarifa"** ou **"registrar um carregador"** que eu simularei o processo diretamente no banco!' }],
          animate: true
        }
      ],
      createdAt: new Date().toISOString()
    };
    setSessions([defaultS]);
    setActiveSessionId(newId);
  }, []);

  // Salva sessões no localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      const cleaned = sessions.map(s => ({
        ...s,
        history: s.history.map(({ role, parts }) => ({ role, parts }))
      }));
      localStorage.setItem('kairos_sessions', JSON.stringify(cleaned));
    }
  }, [sessions]);

  // Salva sub-rotinas no localStorage
  useEffect(() => {
    localStorage.setItem('kairos_subroutines', JSON.stringify(subroutines));
  }, [subroutines]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, loading, activeTab]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Criar nova sessão
  const handleNewSession = () => {
    const newId = 'session_' + Date.now();
    const newS: ChatSession = {
      id: newId,
      title: `Conversa ${sessions.length + 1}`,
      history: [
        {
          role: 'model',
          parts: [{ text: 'Olá! Como posso ajudar você hoje? Fique à vontade para me mandar comandos ou dúvidas!' }],
          animate: true
        }
      ],
      createdAt: new Date().toISOString()
    };
    setSessions([newS, ...sessions]);
    setActiveSessionId(newId);
    setActiveTab('chat');
    toast.success('Nova conversa criada!');
  };

  // Excluir sessão
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length === 0) {
      const newId = 'session_' + Date.now();
      const defaultS: ChatSession = {
        id: newId,
        title: 'Conversa Inicial',
        history: [
          {
            role: 'model',
            parts: [{ text: 'Olá! Sou o **KAIROS**, o seu assistente inteligente. Como posso ajudar?' }],
            animate: true
          }
        ],
        createdAt: new Date().toISOString()
      };
      setSessions([defaultS]);
      setActiveSessionId(newId);
    } else {
      setSessions(filtered);
      if (activeSessionId === id) {
        setActiveSessionId(filtered[0].id);
      }
    }
    toast.success('Conversa excluída.');
  };

  // Toggle sub-rotina
  const handleToggleSubroutine = (id: string) => {
    setSubroutines(subroutines.map(sub => 
      sub.id === id 
        ? { ...sub, active: !sub.active, status: !sub.active ? 'idle' : sub.status, statusText: !sub.active ? 'Aguardando varredura' : sub.statusText } 
        : sub
    ));
  };

  // Deletar sub-rotina ('x')
  const handleDeleteSubroutine = (id: string) => {
    setSubroutines(subroutines.filter(sub => sub.id !== id));
    toast.success('Sub-rotina removida do monitoramento.');
  };

  // Sugerir nova sub-rotina
  const handleSuggestSubroutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubroutineText.trim()) return;

    const newSub: Subroutine = {
      id: 'custom_' + Date.now(),
      name: 'Monitor Customizado',
      description: newSubroutineText.trim(),
      active: true,
      lastRun: 'Nunca',
      status: 'ok',
      statusText: 'Ativo'
    };

    setSubroutines([...subroutines, newSub]);
    setNewSubroutineText('');
    toast.success('IA registrou e ativou seu monitor customizado!');
  };

  // Simular Varredura
  const handleSimulateScan = () => {
    if (scanning) return;
    setScanning(true);
    setScanLogs([]);
    setActiveAlert(null);

    const nowStr = new Date().toLocaleTimeString('pt-BR');
    const logsToAdd = [
      { text: `[${nowStr}] 🔍 Iniciando varredura de sub-rotinas de IA...`, delay: 0 },
      { text: `[${nowStr}] ⚡ Monitorando ociosidade nos postos cadastrados...`, delay: 800 },
      { text: `[${nowStr}] ✔️ Carregadores normais. Nenhuma ociosidade detectada.`, delay: 1600 }
    ];

    const isFatActive = subroutines.find(s => s.id === 'faturamento')?.active;
    if (isFatActive) {
      logsToAdd.push({
        text: `[${nowStr}] ⚠️ ALERTA FATURAMENTO: Faturamento Junho (R$ 8.450) está 17.2% menor que Maio (R$ 10.200).`,
        delay: 2400
      });
    }

    // Adiciona log dos monitores customizados se houver
    const customSubs = subroutines.filter(s => s.id.startsWith('custom_') && s.active);
    customSubs.forEach((sub, index) => {
      logsToAdd.push({
        text: `[${nowStr}] ⚙️ Executando monitor customizado: "${sub.description}"... OK.`,
        delay: 2400 + (index + 1) * 600
      });
    });

    const finalDelay = 2400 + (customSubs.length + 1) * 600;

    logsToAdd.push({
      text: `[${nowStr}] 🎉 Varredura finalizada. Resultados salvos nos alertas.`,
      delay: finalDelay
    });

    logsToAdd.forEach((log) => {
      setTimeout(() => {
        setScanLogs(prev => [...prev, log.text]);
        if (log.delay === finalDelay) {
          setScanning(false);
          const dateStr = new Date().toLocaleTimeString('pt-BR');
          
          setSubroutines(prev => prev.map(s => {
            if (!s.active) return s;
            if (s.id === 'faturamento') {
              return { ...s, lastRun: dateStr, status: 'alert', statusText: 'Alerta ativo' };
            }
            return { ...s, lastRun: dateStr, status: 'ok', statusText: 'Status OK' };
          }));

          if (isFatActive) {
            setActiveAlert('Faturamento Junho está 17.2% menor que o mês anterior (R$ 8.450 vs R$ 10.200).');
            toast.warning('Alerta: Faturamento em queda!');
          } else {
            toast.success('Varredura concluída sem alertas ativos.');
          }
        }
      }, log.delay);
    });
  };

  // Enviar mensagem no chat
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading || !activeSession) return;

    const userMessage: ChatMessage = {
      role: 'user',
      parts: [{ text: textToSend }]
    };

    const newHistory = [...activeSession.history, userMessage];
    setSessions(sessions.map(s => s.id === activeSessionId ? { ...s, history: newHistory } : s));
    setInputMessage('');
    setLoading(true);

    try {
      const response = await api.post('/kairos/chat', { history: newHistory });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.history) {
        const updated = data.history.map((msg: any, idx: number) => ({
          ...msg,
          animate: idx === data.history.length - 1
        }));
        setSessions(sessions.map(s => s.id === activeSessionId ? { ...s, history: updated } : s));
      } else if (data && data.text) {
        setSessions(sessions.map(s => s.id === activeSessionId ? {
          ...s,
          history: [
            ...newHistory,
            {
              role: 'model',
              parts: [{ text: data.text }],
              animate: true
            }
          ]
        } : s));
      }
    } catch (error: any) {
      console.error('Erro KAIROS:', error);
      toast.error('Erro na resposta do KAIROS.');
    } finally {
      setLoading(false);
    }
  };

  const suggestionChips = [
    { label: 'Fluxo para receber dinheiro', text: 'Quero receber dinheiro com os carregadores sem ter dor de cabeça com configuração, como funciona?' },
    { label: 'Como funciona o sistema?', text: 'Como funciona o fluxo de recargas e cobranças da plataforma?' }
  ];

  const formatMessageText = (text: string) => {
    if (!text || typeof text !== 'string') return '';
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      {/* Balão circular flutuante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-14 h-14 rounded-full bg-zinc-950 border border-primary/30 flex items-center justify-center text-primary shadow-[0_4px_25px_rgba(142,255,113,0.25)] hover:shadow-[0_4px_30px_rgba(142,255,113,0.4)] active:scale-95 transition-all hover:scale-105 group"
          title="Falar com o KAIROS"
        >
          <span className="absolute inset-0 rounded-full border border-primary/40 animate-ping opacity-60 pointer-events-none" />
          <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform duration-300">smart_toy</span>
        </button>
      )}

      {/* Caixa de chat flutuante estendida */}
      {isOpen && (
        <div className="w-[410px] h-[600px] bg-surface-container/95 border border-outline-variant/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          
          {/* Cabeçalho */}
          <div className="px-4 py-3.5 bg-surface-container-high border-b border-outline-variant/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Sparkles className="w-4.5 h-4.5 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-headline font-bold text-sm text-on-surface tracking-wide">KAIROS</h3>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                </div>
                <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">AI Copilot</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Seletor de Abas */}
          <div className="flex border-b border-outline-variant/10 bg-surface-container-low/50 px-2 py-1 gap-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'chat'
                  ? 'bg-surface-container-highest text-primary border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/40'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Conversa
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-surface-container-highest text-primary border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/40'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Histórico
            </button>
            <button
              onClick={() => setActiveTab('subroutines')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'subroutines'
                  ? 'bg-surface-container-highest text-primary border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Monitores
            </button>
          </div>

          {/* Conteúdo das Abas */}
          <div className="flex-1 overflow-hidden flex flex-col">
            
            {/* 1. ABA DE CONVERSA */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest/30">
                  {activeSession?.history.map((msg, index) => {
                    const isModel = msg.role === 'model';
                    const textContent = msg.parts[0]?.text || '';
                    
                    if (!textContent.trim()) return null;

                    return (
                      <div
                        key={index}
                        className={`flex ${isModel ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                      >
                        <div className="flex gap-2.5 max-w-[85%]">
                          {isModel && (
                            <div className="w-6.5 h-6.5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 self-end mb-1">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                              isModel
                                ? 'bg-surface-container-highest text-on-surface border border-outline-variant/10 rounded-tl-none'
                                : 'bg-primary text-on-primary font-medium rounded-tr-none shadow-md shadow-primary/5'
                            }`}
                          >
                            {isModel && msg.animate ? (
                              <TypewriterText
                                text={textContent}
                                speed={8}
                                formatFn={formatMessageText}
                                onType={() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })}
                                onComplete={() => {
                                  msg.animate = false;
                                }}
                              />
                            ) : (
                              formatMessageText(textContent)
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex justify-start animate-in fade-in duration-200">
                      <div className="flex gap-2.5 max-w-[85%]">
                        <div className="w-6.5 h-6.5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 self-end mb-1">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        </div>
                        <div className="bg-surface-container-highest border border-outline-variant/10 text-on-surface px-4 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Sugestões chips */}
                {activeSession && activeSession.history.length <= 1 && !loading && (
                  <div className="p-3 bg-surface-container-low/30 border-t border-outline-variant/5">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mb-2 px-1">Dúvidas Frequentes</p>
                    <div className="flex flex-col gap-1.5">
                      {suggestionChips.map((chip, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(chip.text)}
                          className="px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant/10 text-[11px] text-on-surface-variant hover:text-primary hover:border-primary/20 transition-all text-left truncate"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulário de Input */}
                <div className="p-3 bg-surface-container-high border-t border-outline-variant/10 flex gap-2">
                  <input
                    type="text"
                    placeholder="Digite sua dúvida ou tarefa..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSendMessage(inputMessage);
                    }}
                    disabled={loading}
                    className="flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant/40 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSendMessage(inputMessage)}
                    disabled={!inputMessage.trim() || loading}
                    className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-md shadow-primary/10 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 2. ABA DE HISTÓRICO */}
            {activeTab === 'history' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest/30">
                <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Histórico de Sessões</span>
                  <button
                    onClick={handleNewSession}
                    className="px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-primary font-bold flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nova Conversa
                  </button>
                </div>

                <div className="space-y-2">
                  {sessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    return (
                      <div
                        key={session.id}
                        onClick={() => {
                          setActiveSessionId(session.id);
                          setActiveTab('chat');
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isActive
                            ? 'bg-surface-container-highest border-primary/30 text-primary shadow-[inset_0_0_10px_rgba(142,255,113,0.08)] font-semibold'
                            : 'bg-transparent border-outline-variant/5 text-on-surface-variant hover:bg-surface-container-highest/40'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                          <span className="text-xs truncate">{session.title}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1.5 rounded hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors shrink-0"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. ABA DE MONITORES (SUB-ROTINAS) */}
            {activeTab === 'subroutines' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-container-lowest/30 flex flex-col justify-between">
                <div className="space-y-3.5 flex-1">
                  
                  {/* Banner de Alerta Ativo Fechável (X) */}
                  {activeAlert && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-[10px] leading-relaxed flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 animate-bounce" />
                        <div>
                          <strong className="font-bold block">Alerta de Faturamento!</strong>
                          {activeAlert}
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveAlert(null)}
                        className="p-0.5 hover:bg-amber-500/20 rounded text-amber-400 shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Monitores Inteligentes</span>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {subroutines.map((sub) => (
                      <div
                        key={sub.id}
                        className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                          sub.active 
                            ? 'bg-surface-container-high/60 border-outline-variant/10' 
                            : 'bg-surface-container-low/10 border-transparent opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-on-surface block leading-none">{sub.name}</span>
                            <span className="text-[9px] text-on-surface-variant/80 block mt-1 leading-normal">{sub.description}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Toggle Switch */}
                            <button
                              onClick={() => handleToggleSubroutine(sub.id)}
                              className={`w-7 h-4 rounded-full p-0.5 transition-colors ${
                                sub.active ? 'bg-primary' : 'bg-surface-container-highest'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full bg-zinc-950 transition-transform ${
                                sub.active ? 'translate-x-3' : 'translate-x-0'
                              }`} />
                            </button>

                            {/* Botão de Excluir ('x') */}
                            <button
                              onClick={() => handleDeleteSubroutine(sub.id)}
                              className="p-1 rounded hover:bg-error/15 text-on-surface-variant hover:text-error transition-colors"
                              title="Remover Monitor"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {sub.active && (
                          <div className="flex items-center justify-between text-[8px] pt-1.5 border-t border-outline-variant/5">
                            <span className="text-on-surface-variant/60">Última: {sub.lastRun}</span>
                            <div className="flex items-center gap-1 font-bold">
                              {sub.status === 'ok' && (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-400">{sub.statusText}</span>
                                </>
                              )}
                              {sub.status === 'alert' && (
                                <>
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400 animate-bounce" />
                                  <span className="text-amber-400">{sub.statusText}</span>
                                </>
                              )}
                              {sub.status === 'idle' && (
                                <>
                                  <Loader2 className="w-2.5 h-2.5 text-on-surface-variant/50 animate-spin" />
                                  <span className="text-on-surface-variant/50">{sub.statusText}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Formulário: Sugerir Nova Sub-rotina */}
                  <form onSubmit={handleSuggestSubroutine} className="pt-2 border-t border-outline-variant/5 space-y-1.5">
                    <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Sugerir Rotina à IA</span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ex: Monitorar se recarga falhar à noite..."
                        value={newSubroutineText}
                        onChange={(e) => setNewSubroutineText(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-surface-container-low border border-outline-variant/15 rounded-lg text-[10px] text-on-surface focus:outline-none placeholder:text-on-surface-variant/40"
                      />
                      <button
                        type="submit"
                        disabled={!newSubroutineText.trim()}
                        className="px-2.5 py-1.5 bg-primary text-on-primary font-bold rounded-lg text-[10px] flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 transition-all shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Painel Inferior: Varredura + Terminal Logs */}
                <div className="space-y-2 mt-4 pt-3 border-t border-outline-variant/5 shrink-0">
                  <button
                    onClick={handleSimulateScan}
                    disabled={scanning}
                    className="w-full bg-primary text-on-primary py-2 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
                  >
                    {scanning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Executando Varredura...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Simular Varredura de IA
                      </>
                    )}
                  </button>

                  {scanLogs.length > 0 && (
                    <div className="p-2.5 bg-zinc-950/80 border border-outline-variant/10 rounded-lg max-h-[85px] overflow-y-auto font-mono text-[8px] text-zinc-300 space-y-0.5 scrollbar-none">
                      {scanLogs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed">
                          {log.includes('ALERTA') ? (
                            <span className="text-amber-400 font-bold">{log}</span>
                          ) : log.includes('✔️') ? (
                            <span className="text-emerald-400">{log}</span>
                          ) : (
                            log
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
};
