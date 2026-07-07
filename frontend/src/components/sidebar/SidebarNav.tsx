import { useNavigate } from 'react-router-dom'
import announcementsIcon from '../../../assets/icons/anouncements.png'
import adminIcon         from '../../../assets/icons/admin-panel.png'
import resourcesIcon     from '../../../assets/icons/resources.png'
import findPeersIcon     from '../../../assets/icons/find-peers.png'
import chatIcon          from '../../../assets/icons/chat.png'
import profileIcon       from '../../../assets/icons/profile.png'
import leaderboardsIcon  from '../../../assets/icons/leaderboards.png'
import feedbackIcon      from '../../../assets/icons/feedback.png'

export type PanelId =
  | 'notifications'
  | 'announcements'
  | 'resources'
  | 'projects'
  | 'social'
  | 'chat'
  | 'profile'
  | 'leaderboards'
  | 'feedback'

interface NavItem {
  id: PanelId
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'announcements', label: 'Announcements', icon: announcementsIcon },
  { id: 'resources',     label: 'Resources',     icon: resourcesIcon     },
  { id: 'social',        label: 'Social',        icon: findPeersIcon     },
  { id: 'chat',          label: 'Chat',          icon: chatIcon          },
  { id: 'profile',       label: 'Profile',       icon: profileIcon       },
  { id: 'leaderboards',  label: 'Leaderboards',  icon: leaderboardsIcon  },
  { id: 'feedback',      label: 'Feedback',      icon: feedbackIcon      },
]

interface Props {
  activePanel: PanelId
  onSelect: (id: PanelId) => void
  unreadCount: number
  announcementsUnread: number
  isAdmin: boolean
}

export default function SidebarNav({
  activePanel,
  onSelect,
  unreadCount,
  announcementsUnread,
  isAdmin,
}: Props) {
  const navigate = useNavigate()
  const bellActive = activePanel === 'notifications'
  return (
    <div className="w-16 h-full bg-black/60 flex flex-col items-center justify-start gap-2 lg:justify-around lg:gap-0 py-4 shrink-0 overflow-y-auto">
      {/* Sino de notificações (sem asset próprio — glifo de texto) */}
      <button
        onClick={() => onSelect('notifications')}
        title="Notifications"
        className={`relative flex items-center justify-center w-9 h-9 transition-opacity ${
          bellActive ? 'opacity-100' : 'opacity-50 hover:opacity-90'
        }`}
      >
        {bellActive && (
          <span className="absolute inset-0 bg-white/10 border border-white/20" />
        )}
        <span className="text-lg relative z-10">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 z-20 min-w-4 h-4 px-0.5 bg-red-500 text-white font-pressStart text-[8px] flex items-center justify-center border border-black">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {/* Painel de projectos (sem asset próprio — glifo de texto) */}
      <button
        onClick={() => onSelect('projects')}
        title="Project Board"
        className={`relative flex items-center justify-center w-9 h-9 transition-opacity ${
          activePanel === 'projects' ? 'opacity-100' : 'opacity-50 hover:opacity-90'
        }`}
      >
        {activePanel === 'projects' && (
          <span className="absolute inset-0 bg-white/10 border border-white/20" />
        )}
        <span className="text-lg relative z-10">📋</span>
      </button>

      {NAV_ITEMS.map(item => {
        const isActive = item.id === activePanel
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            title={item.label}
            className={`relative flex items-center justify-center w-9 h-9 transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-50 hover:opacity-90'
            }`}
          >
            {isActive && (
              <span className="absolute inset-0 bg-white/10 border border-white/20" />
            )}
            <img
              src={item.icon}
              alt={item.label}
              className="w-[22px] h-[22px] object-contain relative z-10"
              draggable={false}
            />
            {item.id === 'announcements' && announcementsUnread > 0 && (
              <span className="absolute -top-1 -right-1 z-20 min-w-4 h-4 px-0.5 bg-red-500 text-white font-pressStart text-[8px] flex items-center justify-center border border-black">
                {announcementsUnread > 9 ? '9+' : announcementsUnread}
              </span>
            )}
          </button>
        )
      })}

      {/* Atalho para a página de administração (apenas admins) */}
      {isAdmin && (
        <button
          onClick={() => navigate('/Admin')}
          title="Admin Panel"
          className="relative flex items-center justify-center w-9 h-9 opacity-50 hover:opacity-90 transition-opacity"
        >
          <img
            src={adminIcon}
            alt="Admin Panel"
            className="w-[22px] h-[22px] object-contain relative z-10"
            draggable={false}
          />
        </button>
      )}
    </div>
  )
}
