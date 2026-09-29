import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/store'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Неверная почта или пароль' : error.message)
    setBusy(false)
  }

  return (
    <div className="page page--login">
      <div className="login__frames" aria-hidden>
        <span className="empty-frame empty-frame--a" />
        <span className="empty-frame empty-frame--b" />
      </div>
      <p className="hero__title">
        Маленький
        <br />
        музей.
      </p>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Почта</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--wide" disabled={busy}>
          {busy ? 'Вхожу…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
