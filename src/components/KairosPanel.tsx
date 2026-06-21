import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Loader2, 
  Send, 
  Sparkles, 
  MessageSquare, 
  ChevronRight,
  RefreshCw,
  X,
  Check,
  Bot
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

const generateSessionTitle = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('tarifa') || lower.includes('preço') || lower.includes('valor') || lower.includes('dinheiro') || lower.includes('receber') || lower.includes('kwh')) {
    return 'Tarifas e Faturamento';
  }
  if (lower.includes('carregador') || lower.includes('posto') || lower.includes('estação') || lower.includes('eletroposto') || lower.includes('cadastrar')) {
    return 'Cadastro de Posto';
  }
  if (lower.includes('voucher') || lower.includes('cupom') || lower.includes('desconto')) {
    return 'Cupons e Vouchers';
  }
  if (lower.includes('fluxo') || lower.includes('como funciona') || lower.includes('operação')) {
    return 'Dúvidas de Operação';
  }
  if (lower.includes('erro') || lower.includes('alerta') || lower.includes('problema')) {
    return 'Suporte do Sistema';
  }
  
  // Fallback: primeiras 3-4 palavras
  const cleanText = text.replace(/[#*`_]/g, '').trim();
  const words = cleanText.split(/\s+/);
  if (words.length <= 4) {
    return cleanText;
  }
  return words.slice(0, 4).join(' ') + '...';
};

interface KairosPanelProps {
  onClose: () => void;
}

export const KairosPanel = ({ onClose }: KairosPanelProps) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStepText, setLoadingStepText] = useState('processando sua solicitação...');

  useEffect(() => {
    if (!loading) {
      setLoadingStepText('processando sua solicitação...');
      return;
    }

    const steps = [
      'consultando o banco de dados...',
      'analisando dados da plataforma...',
      'executando ferramentas administrativas...',
      'consolidando informações e gerando resposta...'
    ];

    let current = 0;
    const interval = setInterval(() => {
      setLoadingStepText(steps[current % steps.length]);
      current++;
    }, 1800);

    return () => clearInterval(interval);
  }, [loading]);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [subroutines, setSubroutines] = useState<Subroutine[]>(() => {
    const saved = localStorage.getItem('kairos_subroutines');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
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
      title: 'Nova Conversa...',
      history: [
        {
          role: 'model',
          parts: [{ text: 'Olá! Sou o **KAIROS**, o assistente inteligente da NeoPower. Como posso te ajudar hoje?' }],
          animate: true
        }
      ],
      createdAt: new Date().toISOString()
    };
    setSessions([defaultS]);
    setActiveSessionId(newId);
  }, []);

  // Salva sessões no localStorage sempre que mudam
  useEffect(() => {
    if (sessions.length > 0) {
      const cleaned = sessions.map(s => ({
        ...s,
        history: s.history.map(({ role, parts }) => ({ role, parts }))
      }));
      localStorage.setItem('kairos_sessions', JSON.stringify(cleaned));
    }
  }, [sessions]);

  // Salva sub-rotinas
  useEffect(() => {
    localStorage.setItem('kairos_subroutines', JSON.stringify(subroutines));
  }, [subroutines]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, loading]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // Criar nova sessão
  const handleNewSession = () => {
    const newId = 'session_' + Date.now();
    const newS: ChatSession = {
      id: newId,
      title: 'Nova Conversa...',
      history: [
        {
          role: 'model',
          parts: [{ text: 'Olá! Como posso te ajudar com a gestão da NeoPower hoje? Você pode me perguntar sobre postos, tarifas ou configurar novos alertas!' }],
          animate: true
        }
      ],
      createdAt: new Date().toISOString()
    };
    setSessions([newS, ...sessions]);
    setActiveSessionId(newId);
  };

  // Excluir sessão
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length === 0) {
      const newId = 'session_' + Date.now();
      const defaultS: ChatSession = {
        id: newId,
        title: 'Nova Conversa...',
        history: [
          {
            role: 'model',
            parts: [{ text: 'Olá! Sou o **KAIROS**, o seu assistente inteligente. Como posso te ajudar hoje?' }],
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

  // Renomear sessão
  const startRenameSession = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleText(currentTitle);
  };

  const saveRenameSession = (id: string) => {
    if (!editTitleText.trim()) return;
    setSessions(sessions.map(s => s.id === id ? { ...s, title: editTitleText.trim() } : s));
    setEditingSessionId(null);
  };

  // Toggle sub-rotina
  const handleToggleSubroutine = (id: string) => {
    setSubroutines(subroutines.map(sub => 
      sub.id === id 
        ? { ...sub, active: !sub.active, status: !sub.active ? 'idle' : sub.status, statusText: !sub.active ? 'Aguardando varredura' : sub.statusText } 
        : sub
    ));
    toast.success('Configuração de sub-rotina salva.');
  };

  // Deletar sub-rotina
  const handleDeleteSubroutine = (id: string) => {
    setSubroutines(subroutines.filter(sub => sub.id !== id));
    toast.success('Sub-rotina excluída.');
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
      { text: `[${nowStr}] ⚡ Monitorando ociosidade nos pontos de recarga...`, delay: 800 },
      { text: `[${nowStr}] ✔️ Analisados carregadores ativos. Nenhum ocioso > 48h.`, delay: 1600 }
    ];

    const isFatActive = subroutines.find(s => s.id === 'faturamento')?.active;
    if (isFatActive) {
      logsToAdd.push({
        text: `[${nowStr}] ⚠️ ALERTA FATURAMENTO: Queda de 17.2% detectada. Faturamento Junho (R$ 8.450,00) menor que Maio (R$ 10.200,00).`,
        delay: 2400
      });
    }

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
              return { ...s, lastRun: dateStr, status: 'alert', statusText: 'Faturamento em queda (17.2%)!' };
            }
            return { ...s, lastRun: dateStr, status: 'ok', statusText: 'Status OK' };
          }));

          if (isFatActive) {
            setActiveAlert('Faturamento Junho está 17.2% menor que o mês anterior (R$ 8.450 vs R$ 10.200).');
            toast.warning('Alerta de IA: Faturamento em Queda!');
          } else {
            toast.success('Varredura concluída sem alertas ativos.');
          }
        }
      }, log.delay);
    });
  };

  // Enviar mensagem
  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading || !activeSession) return;

    const userMessage: ChatMessage = {
      role: 'user',
      parts: [{ text: textToSend }]
    };

    const newHistory = [...activeSession.history, userMessage];

    // Se for a primeira mensagem do usuário nesta conversa
    const isFirstUserMessage = activeSession.history.filter(m => m.role === 'user').length === 0;
    const updatedTitle = isFirstUserMessage ? generateSessionTitle(textToSend) : activeSession.title;

    setSessions(sessions.map(s => s.id === activeSessionId ? { ...s, title: updatedTitle, history: newHistory } : s));
    setInputMessage('');
    setLoading(true);

    try {
      const response = await api.post('/kairos/chat', { history: newHistory });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.history) {
        const updatedHistory = data.history.map((msg: any, idx: number) => ({
          ...msg,
          animate: idx === data.history.length - 1
        }));
        setSessions(sessions.map(s => s.id === activeSessionId ? { ...s, title: updatedTitle, history: updatedHistory } : s));
      } else if (data && data.text) {
        setSessions(sessions.map(s => s.id === activeSessionId ? {
          ...s,
          title: updatedTitle,
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
      toast.error('Falha ao obter resposta do KAIROS.');
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
    <div className="fixed top-0 right-0 left-64 bottom-0 z-50 bg-background/95 border-l border-sidebar-border/10 backdrop-blur-xl animate-in fade-in slide-in-from-right duration-300 flex flex-col p-8 font-sans overflow-hidden">
      {/* Cabeçalho superior do Painel */}
      <div className="flex justify-between items-center pb-6 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(142,255,113,0.15)] animate-pulse">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-headline font-black text-lg text-on-surface tracking-wide flex items-center gap-2 leading-none">
              KAIROS IA
            </h2>
            <span className="text-[10px] text-on-surface-variant/80 mt-1 block">
              Painel Avançado e Assistente Virtual da Plataforma NeoPower
            </span>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant/10 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:scale-105 active:scale-95 transition-all"
          title="Fechar Painel KAIROS"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Conteúdo de 3 Colunas */}
      <div className="flex-1 flex gap-6 mt-6 overflow-hidden">
        
        {/* 1. Coluna Esquerda: Histórico de Conversas */}
        <div className="w-72 bg-surface-container/40 border border-outline-variant/10 rounded-2xl p-4 flex flex-col justify-between overflow-hidden">
          <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface-variant">Conversas Recentes</h3>
              <button
                onClick={handleNewSession}
                className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                title="Nova Conversa"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isEditing = session.id === editingSessionId;

                return (
                  <div
                    key={session.id}
                    onClick={() => !isEditing && setActiveSessionId(session.id)}
                    className={`group p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isActive
                        ? 'bg-surface-container-highest border-primary/30 text-primary shadow-[inset_0_0_12px_rgba(142,255,113,0.08)]'
                        : 'bg-transparent border-transparent text-on-surface-variant hover:bg-surface-container-highest/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-on-surface-variant/70'}`} />
                      
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitleText}
                          onChange={(e) => setEditTitleText(e.target.value)}
                          onBlur={() => saveRenameSession(session.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRenameSession(session.id);
                          }}
                          autoFocus
                          className="bg-surface-container-low border border-primary/30 rounded px-1.5 py-0.5 text-xs text-on-surface focus:outline-none w-full"
                        />
                      ) : (
                        <span className="text-xs truncate font-semibold">{session.title}</span>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => startRenameSession(session.id, session.title, e)}
                          className="p-1 rounded text-on-surface-variant hover:text-foreground hover:bg-surface-container-highest"
                          title="Renomear"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error/15"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="text-[10px] text-on-surface-variant/40 text-center border-t border-outline-variant/5 pt-3 shrink-0">
            Armazenamento Local
          </div>
        </div>

        {/* 2. Coluna Central: Chat Principal */}
        <div className="flex-1 bg-surface-container/40 border border-outline-variant/10 rounded-2xl flex flex-col overflow-hidden">
          {/* Mensagens do chat */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-container-lowest/10">
            {activeSession?.history.map((msg, index) => {
              const isModel = msg.role === 'model';
              const textContent = msg.parts[0]?.text || '';
              
              if (!textContent.trim()) return null;

              return (
                <div
                  key={index}
                  className={`flex ${isModel ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                >
                  <div className="flex gap-3 max-w-[85%]">
                    {isModel && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 self-end mb-1">
                        <Bot className="w-4.5 h-4.5" />
                      </div>
                    )}
                    <div
                      className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
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
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 self-end mb-1">
                    <Bot className="w-4.5 h-4.5 animate-pulse" />
                  </div>
                  <div className="flex flex-col">
                    <div className="bg-surface-container-highest border border-outline-variant/10 text-on-surface px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                      <span className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[10px] text-on-surface-variant/70 animate-pulse font-mono block mt-1 px-1">
                      KAIROS está {loadingStepText}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sugestões chips */}
          {activeSession && activeSession.history.length <= 1 && !loading && (
            <div className="p-4 bg-surface-container-low/40 border-t border-outline-variant/5">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mb-2 px-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Perguntas Frequentes
              </p>
              <div className="grid grid-cols-2 gap-2">
                {suggestionChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(chip.text)}
                    className="px-3 py-2 rounded-xl bg-surface-container-highest/60 border border-outline-variant/10 text-[11px] text-on-surface-variant hover:text-primary hover:border-primary/20 transition-all text-left truncate"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formulário de Input */}
          <div className="p-4 bg-surface-container-high/40 border-t border-outline-variant/10 flex gap-2">
            <input
              type="text"
              placeholder="Pergunte ao KAIROS..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSendMessage(inputMessage);
              }}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs text-on-surface focus:outline-none focus:border-primary placeholder:text-on-surface-variant/40 disabled:opacity-50"
            />
            <button
              onClick={() => handleSendMessage(inputMessage)}
              disabled={!inputMessage.trim() || loading}
              className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shadow-md shadow-primary/10 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. Coluna Direita: Sub-rotinas & Alertas */}
        <div className="w-96 bg-surface-container/40 border border-outline-variant/10 rounded-2xl p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div>
              <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                Monitores & Alertas
              </h3>
              <p className="text-[10px] text-on-surface-variant/70 mt-1 leading-normal">
                Verifique e configure sub-rotinas inteligentes rodando no background.
              </p>
            </div>

            {/* Alerta ativo fechável (X) */}
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
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {subroutines.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-6 px-4 border border-dashed border-outline-variant/10 rounded-xl bg-surface-container-low/10">
                  <Bot className="w-8 h-8 text-on-surface-variant/30 mb-2 animate-pulse" />
                  <p className="text-[10px] text-on-surface-variant/50 leading-normal">
                    Nenhum monitor ativo no momento. Sugira uma rotina à IA abaixo para iniciar o monitoramento!
                  </p>
                </div>
              ) : (
                subroutines.map((sub) => (
                  <div 
                    key={sub.id} 
                    className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                      sub.active 
                        ? 'bg-surface-container-high/40 border-outline-variant/10' 
                        : 'bg-surface-container-low/10 border-transparent opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-on-surface leading-none">{sub.name}</h4>
                        <p className="text-[9px] text-on-surface-variant/75 mt-1.5 leading-normal">{sub.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Toggle switch */}
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
                      <div className="mt-1.5 pt-1.5 border-t border-outline-variant/5 flex items-center justify-between text-[8px]">
                        <span className="text-on-surface-variant/60 font-medium">Última: {sub.lastRun}</span>
                        
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
                ))
              )}
            </div>

            {/* Sugerir nova sub-rotina */}
            <form onSubmit={handleSuggestSubroutine} className="pt-2 border-t border-outline-variant/5 space-y-1.5">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider block">Sugerir Rotina à IA</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Ex: Alerta se recarga falhar a noite..."
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

          {/* Varredura */}
          <div className="space-y-2 mt-4 pt-3 border-t border-outline-variant/5 shrink-0">
            <button
              onClick={handleSimulateScan}
              disabled={scanning}
              className="w-full bg-primary text-on-primary py-2.5 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
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
              <div className="p-2.5 bg-zinc-950/80 border border-outline-variant/10 rounded-lg max-h-[85px] overflow-y-auto font-mono text-[8px] text-zinc-300 space-y-0.5 scrollbar-thin">
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

      </div>
    </div>
  );
};
