import { useEffect, useState } from 'react'

type Status = 'checking' | 'ok' | 'down'

export default function App() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then((res) => setStatus(res.ok ? 'ok' : 'down'))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStatus('down')
      })
    return () => controller.abort()
  }, [])

  return (
    <main>
      <h1>Slotwise</h1>
      <p>{`API: ${status}`}</p>
    </main>
  )
}
