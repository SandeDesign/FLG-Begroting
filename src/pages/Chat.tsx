import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Building2,
  User,
  Handshake,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import {
  ChatMessage,
  ChatSummary,
  ChatRole,
  ensureChat,
  subscribeChatsForUser,
  subscribeMessages,
  sendMessage,
  markChatRead,
  buildChatId,
  deleteChat,
} from '../services/chatService';
import { getUserSettings } from '../services/firebase';
import Card from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Company } from '../types';

interface ContactCandidate {
  uid: string;
  email: string;
  displayName?: string;
}

// Entry in de chat-sidebar: één bedrijf × één tegenpartij.
interface ChatEntry {
  chatId: string;
  companyId: string;
  companyName: string;
  companyLogoUrl?: string;
  adminUid: string;
  boekhouderUid: string;
  otherPartyLabel: string;      // boekhouder-email voor admin-kant, admin-email voor boekhouder-kant
  otherPartyUid: string;
  otherPartyEmail: string;
  adminEmailForEnsure: string;
  boekhouderEmailForEnsure: string;
  unread: number;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastSenderName?: string;
  hasMessages: boolean;
}

const formatTime = (d?: Date) => {
  if (!d) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });
};

const Chat: React.FC = () => {
  const { user, userRole, adminUserId } = useAuth();
  const { assignedAdmins, companies } = useApp();
  usePageTitle('Berichten');

  const [searchParams, setSearchParams] = useSearchParams();
  const role: ChatRole = userRole === 'boekhouder' ? 'boekhouder' : 'admin';

  // Admin + co-admin delen chat-threads; queries gebeuren onder de primary
  // admin-UID (= adminUserId). Voor boekhouders is dat hun eigen UID.
  const adminSideUid = adminUserId || user?.uid || null;

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [boekhouderContacts, setBoekhouderContacts] = useState<ContactCandidate[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── 1) Subscribe op alle chats van deze gebruiker ──────────────────────
  useEffect(() => {
    if (!user) return;
    const subjectUid = role === 'boekhouder' ? user.uid : adminSideUid;
    if (!subjectUid) return;
    setLoadingChats(true);
    const unsub = subscribeChatsForUser(
      subjectUid,
      role,
      (list) => {
        setChats(list);
        setLoadingChats(false);
      },
      (err) => {
        setError(err.message);
        setLoadingChats(false);
      }
    );
    return () => unsub();
  }, [user, role, adminSideUid]);

  // ─── 2) Laad boekhouder-contacts (alleen nodig voor admin-kant) ─────────
  // Admin kant: lookup boekhouder-UIDs obv boekhouderEmails uit PRIMARY
  // admin's settings (zodat co-admins dezelfde lijst krijgen).
  useEffect(() => {
    if (!user) return;
    if (role !== 'admin') {
      setBoekhouderContacts([]);
      return;
    }
    if (!adminSideUid) return;
    setLoadingContacts(true);
    const load = async () => {
      try {
        const mySettings = await getUserSettings(adminSideUid);
        const emails: string[] = mySettings?.boekhouderEmails || [];
        if (emails.length === 0) {
          setBoekhouderContacts([]);
          return;
        }
        const { collection: col, getDocs: gd, query: q, where: w } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const candidates: ContactCandidate[] = [];
        await Promise.all(
          emails.map(async (email) => {
            try {
              const snap = await gd(q(col(db, 'userSettings'), w('email', '==', email)));
              snap.forEach((d) => {
                const data = d.data() as any;
                if (data.userId) {
                  candidates.push({
                    uid: data.userId,
                    email,
                    displayName: data.displayName,
                  });
                }
              });
            } catch (err) {
              console.warn('[Chat] lookup boekhouder email failed:', email, err);
            }
          })
        );
        setBoekhouderContacts(candidates);
      } finally {
        setLoadingContacts(false);
      }
    };
    load();
  }, [user, role, adminSideUid]);

  // ─── 3) URL-driven active chat (deep link via ?chat=...) ────────────────
  useEffect(() => {
    const fromUrl = searchParams.get('chat');
    if (fromUrl && fromUrl !== activeChatId) {
      setActiveChatId(fromUrl);
    }
  }, [searchParams, activeChatId]);

  // ─── 4) Subscribe op messages van de actieve chat ───────────────────────
  useEffect(() => {
    if (!activeChatId || !user) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    const unsub = subscribeMessages(
      activeChatId,
      (list) => {
        setMessages(list);
        setLoadingMessages(false);
        markChatRead(activeChatId, role).catch(() => undefined);
      },
      (err) => {
        setError(err.message);
        setLoadingMessages(false);
      }
    );
    return () => unsub();
  }, [activeChatId, user, role]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // ─── 5) Bouw chat-entries (1 per bedrijf × tegenpartij) ─────────────────
  const chatEntries: ChatEntry[] = useMemo(() => {
    if (!user) return [];

    // Index bestaande summaries op chatId zodat we per (company, boekhouder)
    // de real-time data kunnen mappen.
    const summaryById = new Map<string, ChatSummary>();
    chats.forEach((c) => summaryById.set(c.id, c));

    const entries: ChatEntry[] = [];

    if (role === 'admin') {
      // Voor elke boekhouder × elk bedrijf (van de primary admin) een entry.
      // companies bevat alleen eigen bedrijven (AppContext); userId = primary admin.
      const myCompanies = companies.filter((c) => c.userId === adminSideUid);
      myCompanies.forEach((company) => {
        boekhouderContacts.forEach((bh) => {
          const chatId = buildChatId(company.id, bh.uid);
          const summary = summaryById.get(chatId);
          entries.push({
            chatId,
            companyId: company.id,
            companyName: company.name,
            companyLogoUrl: company.logoUrl,
            adminUid: adminSideUid || user.uid,
            boekhouderUid: bh.uid,
            otherPartyLabel: bh.displayName || bh.email,
            otherPartyUid: bh.uid,
            otherPartyEmail: bh.email,
            adminEmailForEnsure: user.email || '',
            boekhouderEmailForEnsure: bh.email,
            unread: summary?.adminUnread || 0,
            lastMessage: summary?.lastMessage,
            lastMessageAt: summary?.lastMessageAt,
            lastSenderName: summary?.lastSenderName,
            hasMessages: !!(summary && summary.lastMessage),
          });
        });
      });
    } else {
      // Boekhouder: voor elk bedrijf dat de boekhouder beheert (companies
      // context bevat alle bedrijven van alle assigned admins). 1 entry per
      // bedrijf, tegenpartij = admin van dat bedrijf.
      companies.forEach((company: Company) => {
        const chatId = buildChatId(company.id, user.uid);
        const summary = summaryById.get(chatId);
        const adminInfo = assignedAdmins.find((a) => a.userId === company.userId);
        entries.push({
          chatId,
          companyId: company.id,
          companyName: company.name,
          companyLogoUrl: company.logoUrl,
          adminUid: company.userId,
          boekhouderUid: user.uid,
          otherPartyLabel: adminInfo?.displayName || adminInfo?.email || `Admin ${company.userId.substring(0, 6)}`,
          otherPartyUid: company.userId,
          otherPartyEmail: adminInfo?.email || '',
          adminEmailForEnsure: adminInfo?.email || '',
          boekhouderEmailForEnsure: user.email || '',
          unread: summary?.boekhouderUnread || 0,
          lastMessage: summary?.lastMessage,
          lastMessageAt: summary?.lastMessageAt,
          lastSenderName: summary?.lastSenderName,
          hasMessages: !!(summary && summary.lastMessage),
        });
      });
    }

    // Toon bestaande chats die (om welke reden dan ook) niet in de
    // berekende lijst zitten (bv. bedrijf inmiddels verwijderd of chat
    // vanuit het oude data-model zonder companyId) zodat geschiedenis
    // niet verdwijnt.
    const shortId = (s: string | undefined | null): string => (s ? s.substring(0, 6) : '??????');
    chats.forEach((summary) => {
      if (entries.some((e) => e.chatId === summary.id)) return;
      // Oude chats zonder companyId (uit vorige data-model) kunnen we niet
      // correct scopen; toon ze wél zodat geschiedenis zichtbaar blijft,
      // maar met generieke label.
      const companyId = summary.companyId || '';
      const companyName =
        summary.companyName ||
        (companyId ? `Bedrijf ${shortId(companyId)}` : 'Oud gesprek');
      const adminUid = summary.adminUid || '';
      const boekhouderUid = summary.boekhouderUid || '';
      entries.push({
        chatId: summary.id,
        companyId,
        companyName,
        adminUid,
        boekhouderUid,
        otherPartyLabel:
          role === 'admin'
            ? summary.boekhouderEmail || `Boekhouder ${shortId(boekhouderUid)}`
            : summary.adminEmail || `Admin ${shortId(adminUid)}`,
        otherPartyUid: role === 'admin' ? boekhouderUid : adminUid,
        otherPartyEmail:
          role === 'admin' ? summary.boekhouderEmail || '' : summary.adminEmail || '',
        adminEmailForEnsure: summary.adminEmail || '',
        boekhouderEmailForEnsure: summary.boekhouderEmail || '',
        unread: role === 'admin' ? summary.adminUnread : summary.boekhouderUnread,
        lastMessage: summary.lastMessage,
        lastMessageAt: summary.lastMessageAt,
        lastSenderName: summary.lastSenderName,
        hasMessages: !!summary.lastMessage,
      });
    });

    // Sorteer: unread / recente activiteit eerst, daarna alfabetisch bedrijf.
    entries.sort((a, b) => {
      if (a.unread !== b.unread) return b.unread - a.unread;
      const at = a.lastMessageAt?.getTime() || 0;
      const bt = b.lastMessageAt?.getTime() || 0;
      if (at !== bt) return bt - at;
      return a.companyName.localeCompare(b.companyName);
    });

    return entries;
  }, [chats, companies, boekhouderContacts, assignedAdmins, role, user, adminSideUid]);

  const activeEntry = useMemo(
    () => chatEntries.find((e) => e.chatId === activeChatId),
    [chatEntries, activeChatId]
  );

  // Groepeer per tegenpartij — admin: per boekhouder; boekhouder: per admin
  const groupedEntries = useMemo(() => {
    const groups = new Map<string, { label: string; entries: ChatEntry[] }>();
    chatEntries.forEach((e) => {
      const key = e.otherPartyUid;
      const existing = groups.get(key) || { label: e.otherPartyLabel, entries: [] };
      existing.entries.push(e);
      groups.set(key, existing);
    });
    return Array.from(groups.values());
  }, [chatEntries]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const openEntry = async (entry: ChatEntry) => {
    if (!user) return;
    const id = await ensureChat({
      companyId: entry.companyId,
      companyName: entry.companyName,
      adminUid: entry.adminUid,
      boekhouderUid: entry.boekhouderUid,
      adminEmail: entry.adminEmailForEnsure,
      boekhouderEmail: entry.boekhouderEmailForEnsure,
    });
    setActiveChatId(id);
    const next = new URLSearchParams(searchParams);
    next.set('chat', id);
    setSearchParams(next, { replace: true });
  };

  const handleSend = async () => {
    if (!user || !activeChatId || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(activeChatId, {
        senderId: user.uid,
        senderRole: role,
        senderName: user.email || 'Onbekend',
        text: draft.trim(),
      });
      setDraft('');
    } catch (err) {
      console.error('[Chat] send failed:', err);
      setError('Versturen mislukt');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm('Dit gesprek definitief verwijderen? Alle berichten gaan verloren.')) return;
    try {
      await deleteChat(chatId);
      if (activeChatId === chatId) {
        setActiveChatId(null);
        const next = new URLSearchParams(searchParams);
        next.delete('chat');
        setSearchParams(next, { replace: true });
      }
    } catch (err) {
      console.error('[Chat] delete failed:', err);
      setError('Verwijderen mislukt');
    }
  };

  if (!user) return null;

  const emptyReason =
    role === 'admin'
      ? boekhouderContacts.length === 0
        ? 'Nog geen boekhouders gekoppeld. Voeg er een toe via Instellingen → Boekhouders.'
        : companies.filter((c) => c.userId === adminSideUid).length === 0
          ? 'Nog geen bedrijven aangemaakt. Voeg een bedrijf toe om chat-threads te starten.'
          : null
      : companies.length === 0
        ? 'Nog geen administraties toegewezen. Vraag een admin om jouw e-mail toe te voegen bij Instellingen → Boekhouders.'
        : null;

  if (loadingChats && chatEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (emptyReason) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Geen chats beschikbaar"
        description={emptyReason}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary-600" />
          Berichten
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">
          Real-time chat per bedrijf tussen admin-team en boekhouder
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Sidebar */}
        <Card className={`${activeChatId ? 'hidden lg:block' : ''} overflow-hidden`}>
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {role === 'admin' ? 'Boekhouders & bedrijven' : 'Administraties & bedrijven'}
            </h2>
            {loadingContacts && (
              <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">Laden…</p>
            )}
          </div>
          <div className="overflow-y-auto h-[calc(100%-50px)]">
            {groupedEntries.map((group) => (
              <div key={group.label} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
                  {role === 'admin' ? (
                    <User className="h-3.5 w-3.5 text-gray-500 dark:text-gray-300" />
                  ) : (
                    <Handshake className="h-3.5 w-3.5 text-gray-500 dark:text-gray-300" />
                  )}
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300 truncate">
                    {group.label}
                  </p>
                </div>
                {group.entries.map((e) => {
                  // Oude chats (uit vorig data-model) hebben geen companyId
                  // en/of zijn niet te openen — toon altijd een delete-knop
                  // voor dat geval. Voor normale entries alleen als er iets
                  // bestaat (hasMessages).
                  const isLegacy = !e.companyId;
                  const canDelete = isLegacy || e.hasMessages;
                  return (
                  <div
                    key={e.chatId}
                    className={`w-full flex items-start transition-colors group ${
                      activeChatId === e.chatId
                        ? 'bg-primary-50 dark:bg-primary-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <button
                      onClick={() => openEntry(e)}
                      className="flex-1 min-w-0 p-3 flex items-start gap-3 text-left"
                    >
                      {e.companyLogoUrl ? (
                        <img
                          src={e.companyLogoUrl}
                          alt={e.companyName}
                          className="h-9 w-9 rounded-lg object-contain bg-white border border-gray-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {e.companyName}
                          </p>
                          {e.lastMessageAt && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-300 flex-shrink-0">
                              {formatTime(e.lastMessageAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-300 truncate mt-0.5">
                          {e.hasMessages
                            ? `${e.lastSenderName ? e.lastSenderName + ': ' : ''}${e.lastMessage}`
                            : 'Nog geen berichten'}
                        </p>
                      </div>
                      {e.unread > 0 && (
                        <span className="bg-primary-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                          {e.unread}
                        </span>
                      )}
                    </button>
                    {canDelete && (
                      <button
                        onClick={(ev) => { ev.stopPropagation(); handleDeleteChat(e.chatId); }}
                        className={`p-2 mr-1 mt-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-opacity ${
                          isLegacy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                        }`}
                        title="Gesprek verwijderen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>

        {/* Conversation pane */}
        <Card className={`${!activeChatId ? 'hidden lg:flex' : 'flex'} flex-col overflow-hidden`}>
          {!activeChatId || !activeEntry ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500 dark:text-gray-300">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecteer een bedrijf om te chatten</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveChatId(null);
                    const next = new URLSearchParams(searchParams);
                    next.delete('chat');
                    setSearchParams(next, { replace: true });
                  }}
                  className="lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </button>
                {activeEntry.companyLogoUrl ? (
                  <img
                    src={activeEntry.companyLogoUrl}
                    alt={activeEntry.companyName}
                    className="h-9 w-9 rounded-lg object-contain bg-white border border-gray-200 flex-shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {activeEntry.companyName}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-300 truncate">
                    {role === 'admin' ? 'Boekhouder:' : 'Admin:'} {activeEntry.otherPartyLabel}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteChat(activeEntry.chatId)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                  title="Gesprek verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50 dark:bg-gray-900/20">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <LoadingSpinner />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 dark:text-gray-300 py-8">
                    Stuur het eerste bericht om dit gesprek te starten.
                  </p>
                ) : (
                  messages.map((m, idx) => {
                    const isMine = m.senderId === user.uid;
                    // Toon senderName boven het bericht wanneer het NIET van mij is
                    // en (a) van de admin-kant is (meerdere co-admins mogelijk)
                    // of (b) de vorige afzender iemand anders was.
                    const prev = idx > 0 ? messages[idx - 1] : null;
                    const showSender =
                      !isMine &&
                      (!prev || prev.senderId !== m.senderId);
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        {showSender && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-300 mb-0.5 px-1">
                            {m.senderName}
                          </span>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            isMine
                              ? 'bg-primary-600 text-white rounded-br-sm'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isMine ? 'text-white/70' : 'text-gray-500 dark:text-gray-300'
                            }`}
                          >
                            {formatTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Schrijf een bericht…"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:border-primary-500"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-medium"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Verstuur</span>
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Chat;
