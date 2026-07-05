import { useState } from 'react'
import { submitFeedback } from '../api/feedback'

export default function Feedback() {
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
      setTimeout(() => window.close(), 2000)
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-[480px] bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black p-8">
        <h1 className="font-pressStart text-sm text-contrast">Feedback</h1>
        <p className="font-pressStart text-xs text-contrast text-center">
          Thanks for your feedback!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[480px] bg-neutral_contrast border-b-8 border-r-8 border-l-4 border-t-4 border-black p-8">
      <h1 className="font-pressStart text-sm text-contrast">Feedback</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-1 w-full">
          <label className="font-pressStart text-xs text-contrast">Name</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            maxLength={100}
            className="px-3 py-2 text-sm font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full"
          />
        </div>

        <div className="flex flex-col gap-1 w-full">
          <label className="font-pressStart text-xs text-contrast">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError('') }}
            maxLength={200}
            className="px-3 py-2 text-sm font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full"
          />
        </div>

        <div className="flex flex-col gap-1 w-full">
          <label className="font-pressStart text-xs text-contrast">Title</label>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError('') }}
            maxLength={150}
            className="px-3 py-2 text-sm font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full"
          />
        </div>

        <div className="flex flex-col gap-1 w-full">
          <label className="font-pressStart text-xs text-contrast">Message</label>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setError('') }}
            maxLength={2000}
            rows={5}
            className="px-3 py-2 text-sm font-pressStart focus:outline-none border-b-4 border-r-4 border-l-2 border-t-2 border-black w-full resize-none"
          />
        </div>

        {error && <p className="text-red-500 text-xs font-pressStart">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="px-6 py-3 bg-black text-white font-pressStart text-xs disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send Feedback'}
        </button>
      </form>
    </div>
  )
}
