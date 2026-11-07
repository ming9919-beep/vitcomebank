import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { decodeQrFromCanvas, drawImageToCanvas, extractPrintedName, parseQrPayload } from '../qr.js'
import { IconBack, IconClock, IconFlash, IconGear, IconImage, IconPin } from '../icons.jsx'
import { useStore } from '../store.jsx'

export default function ScanQR() {
  const nav = useNavigate()
  const { setScannedPayee, rememberPayee, lookupPayeeName } = useStore()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const streamRef = useRef(null)
  const cameraRequest = useRef(0)
  const scanTimer = useRef(0)
  const scanned = useRef(false)
  const ocrBusy = useRef(false)
  const imageBusy = useRef(false)
  const facingRef = useRef('environment')
  const [flash, setFlash] = useState(false)
  const [hint, setHint] = useState('Đưa mã QR vào khung hình')
  const [camOn, setCamOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [facing, setFacing] = useState('environment')
  const showHint = busy || (
    hint !== 'Đưa mã QR vào khung hình'
    && !hint.startsWith('Camera sau:')
    && !hint.startsWith('Camera trước:')
  )

  const stopStream = useCallback(() => {
    cameraRequest.current += 1
    clearTimeout(scanTimer.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCamOn(false)
  }, [])

  const goTransfer = useCallback((payee) => {
    const next = { ...payee, fromQr: true, name: String(payee.name || '').trim() }
    if (!next.name) next.name = lookupPayeeName(next.account)
    if (next.name) rememberPayee(next.account, next.name, next.bank)
    setScannedPayee(next)
    stopStream()
    nav('/transfer', { replace: true, state: next })
  }, [lookupPayeeName, rememberPayee, setScannedPayee, stopStream, nav])

  const applyPayload = useCallback((text, printedName = '') => {
    if (scanned.current) return
    const payee = parseQrPayload(text)
    if (!payee || !/^\d{6,19}$/.test(String(payee.account || '').replace(/\s/g, ''))) {
      setHint('Mã QR không chứa số tài khoản hợp lệ. Hãy quét VietQR')
      return
    }
    payee.account = String(payee.account).replace(/\s/g, '')
    payee.name = String(payee.name || printedName || lookupPayeeName(payee.account) || '').trim()
    const label = [payee.name, payee.bank, payee.account].filter(Boolean).join(' · ')
    setHint(`Đã nhận: ${label}`)
    scanned.current = true
    goTransfer(payee)
  }, [goTransfer, lookupPayeeName])

  const loopScan = useCallback(() => {
    if (scanned.current) return
    if (imageBusy.current) {
      scanTimer.current = window.setTimeout(loopScan, 180)
      return
    }
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video && canvas && video.readyState >= 2) {
      if (drawImageToCanvas(video, canvas, 640)) {
        decodeQrFromCanvas(canvas).then(async (text) => {
          if (!text || scanned.current || ocrBusy.current) return
          const payee = parseQrPayload(text)
          if (payee?.name || lookupPayeeName(payee?.account)) {
            applyPayload(text)
            return
          }
          ocrBusy.current = true
          setHint('Đã thấy mã QR, đang đọc tên trên ảnh...')
          const printed = await extractPrintedName(canvas)
          applyPayload(text, printed)
          ocrBusy.current = false
        }).catch(() => { ocrBusy.current = false })
      }
    }
    scanTimer.current = window.setTimeout(loopScan, 180)
  }, [applyPayload])

  const startCam = useCallback(async (mode) => {
    stopStream()
    const request = cameraRequest.current
    scanned.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      })
      if (request !== cameraRequest.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream
      setCamOn(true)
      setHint(mode === 'user'
        ? 'Camera trước: đưa mã QR đối diện máy để quét'
        : 'Camera sau: đưa mã QR vào khung hình')
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => {})
      }
      loopScan()
    } catch (error) {
      if (request === cameraRequest.current) {
        setCamOn(false)
        setHint(error?.name === 'NotAllowedError'
          ? 'Chưa được cấp quyền camera. Hãy cấp quyền hoặc chọn ảnh mã QR'
          : 'Không mở được camera. Hãy chọn ảnh mã QR để thanh toán')
      }
    }
  }, [loopScan, stopStream])

  useEffect(() => {
    startCam(facingRef.current)
    return () => stopStream()
  }, [startCam, stopStream])

  async function toggleFlash() {
    const track = streamRef.current?.getVideoTracks?.()[0]
    const next = !flash
    if (!track) {
      setHint('Camera chưa sẵn sàng để bật đèn flash')
      return
    }
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setFlash(next)
    } catch {
      setFlash(false)
      setHint('Camera này không hỗ trợ đèn flash')
    }
  }

  function switchCam() {
    const next = facing === 'environment' ? 'user' : 'environment'
    facingRef.current = next
    setFacing(next)
    setFlash(false)
    startCam(next)
  }

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setHint('Hãy chọn tệp hình ảnh có chứa mã QR')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setHint('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 15 MB')
      return
    }
    if (busy) return
    imageBusy.current = true
    setBusy(true)
    setHint('Đang đọc mã QR trong ảnh...')
    let url = ''
    try {
      url = URL.createObjectURL(file)
      const img = new Image()
      img.src = url
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })
      const canvas = canvasRef.current
      if (!canvas || !drawImageToCanvas(img, canvas, 1000)) {
        setHint('Không đọc được ảnh. Thử lại với ảnh rõ hơn')
        return
      }
      const text = await decodeQrFromCanvas(canvas)
      if (!text) {
        setHint('Không tìm thấy mã QR trong ảnh. Hãy chọn ảnh rõ hơn')
        return
      }
      setHint('Đã thấy mã QR, đang đọc tên trên ảnh...')
      const printed = await extractPrintedName(canvas)
      applyPayload(text, printed)
    } catch {
      setHint('Không đọc được ảnh. Thử lại với ảnh rõ hơn')
    } finally {
      if (url) URL.revokeObjectURL(url)
      imageBusy.current = false
      setBusy(false)
    }
  }

  return (
    <div className={`scan-page ${camOn ? '' : 'scan-page-fallback'}`}>
      <video
        ref={videoRef}
        className={`scan-video ${facing === 'user' ? 'mirror' : ''}`}
        playsInline
        muted
        autoPlay
      />
      <div className="scan-shade" />
      <canvas ref={canvasRef} className="scan-canvas" />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="scan-file"
        onChange={onPickFile}
      />

      <div className="scan-top">
        <button className="scan-icon-btn" onClick={() => nav(-1)} aria-label="back">
          <IconBack color="#fff" />
        </button>
        <div className="scan-title">Quét mã QR</div>
        <button className={`scan-icon-btn ${flash ? 'on' : ''}`} onClick={toggleFlash}>
          <IconFlash />
        </button>
        <button className="scan-icon-btn" onClick={switchCam} title="Đổi camera">
          <IconGear />
        </button>
      </div>

      <div className="scan-mid">
        <div className="scan-brand"><span className="g">VCB</span>Digibank</div>
        <div className="scan-desc">Quét mã QR để thanh toán, chuyển tiền và rút tiền mặt tại hệ thống ATM</div>
        <div className="scan-frame">
          <span className="scan-line" />
        </div>
        <div className="scan-paylogos">
          <span>VIETQR cash</span>
          <span>VIETQR</span>
          <span>VNPAY QR</span>
          <span>napas 247</span>
        </div>
        <div className="scan-cards">
          <span className="visa">VISA</span>
          <span className="mc">mastercard</span>
          <span className="cup">UnionPay</span>
        </div>
        {showHint && <div className="scan-hint">{busy ? 'Đang đọc mã QR...' : hint}</div>}
      </div>

      <div className="scan-bottom">
        <button className="scan-act" type="button" onClick={() => fileRef.current?.click()}>
          <IconImage />
          <span>Chọn ảnh mã QR</span>
        </button>
        <button className="scan-act" type="button" onClick={() => nav('/history')}>
          <IconClock size={22} color="#fff" />
          <span>Lịch sử giao dịch</span>
        </button>
        <button className="scan-act" type="button" onClick={() => nav('/branches')}>
          <IconPin />
          <span>Điểm thanh toán</span>
        </button>
      </div>
    </div>
  )
}
