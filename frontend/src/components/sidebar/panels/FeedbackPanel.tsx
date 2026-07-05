import { useState } from 'react'
import { submitFeedback } from '../../../api/feedback'

export default function FeedbackPanel() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !title.trim() || !message.trim()) {
      setError('All fields are required')
      return
    }
    setSending(true)
    setError('')
    try {
      await submitFeedback(name.trim(), email.trim(), title.trim(), message.trim())
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setName('')
        setEmail('')
        setTitle('')
        setMessage('')
      }, 3000)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
        <p className="font-pressStart text-xs text-contrast text-center leading-relaxed">
          Thanks for your feedback!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b-4 border-black shrink-0">
        <span className="font-pressStart text-xs text-contrast">Feedback</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label className="font-pressStart text-[10px] text-contrast">Name</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            maxLength={100}
            className="px-2 py-1.5 text-xs font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full bg-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-pressStart text-[10px] text-contrast">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            maxLength={200}
            className="px-2 py-1.5 text-xs font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full bg-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-pressStart text-[10px] text-contrast">Title</label>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setError('') }}
            maxLength={150}
            className="px-2 py-1.5 text-xs font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full bg-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-pressStart text-[10px] text-contrast">Message</label>
          <textarea
            value={message}
            onChange={e => { setMessage(e.target.value); setError('') }}
            maxLength={2000}
            rows={4}
            className="px-2 py-1.5 text-xs font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full resize-none bg-white"
          />
        </div>

        {error && <p className="text-red-500 text-[10px] font-pressStart">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="px-4 py-2 bg-black text-white font-pressStart text-[10px] disabled:opacity-50 border-b-4 border-r-4 border-l-2 border-t-2 border-neutral_contrast"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
