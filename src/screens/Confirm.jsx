import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { amountToWords, formatVND } from '../data.js'
import { IconBack, IconChevronDown, IconHomeCircle, IconInfo, IconLock } from '../icons.jsx'
import { TxAmount, TxRows } from '../TxRows.jsx'
import { useStore } from '../store.jsx'

const AUTH_METHODS = ['SMS OTP', 'Smart OTP', 'VinID']

export default function Confirm() {
  const nav = useNavigate()
  const { state } = useLocation()
  const store = useStore()
  const submitting = useRef(false)
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [method, setMethod] = useState('SMS OTP')
  const [showMethod, setShowMethod] = useState(false)
  const payload = state || {}
  const amount = Number(payload.amount) || 0
  const currency = payload.currency || 'VND'
  const rows = payload.rows || []
  const words = payload.words ?? amountToWords(amount)
  const canSubmit = Boolean(
    payload.kind
    && payload.action
    && Number.isFinite(amount)
    && amount > 0
    && (payload.kind !== 'transfer' || Number(payload.action.amount) === amount)
  )

  function submit() {
    if (submitting.current) return
    if (!canSubmit) {
      setErr('Thông tin giao dịch không hợp lệ. Vui lòng quay lại và thử lại.')
      return
    }
    if (otp !== '000000' && otp !== '123456') {
      setErr('OTP không đúng. Dùng 000000 hoặc 123456')
      return
    }
    submitting.current = true
    setIsSubmitting(true)
    try {
      let tx = null
      if (payload.kind === 'transfer') tx = store.applyTransfer(payload.action)
      else if (payload.kind === 'bill') tx = store.applyBill(payload.action)
      else if (payload.kind === 'topup') tx = store.applyTopup(payload.action)
      else if (payload.kind === 'savings') tx = store.applySavings(payload.action)
      else if (payload.kind === 'intl') tx = store.applyTransfer(payload.action)
      if (!tx) throw new Error('Không thể xử lý loại giao dịch này.')
      if (payload.kind === 'transfer' && payload.draft?.fromQr) store.setScannedPayee(null)

      nav('/result', {
        replace: true,
        state: {
          title: payload.successTitle || 'Giao dịch thành công',
          amount,
          currency,
          rows,
          words,
          method,
          ref: tx.ref,
          timeText: tx.timeFull,
          successText: payload.successText
        }
      })
    } catch (error) {
      submitting.current = false
      setIsSubmitting(false)
      setErr(error instanceof Error ? error.message : 'Giao dịch không thành công. Vui lòng thử lại.')
    }
  }

  return (
    <div className="cf-page">
      <div className="page-head cf-head">
        <button
          className="back"
          onClick={() => payload.kind === 'transfer' && payload.draft
            ? nav('/transfer', { replace: true, state: { draft: payload.draft } })
            : nav(-1)}
        >
          <IconBack />
        </button>
        <h1>{payload.title || 'Chuyển tiền trong nước'}</h1>
        <button
          className="cf-home"
          onClick={() => {
            if (payload.kind === 'transfer' && payload.draft?.fromQr) store.setScannedPayee(null)
            nav('/home')
          }}
          aria-label="home"
        >
          <IconHomeCircle size={24} color="#1a9c4a" />
        </button>
      </div>

      <div className="scroll cf-scroll">
        <div className="cf-banner">
          <div className="cf-banner-ico"><IconInfo size={18} color="#fff" /></div>
          <div className="cf-banner-txt">
            {canSubmit
              ? payload.notice || 'Quý khách vui lòng kiểm tra và xác nhận thông tin giao dịch'
              : 'Thông tin giao dịch không hợp lệ. Vui lòng quay lại và tạo lại giao dịch.'}
          </div>
        </div>

        <div className="card cf-card">
          <TxRows rows={rows} />
          <div className="tx-row tx-row-last tx-row-amount">
            <div className="tx-row-label">Số tiền</div>
            <TxAmount amount={amount} currency={currency} words={words} />
          </div>
        </div>

        <div className="card cf-card cf-otp-card">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{method === 'SMS OTP' ? 'Nhập mã OTP gửi qua SMS' : `Nhập ${method}`}</label>
            <div className="cf-otp-row">
              <IconLock color="#1a9c4a" />
              <input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
                placeholder="000000"
                className="cf-otp-input"
              />
            </div>
            {err && <div className="login-err" style={{ marginTop: 8 }}>{err}</div>}
          </div>
        </div>
      </div>

      <div className="cf-bottom">
        <div className="cf-auth">
          <div className="cf-auth-lbl">Phương thức xác thực</div>
          <button className="cf-auth-btn" onClick={() => setShowMethod(true)}>
            <span>{method}</span>
            <IconChevronDown size={16} color="#1a9c4a" />
          </button>
        </div>
        <button className="btn-primary cf-submit" disabled={!canSubmit || otp.length < 6 || isSubmitting} onClick={submit}>
          {isSubmitting ? 'Đang xử lý...' : 'Xác nhận'}
        </button>
      </div>

      {showMethod && (
        <div className="modal-bg" onClick={() => setShowMethod(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="handle" />
            <div className="li-title" style={{ marginBottom: 10 }}>Phương thức xác thực</div>
            <div className="list">
              {AUTH_METHODS.map((m) => (
                <button
                  key={m}
                  className={`list-item ${method === m ? 'on' : ''}`}
                  onClick={() => { setMethod(m); setShowMethod(false) }}
                >
                  <div className="li-body"><div className="li-title">{m}</div></div>
                  {method === m && <span className="cf-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
