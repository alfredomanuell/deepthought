import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '../../../api/socket'
import {
  fetchChatRooms,
  fetchChatMessages,
  openDm,
  type ChatMessage,
  type ChatRoomSummary,
} from '../../../api/chat'
import { fetchPublicProfile, type PublicProfile } from '../../../api/users'

interface Props {
  currentUserId: string | null
  pendingDmUserId: string | null
  onDmConsumed: () => void
}

type Tab = 'global' | 'dms'

const TYPING_TIMEOUT_MS = 2500
const TYPING_EMIT_INTERVAL_MS = 1500

export default function ChatPanel({ currentUserId, pendingDmUserId, onDmConsumed }: Props) {
  const [tab, setTab] = useState<Tab>('global')
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([])
  const [activeRoom, setActiveRoom] = useState<ChatRoomSummary | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [someoneTyping, setSomeoneTyping] = useState(false)
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null)
  const [profile, setProfile] = useState<PublicProfile | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  /** Refs espelham estado usado dentro de handlers de socket (evita closures velhas). */
  const activeRoomRef = useRef<ChatRoomSummary | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingEmit = useRef(0)

  activeRoomRef.current = activeRoom

  const openRoom = useCallback((room: ChatRoomSummary) => {
    const socket = getSocket()
    const previous = activeRoomRef.current
    if (previous && previous.id !== room.id) {
      socket?.emit('chat:leave', { roomId: previous.id })
    }

    setActiveRoom(room)
    setMessages([])
    setNextBefore(null)
    setSomeoneTyping(false)
    setOtherLastReadAt(room.otherLastReadAt)

    socket?.emit('chat:join', { roomId: room.id })
    fetchChatMessages(room.id)
      .then((page) => {
        setMessages(page.data)
        setNextBefore(page.nextBefore)
        socket?.emit('chat:read', { roomId: room.id })
        setRooms((prev) =>
          prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)),
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchChatRooms()
      .then((list) => {
        setRooms(list)
        const global = list.find((r) => r.type === 'GLOBAL')
        if (global) openRoom(global)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => {
      const room = activeRoomRef.current
      if (room) getSocket()?.emit('chat:leave', { roomId: room.id })
    }
  }, [openRoom])

  useEffect(() => {
    if (!pendingDmUserId) return
    openDm(pendingDmUserId)
      .then((room) => {
        setTab('dms')
        setRooms((prev) =>
          prev.some((r) => r.id === room.id)
            ? prev
            : [...prev, { ...room, unreadCount: 0 }],
        )
        openRoom(room)
      })
      .catch(() => {})
      .finally(onDmConsumed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDmUserId])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onMessage = (msg: ChatMessage) => {
      const active = activeRoomRef.current
      if (active && msg.chatRoomId === active.id) {
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
        )
        if (msg.senderId !== currentUserId) {
          socket.emit('chat:read', { roomId: msg.chatRoomId })
        }
        setSomeoneTyping(false)
      }

      setRooms((prev) =>
        prev.map((r) => {
          if (r.id !== msg.chatRoomId) return r
          const isActive = activeRoomRef.current?.id === r.id
          const unread =
            isActive || msg.senderId === currentUserId
              ? (r.unreadCount ?? 0)
              : (r.unreadCount ?? 0) + 1
          return { ...r, lastMessage: msg, unreadCount: unread }
        }),
      )
    }

    const onTyping = ({ roomId, userId }: { roomId: string; userId: string }) => {
      const active = activeRoomRef.current
      if (!active || roomId !== active.id || userId === currentUserId) return
      setSomeoneTyping(true)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(
        () => setSomeoneTyping(false),
        TYPING_TIMEOUT_MS,
      )
    }

    const onRead = ({
      roomId,
      userId,
      lastReadAt,
    }: {
      roomId: string
      userId: string
      lastReadAt: string
    }) => {
      const active = activeRoomRef.current
      if (!active || roomId !== active.id || userId === currentUserId) return
      setOtherLastReadAt(lastReadAt)
    }

    socket.on('chat:message', onMessage)
    socket.on('chat:typing', onTyping)
    socket.on('chat:read', onRead)
    return () => {
      socket.off('chat:message', onMessage)
      socket.off('chat:typing', onTyping)
      socket.off('chat:read', onRead)
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [currentUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function send() {
    const text = input.trim()
    const room = activeRoomRef.current
    if (!text || !room) return
    getSocket()?.emit('chat:send', { roomId: room.id, content: text })
    setInput('')
  }

  function onInputChange(value: string) {
    setInput(value)
    const room = activeRoomRef.current
    const now = Date.now()
    if (room && now - lastTypingEmit.current > TYPING_EMIT_INTERVAL_MS) {
      lastTypingEmit.current = now
      getSocket()?.emit('chat:typing', { roomId: room.id })
    }
  }

  function loadOlder() {
    const room = activeRoomRef.current
    if (!room || !nextBefore) return
    fetchChatMessages(room.id, nextBefore)
      .then((page) => {
        setMessages((prev) => [...page.data, ...prev])
        setNextBefore(page.nextBefore)
      })
      .catch(() => {})
  }

  function showProfile(userId: string) {
    if (userId === currentUserId) return
    setProfile({ id: userId, login: '...', displayName: '', avatar: null })
    fetchPublicProfile(userId)
      .then(setProfile)
      .catch(() => setProfile(null))
  }

  async function messageUser(userId: string) {
    try {
      const room = await openDm(userId)
      setProfile(null)
      setTab('dms')
      setRooms((prev) =>
        prev.some((r) => r.id === room.id) ? prev : [...prev, { ...room, unreadCount: 0 }],
      )
      openRoom(room)
    } catch {}
  }

  function selectTab(next: Tab) {
    setTab(next)
    if (next === 'global') {
      const global = rooms.find((r) => r.type === 'GLOBAL')
      if (global && activeRoomRef.current?.id !== global.id) openRoom(global)
    } else {
      // Na lista de DMs nenhuma conversa fica aberta até ser escolhida
      const room = activeRoomRef.current
      if (room) getSocket()?.emit('chat:leave', { roomId: room.id })
      setActiveRoom(null)
      setMessages([])
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const dmRooms = rooms.filter((r) => r.type === 'PRIVATE')
  const showConversation = activeRoom !== null && (tab === 'global' || activeRoom.type === 'PRIVATE')

  return (
    <div className="flex flex-col h-full relative">
      {/* Tabs Global / DMs */}
      <div className="flex border-b-4 border-black shrink-0">
        {(['global', 'dms'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            className={`flex-1 px-3 py-2 font-pressStart text-[10px] ${
              tab === t ? 'bg-black/40 text-contrast' : 'text-white/50'
            }`}
          >
            {t === 'global' ? 'Global' : `DMs${dmRooms.some((r) => (r.unreadCount ?? 0) > 0) ? ' •' : ''}`}
          </button>
        ))}
      </div>

      {/* Cabeçalho da DM aberta */}
      {tab === 'dms' && activeRoom?.otherUser && (
        <div className="flex items-center gap-2 px-3 py-2 border-b-4 border-black shrink-0">
          <button
            onClick={() => selectTab('dms')}
            className="font-pressStart text-[10px] text-white/60 hover:text-white"
          >
            ←
          </button>
          <button
            onClick={() => showProfile(activeRoom.otherUser!.id)}
            className="font-pressStart text-[10px] text-contrast hover:text-secundary"
          >
            {activeRoom.otherUser.displayName}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
        </div>
      )}

      {/* Lista de DMs */}
      {!loading && tab === 'dms' && !activeRoom && (
        <div className="flex-1 overflow-y-auto">
          {dmRooms.length === 0 && (
            <div className="flex items-center justify-center py-8 px-4">
              <p className="font-pressStart text-[10px] text-white/40 text-center leading-relaxed">
                No conversations yet. Click a name in Global chat to start one.
              </p>
            </div>
          )}
          {dmRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => openRoom(room)}
              className="w-full text-left px-3 py-2.5 border-b-2 border-black/40 flex items-center gap-2"
            >
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="font-pressStart text-[10px] text-white truncate">
                  {room.otherUser?.displayName ?? 'Unknown'}
                </span>
                {room.lastMessage && (
                  <span className="font-pressStart text-[8px] text-white/40 truncate">
                    {room.lastMessage.content}
                  </span>
                )}
              </div>
              {(room.unreadCount ?? 0) > 0 && (
                <span className="min-w-4 h-4 px-0.5 bg-red-500 text-white font-pressStart text-[8px] flex items-center justify-center border border-black shrink-0">
                  {room.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Conversa (global ou DM aberta) */}
      {!loading && showConversation && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
            {nextBefore && (
              <button
                onClick={loadOlder}
                className="font-pressStart text-[9px] text-secundary self-center py-1"
              >
                Load older messages
              </button>
            )}
            {messages.map((msg) => {
              const own = msg.senderId === currentUserId
              const read =
                own &&
                activeRoom?.type === 'PRIVATE' &&
                otherLastReadAt !== null &&
                new Date(msg.createdAt) <= new Date(otherLastReadAt)
              return (
                <div key={msg.id} className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <button
                      onClick={() => showProfile(msg.senderId)}
                      className={`font-pressStart text-[10px] ${
                        own ? 'text-contrast' : 'text-white hover:text-secundary'
                      }`}
                    >
                      {own ? 'you' : msg.sender.login}
                    </button>
                    <span className="font-pressStart text-[8px] text-white/40">
                      {formatTime(msg.createdAt)}
                    </span>
                    {own && activeRoom?.type === 'PRIVATE' && (
                      <span
                        className={`font-pressStart text-[8px] ${read ? 'text-secundary' : 'text-white/30'}`}
                        title={read ? 'Read' : 'Sent'}
                      >
                        {read ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                  <p className="font-pressStart text-[10px] text-white/80 leading-relaxed break-words">
                    {msg.content}
                  </p>
                </div>
              )
            })}
            {someoneTyping && (
              <p className="font-pressStart text-[9px] text-white/40 italic">
                typing...
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-2 border-t-4 border-black shrink-0 flex gap-2">
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Type a message..."
              maxLength={1000}
              className="flex-1 px-2 py-1.5 bg-black/40 text-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black placeholder:text-white/30"
            />
            <button
              onClick={send}
              className="px-3 py-1.5 bg-contrast text-black font-pressStart text-[10px] border-b-2 border-r-2 border-l border-t border-black"
            >
              →
            </button>
          </div>
        </>
      )}

      {/* Popover de perfil (clicar num nome) */}
      {profile && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full bg-neutral_contrast border-b-4 border-r-4 border-l-2 border-t-2 border-black p-4 flex flex-col items-center gap-2">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.login}
                className="w-12 h-12 border-2 border-black object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-black/40 border-2 border-black flex items-center justify-center">
                <span className="font-pressStart text-contrast text-sm">
                  {(profile.displayName || profile.login).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <p className="font-pressStart text-[10px] text-white">{profile.displayName}</p>
            <p className="font-pressStart text-[9px] text-white/50">@{profile.login}</p>
            {!profile.limited && profile.level !== undefined && (
              <p className="font-pressStart text-[9px] text-white/60">
                {profile.campus ?? '—'} · Lvl {profile.level.toFixed(2)}
              </p>
            )}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => messageUser(profile.id)}
                className="px-3 py-1.5 bg-contrast text-black font-pressStart text-[9px] border-b-2 border-r-2 border-l border-t border-black"
              >
                Message
              </button>
              <button
                onClick={() => setProfile(null)}
                className="px-3 py-1.5 bg-black text-white font-pressStart text-[9px] border-b-2 border-r-2 border-l border-t border-neutral_contrast"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
