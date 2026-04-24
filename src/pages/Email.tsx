import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface UserContact {
    id: number;
    name: string;
    email: string;
    platform: string | null;
}

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
    const [sendMode, setSendMode] = useState<'individual' | 'group' | 'all'>('individual');
    const [targetPlatform, setTargetPlatform] = useState<'all' | 'web' | 'mobile'>('all');
    const [selectedUsers, setSelectedUsers] = useState<UserContact[]>([]);
    const [allUsers, setAllUsers] = useState<UserContact[]>([]);
    const [previewMode, setPreviewMode] = useState(false);
    
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [htmlMessage, setHtmlMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);

    const [activeTab, setActiveTab] = useState<'inbox' | 'sent'>('inbox');

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
                folder: activeTab === 'sent' ? '[Gmail]/Sent Mail' : 'INBOX',
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
    }, [page, limit, search, startDate, endDate, activeTab]);

    useEffect(() => {
        if (composing && allUsers.length === 0) {
            const fetchAllUsers = async () => {
                try {
                    const res = await api.get('/admin/users');
                    if (res.ok) {
                        const data = await res.json();
                        setAllUsers(data || []);
                    }
                } catch (error) {
                    console.error('Erro ao buscar usuários', error);
                }
            };
            fetchAllUsers();
        }
    }, [composing, allUsers.length]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        void fetchEmails();
    };

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (!subject || !htmlMessage) {
            toast.error('Preencha os campos obrigatórios (Assunto e Mensagem)');
            return;
        }

        if (sendMode === 'individual' && !to && selectedUsers.length === 0) {
            toast.error('Informe um destinatário');
            return;
        }
        
        if (sendMode === 'group' && selectedUsers.length === 0) {
            toast.error('Selecione ao menos um destinatário');
            return;
        }

        if (!previewMode) {
            setPreviewMode(true);
            return;
        }

        try {
            setSending(true);
            const formData = new FormData();
            formData.append('subject', subject);
            formData.append('html', htmlMessage);
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlMessage;
            formData.append('text', tempDiv.textContent || tempDiv.innerText || '');

            if (sendMode === 'all') {
                formData.append('sendToAll', 'true');
                formData.append('targetPlatform', targetPlatform);
            } else if (sendMode === 'group') {
                formData.append('recipients', JSON.stringify(selectedUsers));
            } else {
                if (selectedUsers.length > 0) {
                     formData.append('recipients', JSON.stringify(selectedUsers));
                } else {
                     formData.append('to', to);
                }
            }

            attachments.forEach(file => {
                formData.append('attachments', file);
            });

            const res = await api.post('/email/send', formData);

            if (res.ok) {
                const data = await res.json();
                const sucessos = data.successCount || 0;
                const falhas = data.failedCount || 0;
                toast.success(`Envio concluído! Entregues: ${sucessos} | Falhas: ${falhas}`);
                setComposing(false);
                setPreviewMode(false);
                setTo('');
                setSubject('');
                setHtmlMessage('');
                setSelectedUsers([]);
                setAttachments([]);
                void fetchEmails();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Erro ao enviar email');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro de conexão ao enviar e-mail');
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

    const getCleanPreview = (text: string | undefined) => {
        if (!text) return 'Sem conteúdo de texto';
        let cleanText = text.replace(/https?:\/\/[^\s]+/g, '[Link]').trim();
        if (cleanText.length > 120) {
            cleanText = cleanText.substring(0, 120) + '...';
        }
        return cleanText;
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <span className="text-xs font-bold text-primary font-headline tracking-[0.2em] uppercase mb-1 block">COMMUNICATIONS</span>
                    <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">
                        {activeTab === 'inbox' ? 'Caixa de Entrada' : 'Enviados'}
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={fetchEmails}
                        disabled={loading}
                        className="flex items-center gap-2 bg-surface-container-low px-4 py-2.5 rounded-lg border border-outline-variant/10 text-on-surface-variant hover:text-primary transition-colors"
                    >
                        <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
                        <span className="text-xs font-bold font-headline uppercase tracking-wider">Atualizar</span>
                    </button>
                    <button
                        onClick={() => setComposing(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-tr from-primary to-secondary text-on-primary font-bold text-xs font-headline uppercase tracking-wider transition-all hover:shadow-lg hover:shadow-primary/20"
                    >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Nova Mensagem
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-outline-variant/20 pb-0">
                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`px-6 py-2.5 text-sm font-bold transition-colors border-b-2 ${activeTab === 'inbox' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                    Caixa de Entrada
                </button>
                <button
                    onClick={() => setActiveTab('sent')}
                    className={`px-6 py-2.5 text-sm font-bold transition-colors border-b-2 ${activeTab === 'sent' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                    E-mails Enviados
                </button>
            </div>

            {/* Filters Bar */}
            <form onSubmit={handleSearch} className="glass-panel flex flex-col md:flex-row items-center gap-3 p-4 rounded-xl border border-outline-variant/10">
                <div className="flex-1 relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base text-on-surface-variant">search</span>
                    <input
                        type="text"
                        placeholder="Buscar nos emails..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 h-[42px]"
                    />
                    <span className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">até</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50 h-[42px]"
                    />
                    <button type="submit" className="p-2.5 bg-surface-container-highest hover:text-primary text-on-surface-variant rounded-lg transition-colors border border-outline-variant/10">
                        <span className="material-symbols-outlined text-base">filter_list</span>
                    </button>
                </div>
            </form>

            {/* 2-Panel Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-20rem)] min-h-[800px] lg:min-h-[600px]">
                {/* Inbox List */}
                <div className="col-span-1 bg-surface-container-low rounded-xl border border-outline-variant/10 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-outline-variant/10 flex items-center gap-2 shrink-0">
                        <span className="material-symbols-outlined text-primary">inbox</span>
                        <h3 className="text-lg font-headline font-bold text-on-surface">Mensagens</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {loading ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3" />
                                <p className="text-sm text-on-surface-variant">Carregando e-mails...</p>
                            </div>
                        ) : emails.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                                <span className="material-symbols-outlined text-5xl text-outline mb-3">inbox</span>
                                <p className="text-sm text-on-surface-variant">Nenhum e-mail recebido.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-outline-variant/5">
                                {emails.map((email) => (
                                    <div
                                        key={email.id}
                                        onClick={() => setSelectedEmail(email)}
                                        className={`p-4 cursor-pointer transition-colors hover:bg-surface-container-highest/30 flex flex-col gap-2
                                            ${selectedEmail?.id === email.id
                                                ? 'bg-surface-container-highest'
                                                : !email.isRead
                                                    ? 'border-l-2 border-primary bg-primary/5'
                                                    : 'border-l-2 border-transparent'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className={`text-sm truncate w-full ${!email.isRead && activeTab === 'inbox' ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`} title={activeTab === 'inbox' ? email.from : email.to}>
                                                {activeTab === 'inbox' ? email.from : `Para: ${email.to}`}
                                            </div>
                                            <div className="text-[10px] text-on-surface-variant uppercase tracking-widest whitespace-nowrap shrink-0 pt-0.5">
                                                {formatDate(email.date).split(',')[0]}
                                            </div>
                                        </div>
                                        <div className={`text-sm truncate w-full ${!email.isRead ? 'font-headline font-bold text-primary' : 'font-headline font-bold text-on-surface'}`} title={email.subject}>
                                            {email.subject}
                                        </div>
                                        <div className="text-xs text-on-surface-variant leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap">
                                            {getCleanPreview(email.text)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalEmails > 0 && (
                        <div className="flex flex-col gap-3 p-4 border-t border-outline-variant/10 shrink-0">
                            <div className="flex items-center justify-between text-xs text-on-surface-variant">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold uppercase tracking-wider">Mostrar:</span>
                                    <select
                                        value={limit}
                                        onChange={(e) => {
                                            setLimit(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        className="bg-surface-container-highest border border-outline-variant/10 rounded px-1.5 py-1 min-w-[3rem] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                                <span className="font-bold text-on-surface">Total: {totalEmails}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
                                >
                                    <span className="material-symbols-outlined text-base">chevron_left</span>
                                </button>
                                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                                    Página {page}
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * limit >= totalEmails}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-highest text-on-surface-variant hover:text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-outline-variant/10"
                                >
                                    <span className="material-symbols-outlined text-base">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Email Viewer */}
                <div className="col-span-1 lg:col-span-2 bg-surface-container-low rounded-xl border border-outline-variant/10 flex flex-col overflow-hidden relative">
                    {selectedEmail ? (
                        <>
                            <div className="p-4 sm:p-6 border-b border-outline-variant/10 shrink-0 relative overflow-hidden">
                                <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                                <h2 className="text-xl sm:text-2xl font-headline font-bold text-on-surface mb-4 break-words leading-tight relative">{selectedEmail.subject}</h2>
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 relative">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 border border-outline-variant/10 shrink-0 flex items-center justify-center text-primary">
                                            <span className="material-symbols-outlined text-xl">person</span>
                                        </div>
                                        <div className="min-w-0 flex flex-col justify-center">
                                            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-0.5">{activeTab === 'inbox' ? 'De' : 'Para'}</span>
                                            <div className="text-sm font-bold text-on-surface truncate" title={activeTab === 'inbox' ? selectedEmail.from : selectedEmail.to}>{activeTab === 'inbox' ? selectedEmail.from : selectedEmail.to}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest bg-surface-container-highest px-3 py-1.5 rounded-full shrink-0 border border-outline-variant/10">
                                        <span className="material-symbols-outlined text-sm text-primary">schedule</span>
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
                        <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 relative overflow-hidden h-full">
                            <span className="material-symbols-outlined text-6xl text-outline mb-4">mark_email_read</span>
                            <h3 className="text-xl font-headline font-bold text-on-surface">Tudo pronto!</h3>
                            <p className="text-sm mt-3 text-on-surface-variant text-center max-w-sm leading-relaxed">
                                Selecione uma mensagem na lista lateral para visualizar todo o conteúdo com segurança e rapidez.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Compose Modal */}
            {composing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-surface-container border border-outline-variant/20 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20 relative overflow-hidden shrink-0">
                            <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                            <h3 className="text-lg font-headline font-bold text-on-surface flex items-center gap-3 relative z-10">
                                <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                                    <span className="material-symbols-outlined text-base text-primary">send</span>
                                </div>
                                {previewMode ? 'Pré-visualização do Envio' : 'Nova Mensagem'}
                            </h3>
                            <button
                                onClick={() => {
                                    if (previewMode) setPreviewMode(false);
                                    else setComposing(false);
                                }}
                                className="text-on-surface-variant hover:text-on-surface p-2 rounded-lg hover:bg-surface-container-highest transition-all relative z-10 focus:outline-none"
                            >
                                <span className="material-symbols-outlined text-xl">{previewMode ? 'arrow_back' : 'close'}</span>
                            </button>
                        </div>

                        {/* Form / Preview Area */}
                        {!previewMode ? (
                            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex-1 flex flex-col overflow-y-auto">
                                <div className="p-4 border-b border-outline-variant/20 flex flex-col gap-4">
                                    {/* Send Mode Selection */}
                                    <div className="flex items-center gap-4 border-b border-outline-variant/10 pb-4">
                                        <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider text-[10px] w-20">Modo</label>
                                        <div className="flex gap-2 bg-surface-container-low p-1 rounded-lg">
                                            <button type="button" onClick={() => setSendMode('individual')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${sendMode === 'individual' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Individual</button>
                                            <button type="button" onClick={() => setSendMode('group')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${sendMode === 'group' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Grupo</button>
                                            <button type="button" onClick={() => setSendMode('all')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${sendMode === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>Em Massa</button>
                                        </div>
                                    </div>

                                    {/* To / Target Selection */}
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider text-[10px] w-20 shrink-0">Para</label>
                                        
                                        {sendMode === 'individual' && (
                                            <input
                                                type="text"
                                                value={to}
                                                onChange={(e) => setTo(e.target.value)}
                                                placeholder="Email ou nome (busca simples)..."
                                                className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/50"
                                            />
                                        )}

                                        {sendMode === 'group' && (
                                            <div className="flex-1 flex flex-col gap-2">
                                                <select
                                                    onChange={(e) => {
                                                        const user = allUsers.find(u => u.id === parseInt(e.target.value));
                                                        if (user && !selectedUsers.find(u => u.id === user.id)) {
                                                            setSelectedUsers([...selectedUsers, user]);
                                                        }
                                                        e.target.value = "";
                                                    }}
                                                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/50"
                                                >
                                                    <option value="">Selecione usuários para adicionar...</option>
                                                    {allUsers.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name || 'Sem nome'} ({u.email})</option>
                                                    ))}
                                                </select>
                                                {selectedUsers.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {selectedUsers.map(user => (
                                                            <div key={user.id} className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-bold">
                                                                {user.name || user.email}
                                                                <button type="button" onClick={() => setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))} className="hover:text-error">
                                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {sendMode === 'all' && (
                                            <div className="flex-1 flex gap-3 items-center">
                                                <span className="text-sm text-on-surface">Todos os usuários cadastrados. Filtrar plataforma:</span>
                                                <select
                                                    value={targetPlatform}
                                                    onChange={(e) => setTargetPlatform(e.target.value as any)}
                                                    className="bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary/50 font-bold"
                                                >
                                                    <option value="all">Ambas (Web e App)</option>
                                                    <option value="web">Apenas Web</option>
                                                    <option value="mobile">Apenas App</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-4 pt-2">
                                        <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider text-[10px] w-20 shrink-0">Assunto</label>
                                        <input
                                            type="text"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="Qual o tema da sua mensagem?"
                                            className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/50 font-medium"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col p-4">
                                    <div className="flex justify-between items-end mb-2">
                                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Mensagem</label>
                                        <span className="text-[10px] text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded font-mono">Variáveis: {`{nome_do_usuario}`}, {`{email}`}</span>
                                    </div>
                                    <div className="flex-1 border border-outline-variant/20 rounded-lg overflow-hidden bg-white text-zinc-800 flex flex-col min-h-[250px]">
                                        <ReactQuill 
                                            theme="snow" 
                                            value={htmlMessage} 
                                            onChange={setHtmlMessage}
                                            className="flex-1 flex flex-col [&_.ql-container]:flex-1 [&_.ql-editor]:min-h-[200px]"
                                            modules={{
                                                toolbar: [
                                                    [{ 'header': [1, 2, false] }],
                                                    ['bold', 'italic', 'underline', 'strike'],
                                                    [{'list': 'ordered'}, {'list': 'bullet'}],
                                                    ['link'],
                                                    ['clean']
                                                ]
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Attachments Area */}
                                <div className="px-6 pb-4 shrink-0">
                                    {attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-4 border-t border-outline-variant/10">
                                            {attachments.map((file, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 px-3 py-1.5 rounded-full text-xs text-on-surface group hover:border-primary/50 transition-colors">
                                                    <span className="material-symbols-outlined text-sm text-primary">attach_file</span>
                                                    <span className="truncate max-w-[150px] font-medium">{file.name}</span>
                                                    <span className="text-[10px] text-on-surface-variant uppercase font-mono tracking-wider">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                                        className="hover:bg-error/10 hover:text-error p-0.5 rounded-full text-on-surface-variant transition-colors ml-1 focus:outline-none"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex justify-between items-center px-6 py-4 bg-surface-container border-t border-outline-variant/20 shrink-0">
                                    <label className="flex items-center gap-2.5 px-4 py-2 hover:bg-surface-container-highest border border-transparent hover:border-outline-variant/10 rounded-lg cursor-pointer transition-all text-on-surface-variant hover:text-on-surface group focus-within:ring-2 focus-within:ring-primary/50">
                                        <div className="bg-surface-container-highest group-hover:bg-primary/10 p-1.5 rounded-md transition-colors">
                                            <span className="material-symbols-outlined text-base text-primary">attach_file</span>
                                        </div>
                                        <span className="text-sm font-bold">Anexar</span>
                                        <input
                                            type="file"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    const filesArray = Array.from(e.target.files);
                                                    const validFiles = filesArray.filter(file => {
                                                        const ext = file.name.split('.').pop()?.toLowerCase();
                                                        const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'gif'];
                                                        if (!ext || !allowedExts.includes(ext)) {
                                                            toast.error(`Arquivo ${file.name} não suportado.`);
                                                            return false;
                                                        }
                                                        if (file.size > 10 * 1024 * 1024) {
                                                            toast.error(`Arquivo ${file.name} excede o limite de 10MB.`);
                                                            return false;
                                                        }
                                                        return true;
                                                    });
                                                    setAttachments(prev => [...prev, ...validFiles]);
                                                }
                                            }}
                                        />
                                    </label>

                                    <button
                                        type="submit"
                                        className="px-8 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                                    >
                                        Revisar e Enviar
                                        <span className="material-symbols-outlined text-base ml-1">arrow_forward</span>
                                    </button>
                                </div>
                            </form>
                        ) : (
                            // Preview Mode
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="p-6 border-b border-outline-variant/20 bg-surface-container-low flex flex-col gap-2 shrink-0">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-lg font-headline font-bold text-on-surface">Confirmar Detalhes</h4>
                                        <span className="bg-tertiary/10 text-tertiary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                                            {sendMode === 'all' ? `Em Massa (${targetPlatform})` : sendMode === 'group' ? `Grupo (${selectedUsers.length})` : 'Individual'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-on-surface-variant">
                                        As variáveis serão substituídas pelos dados de cada usuário. Abaixo, um exemplo de como a mensagem aparecerá para o destinatário:
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="border border-outline-variant/20 rounded-xl overflow-hidden bg-white p-8">
                                        <div className="border-b border-gray-200 pb-4 mb-4">
                                            <p className="text-sm text-gray-500 mb-1"><strong>Assunto:</strong> {subject}</p>
                                            <p className="text-sm text-gray-500"><strong>Para:</strong> {sendMode === 'all' ? 'Todos os usuários' : sendMode === 'group' ? selectedUsers.map(u => u.name || u.email).join(', ') : to}</p>
                                        </div>
                                        <div className="text-zinc-800 font-sans leading-relaxed quill-content" dangerouslySetInnerHTML={{
                                            __html: htmlMessage
                                                .replace(/{nome_do_usuario}/g, selectedUsers[0]?.name || 'Usuário Exemplo')
                                                .replace(/{email}/g, selectedUsers[0]?.email || 'usuario@exemplo.com')
                                        }} />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center px-6 py-4 bg-surface-container border-t border-outline-variant/20 shrink-0">
                                    <button onClick={() => setPreviewMode(false)} className="px-6 py-2 rounded-full border border-outline-variant/20 text-on-surface-variant font-bold hover:bg-surface-container-highest transition-colors">
                                        Voltar
                                    </button>
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={sending}
                                        className="px-8 py-2.5 rounded-full bg-primary text-on-primary font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-primary/30"
                                    >
                                        {sending ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-primary" />
                                                Enviando...
                                            </>
                                        ) : (
                                            <>
                                                Confirmar Envio
                                                <span className="material-symbols-outlined text-base ml-1">send</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
