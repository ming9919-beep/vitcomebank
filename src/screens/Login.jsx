import { useState } from 'react'
import { useStore } from '../store.jsx'
import { IconBack, IconUser } from '../icons.jsx'

const DEMO_PIN = '123456'

export default function Login() {
  const { login, user } = useStore()
  const [language, setLanguage] = useState('en')
  const [mode, setMode] = useState('welcome')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const english = language === 'en'
  const copy = english
    ? { welcome: 'Welcome', enterInfo: 'Please enter login information', phone: 'Username/Phone number', guest: 'Experience without an account', signIn: 'Sign in with PIN', enterPin: 'Enter your PIN', invalid: 'Incorrect PIN. Use 123456 to continue', pinHint: 'Demo PIN: 123456', enterPhone: 'Enter your username or phone number first' }
    : { welcome: 'Xin chào', enterInfo: 'Vui lòng nhập thông tin đăng nhập', phone: 'Tên đăng nhập/Số điện thoại', guest: 'Trải nghiệm không cần tài khoản', signIn: 'Đăng nhập bằng PIN', enterPin: 'Nhập mã PIN', invalid: 'PIN không đúng. Dùng 123456 để trải nghiệm', pinHint: 'Mã PIN demo: 123456', enterPhone: 'Vui lòng nhập tên đăng nhập hoặc số điện thoại' }

  function beginPinLogin(event) {
    event?.preventDefault()
    if (!phone.trim()) {
      setErr(copy.enterPhone)
      return
    }
    setErr('')
    setMode('pin')
  }

  function press(d) {
    if (pin.length >= 6) return
    const next = pin + d
    setPin(next)
    setErr('')
    if (next.length === 6) {
      if (next === DEMO_PIN) login()
      else {
        setErr(copy.invalid)
        setTimeout(() => setPin(''), 280)
      }
    }
  }

  function back() {
    if (pin) {
      setPin((p) => p.slice(0, -1))
      setErr('')
      return
    }
  }

  function backToWelcome() {
    setMode('welcome')
    setPin('')
    setErr('')
  }

  return (
    <div className="login-page">
      <button
        className="login-language"
        type="button"
        aria-label={english ? 'Switch to Vietnamese' : 'Switch to English'}
        onClick={() => setLanguage(english ? 'vi' : 'en')}
      >
        <span className="login-vn-flag"><span>★</span></span>
      </button>

      {mode === 'welcome' ? (
        <>
          <div className="login-hero">
            <div className="login-brand"><span className="g">VCB</span><span>Digibank</span></div>
            <div className="login-welcome">{copy.welcome}</div>
          </div>

          <form className="login-bottom" onSubmit={beginPinLogin}>
            <label className="login-instruction" htmlFor="login-phone">{copy.enterInfo}</label>
            <div className="login-input-wrap">
              <IconUser size={22} color="#707a7d" />
              <input
                id="login-phone"
                type="tel"
                autoComplete="username"
                value={phone}
                onChange={(event) => { setPhone(event.target.value); setErr('') }}
                placeholder={copy.phone}
              />
            </div>
            {err && <div className="login-err">{err}</div>}
            <button className="login-guest" type="button" onClick={login}>
              <span className="login-guest-star">☆</span>
              <span>{copy.guest}</span>
            </button>
            <button className="login-signin" type="submit">{copy.signIn}</button>
          </form>
        </>
      ) : (
        <div className="login-pin-view">
          <button className="login-pin-back" type="button" onClick={backToWelcome} aria-label="Back">
            <IconBack color="#fff" />
          </button>
          <div className="login-pin-content">
            <div className="login-brand"><span className="g">VCB</span><span>Digibank</span></div>
            <div className="login-hello">{copy.welcome}</div>
            <div className="login-name">{user.name}</div>
            <div className="login-pin-prompt">{copy.enterPin}</div>
            <div className="pin-dots">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={`pin-dot ${i < pin.length ? 'on' : ''}`} />
              ))}
            </div>
            {err ? <div className="login-err">{err}</div> : <div className="login-hint">{copy.pinHint}</div>}
          </div>
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => (
              <button
                key={k || 'empty'}
                className={`key ${k === '' ? 'ghost' : ''}`}
                disabled={k === ''}
                onClick={() => (k === '⌫' ? back() : press(k))}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
