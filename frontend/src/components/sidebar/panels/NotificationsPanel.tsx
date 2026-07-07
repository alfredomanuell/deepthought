import { useEffect, useState } from 'react'
import { getSocket } from '../../../api/socket'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
  type NotificationType,
} from '../../../api/notifications'
import {
  acceptFriendRequest,
  removeFriendship,
} from '../../../api/friendships'

const TYPE_ICONS: Record<NotificationType, string> = {
  FRIEND_REQUEST: '👥',
  FRIEND_ACCEPTED: '🤝',
  HELP_REQUEST: '🆘',
  PROJECT_UPDATE: '📌',
  ACHIEVEMENT_UNLOCKED: '🏆',
  NEW_MESSAGE: '✉️',
  PROJECT_INVITE: '📨',
  SYSTEM: 'ℹ️',
}

interface Props {
  onUnreadChange: (count: number | ((prev: number) => number)) => void
}

export default function NotificationsPanel({ onUnreadChange }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [actionResult, setActionResult] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchNotifications()
      .then((page) => {
        setNotifications(page.data)
        onUnreadChange(page.meta.unreadCount)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

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

  async function settle(notification: Notification, result: string) {
    setActionResult((prev) => ({ ...prev, [notification.id]: result }))
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
        )
        onUnreadChange((prev) => Math.max(0, prev - 1))
      } catch {}
    }
  }

  async function handleAcceptFriend(notification: Notification) {
    const friendshipId = notification.data?.friendshipId
    if (!friendshipId) return
    try {
      await acceptFriendRequest(friendshipId)
      await settle(notification, 'Accepted!')
    } catch (err: any) {
      await settle(notification, err.message ?? 'No longer pending')
    }
  }

  async function handleDeclineFriend(notification: Notification) {
    const friendshipId = notification.data?.friendshipId
    if (!friendshipId) return
    try {
      await removeFriendship(friendshipId)
      await settle(notification, 'Declined')
    } catch (err: any) {
      await settle(notification, err.message ?? 'No longer pending')
    }
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

        {!loading && notifications.map((n) => {
          const isFriendRequest =
            n.type === 'FRIEND_REQUEST' && Boolean(n.data?.friendshipId)
          const actionable = isFriendRequest && !n.isRead && !actionResult[n.id]
          return (
            <button
              key={n.id}
              onClick={() => !actionable && handleClick(n)}
              className={`w-full text-left px-4 py-3 border-b-2 border-black/40 flex gap-2 ${
                n.isRead ? 'opacity-50' : 'bg-contrast/5'
              }`}
            >
              <span className="text-sm shrink-0">{TYPE_ICONS[n.type] ?? 'ℹ️'}</span>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <p className="font-pressStart text-[10px] text-white leading-relaxed">
                  {n.title}
                </p>
                {n.message && (
                  <p className="font-pressStart text-[9px] text-white/60 leading-relaxed">
                    {n.message}
                  </p>
                )}
                {actionable && (
                  <div className="flex gap-2 mt-1">
                    <span
                      onClick={(e) => { e.stopPropagation(); handleAcceptFriend(n) }}
                      className="font-pressStart text-[9px] text-green-400 border border-green-400 px-2 py-0.5 cursor-pointer"
                    >
                      Accept
                    </span>
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDeclineFriend(n) }}
                      className="font-pressStart text-[9px] text-red-400 border border-red-400 px-2 py-0.5 cursor-pointer"
                    >
                      Decline
                    </span>
                  </div>
                )}
                {actionResult[n.id] && (
                  <p className="font-pressStart text-[8px] text-secundary">
                    {actionResult[n.id]}
                  </p>
                )}
                <p className="font-pressStart text-[8px] text-white/30">
                  {formatDate(n.createdAt)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
