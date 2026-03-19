import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import {
    Mail,
    Send,
    RefreshCw,
    X,
    Inbox,
    Clock,
    User as UserIcon,
    Paperclip,
    Search,
    ChevronLeft,
    ChevronRight,
    Filter
} from 'lucide-react';

interface EmailMessage {
    id: string;
    uid: number;
    subject: string;
    from: string;
    to: string;
    date: string;
    text?: string;
    html?: string;
    isRead: boolean;
}

export const Email = () => {
    const [emails, setEmails] = useState<EmailMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [composing, setComposing] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);

    // Form state
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);

    // Filtros e Paginação
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(20);
    const [page, setPage] = useState(1);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [totalEmails, setTotalEmails] = useState(0);

    const fetchEmails = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                ...(search && { search }),
                ...(startDate && { startDate }),
                ...(endDate && { endDate })
            }).toString();

            const res = await api.get(`/email/inbox?${queryParams}`);
            if (res.ok) {
                const data = await res.json();
                setEmails(data.emails || data.payload || []);
                setTotalEmails(data.total || 0);
            } else {
                toast.error('Erro ao buscar emails');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro de conexão ao carregar e-mails');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchEmails();
    }, [page, limit, search, startDate, endDate]); // Recarregar ao mudar pagina ou limite ou filtros

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1); // Resetar página ao buscar
        void fetchEmails();
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!to || !subject || !message) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        try {
            setSending(true);
            const formData = new FormData();
            formData.append('to', to);
            formData.append('subject', subject);
            formData.append('text', message);

            attachments.forEach(file => {
                formData.append('attachments', file);
            });

            const res = await api.post('/email/send', formData);

            if (res.ok) {
                toast.success('Email enviado com sucesso!');
                setComposing(false);
                setTo('');
                setSubject('');
                setMessage('');
                setAttachments([]);
                void fetchEmails(); // Refresh inbox after sending
            } else {
                const data = await res.json();
                toast.error(data.error || 'Erro ao enviar email');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro ao enviar email');
        } finally {
            setSending(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    // Remove URLs extremamente longas do preview de texto para não poluir a caixa
    const getCleanPreview = (text: string | undefined) => {
        if (!text) return 'Sem conteúdo de texto';
        // 1. Troca links que tem https:// por [Link] 
        let cleanText = text.replace(/https?:\/\/[^\s]+/g, '[Link]').trim();
        // 2. Limita o preview em JavaScript para no máximo 120 caracteres, prevenindo falha no CSS
        if (cleanText.length > 120) {
            cleanText = cleanText.substring(0, 120) + '...';
        }
        return cleanText;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <Inbox className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Caixa de Entrada</h2>
                        <p className="text-sm text-zinc-400">Gerencie suas mensagens recebidas</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchEmails}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white hover:bg-zinc-800 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                    <button
                        onClick={() => setComposing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Mail className="w-4 h-4" />
                        Nova Mensagem
                    </button>
                </div>
            </div>

            {/* Barra de Filtros */}
            <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-3 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                <div className="flex-1 relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Buscar nos emails..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 h-[38px]"
                    />
                    <span className="text-zinc-500 text-sm">até</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 h-[38px]"
                    />
                    <button type="submit" className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-16rem)] min-h-[800px] lg:min-h-[600px]">
                {/* Inbox List */}
                <div className="col-span-1 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden shadow-lg">
                    <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center gap-2 shrink-0">
                        <Inbox className="w-5 h-5 text-emerald-500" />
                        <h2 className="text-lg font-semibold text-white">Mensagens</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                        {loading ? (
                            <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center h-full">
                                <RefreshCw className="w-8 h-8 animate-spin mb-3 opacity-50" />
                                <p>Carregando e-mails...</p>
                            </div>
                        ) : emails.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center h-full">
                                <Inbox className="w-12 h-12 mb-3 opacity-20" />
                                <p>Nenhum e-mail recebido.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-800/50">
                                {emails.map((email) => (
                                    <div
                                        key={email.id}
                                        onClick={() => setSelectedEmail(email)}
                                        className={`p-4 cursor-pointer transition-colors hover:bg-zinc-800/80 flex flex-col gap-2 ${selectedEmail?.id === email.id ? 'bg-zinc-800 border-l-2 border-emerald-500' : 'border-l-2 border-transparent'} ${!email.isRead ? 'bg-zinc-800/30' : ''}`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className={`text-sm truncate w-full ${!email.isRead ? 'font-bold text-white' : 'text-zinc-300'}`} title={email.from}>
                                                {email.from}
                                            </div>
                                            <div className="text-[11px] text-emerald-500/80 whitespace-nowrap shrink-0 font-medium pt-0.5">
                                                {formatDate(email.date).split(',')[0]}
                                            </div>
                                        </div>
                                        <div className={`text-sm truncate w-full ${!email.isRead ? 'font-semibold text-emerald-400' : 'font-medium text-white'}`} title={email.subject}>
                                            {email.subject}
                                        </div>
                                        <div className="text-xs text-zinc-500 leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap">
                                            {getCleanPreview(email.text)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Paginação */}
                    {totalEmails > 0 && (
                        <div className="flex flex-col gap-3 p-4 border-t border-zinc-800 bg-zinc-900/80 shrink-0">
                            <div className="flex items-center justify-between text-xs text-zinc-400">
                                <div className="flex items-center gap-2">
                                    <span>Mostrar:</span>
                                    <select
                                        value={limit}
                                        onChange={(e) => {
                                            setLimit(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        className="bg-zinc-950 border border-zinc-700 rounded px-1 py-0.5 min-w-[3rem] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                                <span className="font-medium">Total: {totalEmails}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1 rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
                                    Página {page}
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * limit >= totalEmails}
                                    className="p-1 rounded-md bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Email Viewer */}
                <div className="col-span-1 lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col overflow-hidden shadow-lg relative">
                    {selectedEmail ? (
                        <>
                            <div className="p-4 sm:p-6 border-b border-zinc-800 shrink-0 bg-zinc-900/80 relative overflow-hidden">
                                {/* Decorative gradient */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

                                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 break-words leading-tight relative">{selectedEmail.subject}</h2>
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 relative">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-700 border border-zinc-600 shadow-inner shrink-0 flex items-center justify-center text-zinc-300">
                                            <UserIcon className="w-6 h-6" />
                                        </div>
                                        <div className="min-w-0 flex flex-col justify-center">
                                            <div className="text-sm font-semibold text-white truncate" title={selectedEmail.from}>{selectedEmail.from}</div>
                                            <div className="text-xs text-zinc-400 truncate mt-0.5" title={selectedEmail.to}>Para: {selectedEmail.to}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-950/50 px-3 py-1.5 rounded-full shrink-0 border border-zinc-800/80">
                                        <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                        {formatDate(selectedEmail.date)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 bg-white overflow-hidden min-h-0 relative">
                                {selectedEmail.html ? (
                                    <iframe
                                        srcDoc={selectedEmail.html}
                                        className="absolute inset-0 w-full h-full border-0 outline-none bg-white"
                                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                                        title="Conteúdo do Email"
                                    />
                                ) : (
                                    <div className="absolute inset-0 p-8 overflow-y-auto whitespace-pre-wrap text-zinc-800 font-sans text-[15px] leading-relaxed">
                                        {selectedEmail.text || 'O e-mail não contém corpo de texto.'}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8 sm:p-12 relative overflow-hidden h-full">
                            {/* Decorative background for empty state */}
                            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-zinc-900 to-zinc-900" />

                            <div className="w-24 h-24 mb-6 rounded-full bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 shadow-inner relative z-10">
                                <Mail className="w-10 h-10 text-emerald-500/40" />
                            </div>
                            <h3 className="text-xl font-semibold text-white relative z-10">Tudo pronto!</h3>
                            <p className="text-sm mt-3 opacity-80 text-center max-w-sm leading-relaxed relative z-10">
                                Selecione uma mensagem na lista lateral para visualizar todo o conteúdo com segurança e rapidez.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Compose Modal */}
            {composing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
                    {/* Fixed size modal for guaranteed layout */}
                    <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl w-full max-w-3xl h-[650px] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)]">
                        {/* Header Premium */}
                        <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 bg-zinc-900/90 relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                            <h3 className="text-lg font-bold text-white flex items-center gap-3 relative z-10">
                                <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-lg border border-emerald-500/20 shadow-inner">
                                    <Send className="w-4 h-4 text-emerald-400" />
                                </div>
                                Nova Mensagem
                            </h3>
                            <button
                                onClick={() => setComposing(false)}
                                className="text-zinc-500 hover:text-white p-2 rounded-lg hover:bg-zinc-800/80 transition-all relative z-10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Elegante */}
                        <form onSubmit={handleSend} className="flex-1 flex flex-col overflow-hidden bg-zinc-950/30">
                            <div className="border-b border-zinc-800/60 px-6 py-3 flex items-center focus-within:bg-zinc-800/20 transition-colors group shrink-0">
                                <label className="text-sm font-medium text-zinc-500 w-16 shrink-0 group-focus-within:text-emerald-500 transition-colors">Para</label>
                                <input
                                    type="email"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                    placeholder="destinatario@exemplo.com"
                                    className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-white placeholder-zinc-700 text-[15px] py-1"
                                    required
                                />
                            </div>
                            <div className="border-b border-zinc-800/60 px-6 py-3 flex items-center focus-within:bg-zinc-800/20 transition-colors group shrink-0">
                                <label className="text-sm font-medium text-zinc-500 w-16 shrink-0 group-focus-within:text-emerald-500 transition-colors">Assunto</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Qual o tema da sua mensagem?"
                                    className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-white placeholder-zinc-700 text-[15px] font-medium py-1"
                                    required
                                />
                            </div>

                            <div className="flex-1 p-6 flex flex-col min-h-0 bg-zinc-950/20">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Escreva sua mensagem aqui..."
                                    className="flex-1 w-full h-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-zinc-200 placeholder-zinc-700 text-[15px] resize-none leading-relaxed p-0 m-0"
                                    required
                                />
                            </div>

                            {/* Area de Anexos re-desenhada */}
                            <div className="px-6 pb-4 bg-zinc-950/20 shrink-0">
                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-4 border-t border-zinc-800/30">
                                        {attachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-700/60 px-3 py-1.5 rounded-full text-xs text-zinc-300 backdrop-blur-sm shadow-sm group hover:border-emerald-500/50 transition-colors">
                                                <Paperclip className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="truncate max-w-[150px] font-medium">{file.name}</span>
                                                <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                                    className="hover:bg-red-500/20 hover:text-red-400 p-0.5 rounded-full text-zinc-500 transition-colors ml-1 focus:outline-none"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Rodape Moderno */}
                            <div className="flex justify-between items-center px-6 py-4 bg-zinc-900 border-t border-zinc-800/80 shrink-0">
                                <label className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-800 border border-transparent hover:border-zinc-700/50 rounded-lg cursor-pointer transition-all text-zinc-400 hover:text-white group focus-within:ring-2 focus-within:ring-emerald-500/50">
                                    <div className="bg-zinc-800 group-hover:bg-zinc-700 p-1.5 rounded-md transition-colors shadow-sm">
                                        <Paperclip className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <span className="text-sm font-medium">Anexar</span>
                                    {/* style used instead of hidden class to ensure robust hiding across browsers without losing pointer functionality */}
                                    <input
                                        type="file"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            if (e.target.files) {
                                                setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                                            }
                                        }}
                                    />
                                </label>

                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium rounded-lg hover:from-emerald-500 hover:to-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-emerald-500"
                                >
                                    {sending ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            Enviar Mensagem
                                            <Send className="w-4 h-4 ml-1" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
