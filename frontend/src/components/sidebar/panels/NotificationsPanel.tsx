import { useEffect, useState } from 'react'
import { getSocket } from '../../../api/socket'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
  type NotificationType,
} from '../../../api/notifications'

const TYPE_ICONS: Record<NotificationType, string> = {
  FRIEND_REQUEST: '👥',
  FRIEND_ACCEPTED: '🤝',
  HELP_REQUEST: '🆘',
  PROJECT_UPDATE: '📌',
  ACHIEVEMENT_UNLOCKED: '🏆',
  NEW_MESSAGE: '✉️',
  SYSTEM: 'ℹ️',
}

interface Props {
  /** Mantém o badge do sino sincronizado com o estado do painel. */
  onUnreadChange: (count: number | ((prev: number) => number)) => void
}

export default function NotificationsPanel({ onUnreadChange }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
      .then((page) => {
        setNotifications(page.data)
        // Fonte de verdade do servidor corrige qualquer contagem local
        onUnreadChange(page.meta.unreadCount)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Com o painel aberto, novas notificações aparecem no topo em tempo real
    const socket = getSocket()
    const onNew = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev])
    }
    socket?.on('notification:new', onNew)
    return () => {
      socket?.off('notification:new', onNew)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleClick(notification: Notification) {
    if (notification.isRead) return
    try {
      await markNotificationRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      )
      onUnreadChange((prev) => Math.max(0, prev - 1))
    } catch {}
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      onUnreadChange(0)
    } catch {}
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short',
    })
  }

  const hasUnread = notifications.some((n) => !n.isRead)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b-4 border-black shrink-0 flex items-center justify-between">
        <span className="font-pressStart text-xs text-contrast">Notifications</span>
        {hasUnread && (
          <button
            onClick={handleMarkAll}
            className="font-pressStart text-[9px] text-secundary border border-secundary px-2 py-0.5"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex items-center justify-center py-8 px-4">
            <p className="font-pressStart text-[10px] text-white/40 text-center leading-relaxed">
              No notifications yet.
            </p>
          </div>
        )}

        {!loading && notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => handleClick(n)}
            className={`w-full text-left px-4 py-3 border-b-2 border-black/40 flex gap-2 ${
              n.isRead ? 'opacity-50' : 'bg-contrast/5'
            }`}
          >
            <span className="text-sm shrink-0">{TYPE_ICONS[n.type] ?? 'ℹ️'}</span>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="font-pressStart text-[10px] text-white leading-relaxed">
                {n.title}
              </p>
              {n.message && (
                <p className="font-pressStart text-[9px] text-white/60 leading-relaxed">
                  {n.message}
                </p>
              )}
              <p className="font-pressStart text-[8px] text-white/30">
                {formatDate(n.createdAt)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
