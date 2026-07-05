import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../../auth/logout'
import { saveProfile } from '../../../api/character'

interface UserAchievement {
  id: string
  unlockedAt: string
  achievement: {
    title: string
    description: string
    icon: string | null
    xpReward: number
  }
}

interface User {
  id: string
  login: string
  displayName: string
  avatar: string | null
  campus: string | null
  coalition: string | null
  level: number
  xp: number
  evalPoints: number
  role: string
  bio: string | null
  achievements?: UserAchievement[]
}

interface Props {
  user: User | null
}

function Row({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-pressStart text-[9px] text-contrast uppercase">{label}</span>
      <span className="font-pressStart text-[10px] text-white">{value ?? '—'}</span>
    </div>
  )
}

export default function ProfilePanel({ user }: Props) {
  const navigate = useNavigate()

  // Cópia local para reflectir edições sem refazer o fetchMe do Sidebar
  const [profile, setProfile] = useState<User | null>(user)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setProfile(user)
  }, [user])

  const handleLogout = () => {
    logout()
    // Navegar para fora de /Game desmonta o PhaserGame, que já trata de
    // destruir o jogo e desligar o socket no cleanup do useEffect.
    navigate('/', { replace: true })
  }

  function startEdit() {
    if (!profile) return
    setEditName(profile.displayName)
    setEditBio(profile.bio ?? '')
    setError('')
    setEditing(true)
  }

  async function handleSave() {
    if (!profile) return
    if (!editName.trim()) {
      setError('Display name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveProfile({
        displayName: editName.trim(),
        bio: editBio.trim() || undefined,
      })
      setProfile({ ...profile, displayName: editName.trim(), bio: editBio.trim() || null })
      setEditing(false)
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-pressStart text-[10px] text-white/50">Loading...</p>
      </div>
    )
  }

  const achievements = profile.achievements ?? []

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b-4 border-black shrink-0 flex items-center justify-between">
        <span className="font-pressStart text-xs text-contrast">Profile</span>
        <button
          onClick={editing ? () => setEditing(false) : startEdit}
          className="font-pressStart text-[10px] text-secundary border border-secundary px-2 py-0.5"
        >
          {editing ? '✕' : 'Edit'}
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 p-4 border-b-4 border-black">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.displayName}
            className="w-16 h-16 border-b-4 border-r-4 border-l-2 border-t-2 border-black object-cover"
          />
        ) : (
          <div className="w-16 h-16 bg-black/40 border-b-4 border-r-4 border-l-2 border-t-2 border-black flex items-center justify-center">
            <span className="font-pressStart text-contrast text-xl">
              {profile.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {editing ? (
          <div className="flex flex-col gap-2 w-full">
            <input
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setError('') }}
              maxLength={50}
              placeholder="Display name"
              className="px-2 py-1.5 bg-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black w-full"
            />
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Bio (optional)"
              className="px-2 py-1.5 bg-white font-pressStart text-[10px] focus:outline-none border-b-2 border-r-2 border-l border-t border-black w-full resize-none"
            />
            {error && <p className="font-pressStart text-[9px] text-red-400">{error}</p>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-contrast text-black font-pressStart text-[10px] disabled:opacity-50 border-b-2 border-r-2 border-l border-t border-black"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <>
            <p className="font-pressStart text-xs text-white text-center">{profile.displayName}</p>
            <p className="font-pressStart text-[10px] text-white/50">@{profile.login}</p>
          </>
        )}
      </div>

      {/* Badges de conquistas desbloqueadas */}
      {achievements.length > 0 && (
        <div className="flex flex-col gap-2 p-4 border-b-4 border-black">
          <span className="font-pressStart text-[9px] text-contrast uppercase">
            Achievements ({achievements.length})
          </span>
          <div className="flex flex-wrap gap-2">
            {achievements.map((ua) => (
              <span
                key={ua.id}
                title={`${ua.achievement.title} — ${ua.achievement.description} (+${ua.achievement.xpReward} XP)`}
                className="w-8 h-8 flex items-center justify-center text-base bg-black/40 border-b-2 border-r-2 border-l border-t border-black cursor-default"
              >
                {ua.achievement.icon ?? '🏅'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        <Row label="Level"  value={profile.level.toFixed(2)} />
        <Row label="XP"     value={profile.xp.toLocaleString()} />
        <Row label="Eval pts" value={profile.evalPoints} />
        <Row label="Campus"   value={profile.campus} />
        <Row label="Coalition" value={profile.coalition} />
        <Row label="Role"     value={profile.role} />
        {profile.bio && !editing && (
          <div className="flex flex-col gap-0.5">
            <span className="font-pressStart text-[9px] text-contrast uppercase">Bio</span>
            <p className="font-pressStart text-[10px] text-white leading-relaxed">{profile.bio}</p>
          </div>
        )}
      </div>

      <div className="mt-auto p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-4 py-2 bg-black text-red-400 font-pressStart text-[10px] border-b-4 border-r-4 border-l-2 border-t-2 border-neutral_contrast"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
