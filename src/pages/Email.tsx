import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
    ArrowLeft,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Clock,
    Filter,
    Inbox,
    Loader2,
    MailCheck,
    Paperclip,
    PenSquare,
    Send,
    User,
    X,
} from 'lucide-react';
import {
    AbasDaPagina,
    BotaoAtualizar,
    CabecalhoDaPagina,
    classeDoCartao,
} from '../components/painel/Pagina';
import {
    BarraDeFiltros,
    CampoDeBusca,
    classeDoBotaoContorno,
    classeDoBotaoPrincipal,
} from '../components/painel/Pecas';
import { EstadoVazio, classeDaEtiqueta } from '../components/configuracoes/Pecas';

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

/** Campo do formulário de envio: borda fina, cantos de 10 px, fundo do cartão. */
const classeDoCampoDoEmail =
    'bg-card border border-border rounded-[10px] px-3 h-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

/** Data do filtro em pílula, na altura da busca. */
const classeDaData =
    'h-[43px] rounded-[25px] border border-foreground/80 dark:border-border bg-card px-4 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 [color-scheme:light] dark:[color-scheme:dark]';

export const Email = () => {
    const [emails, setEmails] = useState<EmailMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
    const [falhou, setFalhou] = useState(false);
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
                setAtualizadoEm(new Date());
                setFalhou(false);
            } else {
                setFalhou(true);
                toast.error('Erro ao buscar emails');
            }
        } catch (error) {
            console.error(error);
            setFalhou(true);
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
        <div className="space-y-[25px] pb-12">
            <CabecalhoDaPagina
                rotulo="Comunicação"
                titulo={activeTab === 'inbox' ? 'Caixa de entrada' : 'Enviados'}
                acoes={
                    <>
                        <button type="button" onClick={() => setComposing(true)} className={classeDoBotaoPrincipal}>
                            <PenSquare className="w-5 h-5" aria-hidden="true" />
                            Nova mensagem
                        </button>
                        <BotaoAtualizar
                            aoAtualizar={() => void fetchEmails()}
                            carregando={loading}
                            atualizadoEm={atualizadoEm}
                            falhou={falhou}
                        />
                    </>
                }
            />

            <AbasDaPagina
                rotulo="Pastas do e-mail"
                ativa={activeTab}
                aoMudar={setActiveTab}
                abas={[
                    { id: 'inbox', rotulo: 'Caixa de entrada', icone: <Inbox className="w-5 h-5" aria-hidden="true" /> },
                    { id: 'sent', rotulo: 'E-mails enviados', icone: <Send className="w-5 h-5" aria-hidden="true" /> },
                ]}
            />

            {/* Filtros */}
            <form onSubmit={handleSearch}>
                <BarraDeFiltros>
                    <CampoDeBusca
                        placeholder="Buscar nos emails..."
                        aria-label="Buscar nos emails"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="date"
                            aria-label="De"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className={classeDaData}
                        />
                        <span className="text-muted-foreground text-sm font-medium">até</span>
                        <input
                            type="date"
                            aria-label="Até"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className={classeDaData}
                        />
                        <button type="submit" className={classeDoBotaoContorno}>
                            <Filter className="w-4 h-4" aria-hidden="true" />
                            Filtrar
                        </button>
                    </div>
                </BarraDeFiltros>
            </form>

            {/* Lista e leitura */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[25px] lg:h-[calc(100vh-20rem)] min-h-[800px] lg:min-h-[600px]">
                {/* Lista */}
                <section className={`${classeDoCartao} col-span-1 flex flex-col overflow-hidden`} aria-label="Mensagens">
                    <div className="px-5 py-4 border-b border-border flex items-center gap-2 shrink-0">
                        <h2 className="text-[20px] leading-tight font-semibold text-foreground">Mensagens</h2>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {loading ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center h-full gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary-strong" aria-hidden="true" />
                                <p className="text-sm text-muted-foreground">Carregando e-mails…</p>
                            </div>
                        ) : emails.length === 0 ? (
                            <EstadoVazio icone={<Inbox className="w-10 h-10" />}>Nenhum e-mail recebido.</EstadoVazio>
                        ) : (
                            <ul className="divide-y divide-border">
                                {emails.map((email) => {
                                    const aberto = selectedEmail?.id === email.id;
                                    const naoLido = !email.isRead && activeTab === 'inbox';
                                    return (
                                    <li key={email.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedEmail(email)}
                                            aria-current={aberto ? 'true' : undefined}
                                            className={`w-full text-left px-5 py-4 transition-colors flex flex-col gap-1.5 border-l-[3px] ${
                                                aberto
                                                    ? 'bg-primary-soft border-primary'
                                                    : !email.isRead
                                                        ? 'border-primary hover:bg-muted/60'
                                                        : 'border-transparent hover:bg-muted/60'
                                            }`}
                                        >
                                            <span className="flex justify-between items-start gap-2 w-full">
                                                <span className={`text-sm truncate ${naoLido ? 'font-semibold text-foreground' : 'text-muted-foreground'}`} title={activeTab === 'inbox' ? email.from : email.to}>
                                                    {activeTab === 'inbox' ? email.from : `Para: ${email.to}`}
                                                </span>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                                                    {formatDate(email.date).split(',')[0]}
                                                </span>
                                            </span>
                                            <span className={`text-[15px] truncate w-full font-semibold ${!email.isRead ? 'text-primary-strong' : 'text-foreground'}`} title={email.subject}>
                                                {email.subject}
                                            </span>
                                            <span className="text-xs text-muted-foreground leading-relaxed truncate w-full">
                                                {getCleanPreview(email.text)}
                                            </span>
                                        </button>
                                    </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Paginação */}
                    {totalEmails > 0 && (
                        <div className="flex flex-col gap-3 px-5 py-4 border-t border-border shrink-0">
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <label className="flex items-center gap-2">
                                    <span className="font-medium">Mostrar</span>
                                    <select
                                        value={limit}
                                        onChange={(e) => {
                                            setLimit(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        className="h-9 rounded-[25px] border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </label>
                                <span className="font-semibold text-foreground">Total: {totalEmails}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className={`${classeDoBotaoContorno} px-3`}
                                    aria-label="Página anterior"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className={`${classeDaEtiqueta} bg-primary-soft text-primary-strong`}>
                                    Página {page}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * limit >= totalEmails}
                                    className={`${classeDoBotaoContorno} px-3`}
                                    aria-label="Próxima página"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Leitura */}
                <section className={`${classeDoCartao} col-span-1 lg:col-span-2 flex flex-col overflow-hidden relative`} aria-label="Leitura do e-mail">
                    {selectedEmail ? (
                        <>
                            <div className="p-5 sm:p-6 border-b border-border shrink-0">
                                <h2 className="text-[20px] sm:text-2xl font-semibold text-foreground mb-4 break-words leading-tight">{selectedEmail.subject}</h2>
                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="w-11 h-11 rounded-full bg-primary-soft text-primary-strong shrink-0 flex items-center justify-center" aria-hidden="true">
                                            <User className="w-5 h-5" />
                                        </span>
                                        <div className="min-w-0 flex flex-col justify-center">
                                            <span className="text-xs text-muted-foreground mb-0.5">{activeTab === 'inbox' ? 'De' : 'Para'}</span>
                                            <div className="text-sm font-semibold text-foreground truncate" title={activeTab === 'inbox' ? selectedEmail.from : selectedEmail.to}>{activeTab === 'inbox' ? selectedEmail.from : selectedEmail.to}</div>
                                        </div>
                                    </div>
                                    <span className={`${classeDaEtiqueta} bg-muted text-foreground shrink-0`}>
                                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                                        {formatDate(selectedEmail.date)}
                                    </span>
                                </div>
                            </div>
                            {/* O corpo do e-mail fica em fundo branco, como num cliente de e-mail. */}
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
                        <div className="flex-1 flex items-center justify-center">
                            <EstadoVazio icone={<MailCheck className="w-12 h-12" />} titulo="Tudo pronto!">
                                Selecione uma mensagem na lista lateral para visualizar todo o conteúdo com segurança e rapidez.
                            </EstadoVazio>
                        </div>
                    )}
                </section>
            </div>

            {/* Nova mensagem */}
            {composing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
                    <div role="dialog" aria-modal="true" aria-label={previewMode ? 'Pré-visualização do envio' : 'Nova mensagem'} className="bg-card text-card-foreground rounded-[15px] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                        {/* Cabeçalho */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
                            <h3 className="text-[20px] font-semibold text-foreground flex items-center gap-3">
                                <span className="w-9 h-9 rounded-[5px] bg-primary-soft text-primary-strong inline-flex items-center justify-center" aria-hidden="true">
                                    <Send className="w-4 h-4" />
                                </span>
                                {previewMode ? 'Pré-visualização do envio' : 'Nova mensagem'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    if (previewMode) setPreviewMode(false);
                                    else setComposing(false);
                                }}
                                className="w-9 h-9 rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                aria-label={previewMode ? 'Voltar para a edição' : 'Fechar'}
                            >
                                {previewMode ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Formulário / prévia */}
                        {!previewMode ? (
                            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex-1 flex flex-col overflow-y-auto">
                                <div className="px-6 py-4 border-b border-border flex flex-col gap-4">
                                    {/* Modo de envio */}
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span className="text-sm font-medium text-muted-foreground w-20">Modo</span>
                                        <div className="flex gap-1 bg-muted/60 p-1 rounded-[25px]" role="group" aria-label="Modo de envio">
                                            {([
                                                ['individual', 'Individual'],
                                                ['group', 'Grupo'],
                                                ['all', 'Em massa'],
                                            ] as const).map(([modo, rotulo]) => (
                                                <button
                                                    key={modo}
                                                    type="button"
                                                    onClick={() => setSendMode(modo)}
                                                    aria-pressed={sendMode === modo}
                                                    className={`h-9 px-4 rounded-[25px] text-sm font-semibold transition ${sendMode === modo ? 'bg-primary text-primary-foreground shadow-pilula' : 'text-foreground hover:bg-card'}`}
                                                >
                                                    {rotulo}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Destinatários */}
                                    <div className="flex flex-wrap items-start gap-4">
                                        <span className="text-sm font-medium text-muted-foreground w-20 shrink-0 pt-2.5">Para</span>

                                        {sendMode === 'individual' && (
                                            <input
                                                type="text"
                                                value={to}
                                                onChange={(e) => setTo(e.target.value)}
                                                placeholder="E-mail ou nome (busca simples)..."
                                                aria-label="Para"
                                                className={`flex-1 min-w-[200px] ${classeDoCampoDoEmail}`}
                                            />
                                        )}

                                        {sendMode === 'group' && (
                                            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
                                                <select
                                                    aria-label="Adicionar destinatário"
                                                    onChange={(e) => {
                                                        const user = allUsers.find(u => u.id === parseInt(e.target.value));
                                                        if (user && !selectedUsers.find(u => u.id === user.id)) {
                                                            setSelectedUsers([...selectedUsers, user]);
                                                        }
                                                        e.target.value = "";
                                                    }}
                                                    className={`w-full ${classeDoCampoDoEmail}`}
                                                >
                                                    <option value="">Selecione usuários para adicionar...</option>
                                                    {allUsers.map(u => (
                                                        <option key={u.id} value={u.id}>{u.name || 'Sem nome'} ({u.email})</option>
                                                    ))}
                                                </select>
                                                {selectedUsers.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {selectedUsers.map(user => (
                                                            <span key={user.id} className={`${classeDaEtiqueta} bg-primary-soft text-primary-strong pr-1.5`}>
                                                                {user.name || user.email}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))}
                                                                    className="w-5 h-5 rounded-full inline-flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
                                                                    aria-label={`Tirar ${user.name || user.email}`}
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {sendMode === 'all' && (
                                            <div className="flex-1 flex flex-wrap gap-3 items-center">
                                                <span className="text-sm text-foreground">Todos os usuários cadastrados. Filtrar plataforma:</span>
                                                <select
                                                    value={targetPlatform}
                                                    onChange={(e) => setTargetPlatform(e.target.value as any)}
                                                    aria-label="Plataforma"
                                                    className={`${classeDoCampoDoEmail} font-medium`}
                                                >
                                                    <option value="all">Ambas (Web e App)</option>
                                                    <option value="web">Apenas Web</option>
                                                    <option value="mobile">Apenas App</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4">
                                        <label htmlFor="email-assunto" className="text-sm font-medium text-muted-foreground w-20 shrink-0">Assunto</label>
                                        <input
                                            id="email-assunto"
                                            type="text"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="Qual o tema da sua mensagem?"
                                            className={`flex-1 min-w-[200px] ${classeDoCampoDoEmail} font-medium`}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col px-6 py-4">
                                    <div className="flex flex-wrap justify-between items-end gap-2 mb-2">
                                        <span className="text-sm font-medium text-foreground">Mensagem</span>
                                        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-[5px] font-mono">Variáveis: {`{nome_do_usuario}`}, {`{email}`}</span>
                                    </div>
                                    {/* O editor fica branco: é como o e-mail chega ao destinatário. */}
                                    <div className="flex-1 border border-border rounded-[10px] overflow-hidden bg-white text-zinc-800 flex flex-col min-h-[250px]">
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

                                {/* Anexos */}
                                <div className="px-6 pb-4 shrink-0">
                                    {attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                                            {attachments.map((file, idx) => (
                                                <span key={idx} className={`${classeDaEtiqueta} bg-muted text-foreground pr-1.5`}>
                                                    <Paperclip className="w-3.5 h-3.5 text-primary-strong" aria-hidden="true" />
                                                    <span className="truncate max-w-[150px]">{file.name}</span>
                                                    <span className="text-[11px] text-muted-foreground font-mono">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                                        className="w-5 h-5 rounded-full inline-flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                        aria-label={`Tirar o anexo ${file.name}`}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Rodapé */}
                                <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 border-t border-border shrink-0">
                                    <label className={`${classeDoBotaoContorno} cursor-pointer focus-within:ring-2 focus-within:ring-primary/40`}>
                                        <Paperclip className="w-4 h-4" aria-hidden="true" />
                                        Anexar
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

                                    <button type="submit" className={classeDoBotaoPrincipal}>
                                        Revisar e enviar
                                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                </div>
                            </form>
                        ) : (
                            // Prévia
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-6 py-5 border-b border-border bg-muted/40 flex flex-col gap-2 shrink-0">
                                    <div className="flex flex-wrap justify-between items-center gap-2">
                                        <h4 className="text-base font-semibold text-foreground">Confirmar detalhes</h4>
                                        <span className={`${classeDaEtiqueta} bg-tom-azul text-tom-azul-icone`}>
                                            {sendMode === 'all' ? `Em massa (${targetPlatform})` : sendMode === 'group' ? `Grupo (${selectedUsers.length})` : 'Individual'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        As variáveis serão substituídas pelos dados de cada usuário. Abaixo, um exemplo de como a mensagem aparecerá para o destinatário:
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="border border-border rounded-[15px] overflow-hidden bg-white p-8">
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
                                <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 border-t border-border shrink-0">
                                    <button type="button" onClick={() => setPreviewMode(false)} className={classeDoBotaoContorno}>
                                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSend()}
                                        disabled={sending}
                                        className={classeDoBotaoPrincipal}
                                    >
                                        {sending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                                Enviando…
                                            </>
                                        ) : (
                                            <>
                                                Confirmar envio
                                                <Send className="w-4 h-4" aria-hidden="true" />
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
