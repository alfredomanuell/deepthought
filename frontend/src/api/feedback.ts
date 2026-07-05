import { API_BASE_URL } from '../config/api'

export async function submitFeedback(name: string, email: string, title: string, message: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, title, message }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message ?? 'Failed to send feedback')
  }
}
