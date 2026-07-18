// Bunyi notifikasi (chime 2-nada) via Web Audio — tanpa file aset. Dipakai oleh notifikasi
// perubahan regime di terminal, dan tombol "Test Sound" di admin Dev Tools.
export function playRegimeChime() {
  if (typeof window === 'undefined') return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    // Browser modern sering start AudioContext dalam state 'suspended' sampai di-resume
    // eksplisit setelah user gesture — tanpa ini, tone() jalan tanpa error tapi SENYAP.
    const play = () => {
      const t0 = ctx.currentTime
      const tone = (freq: number, start: number, dur: number) => {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = freq
        o.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(0.0001, t0 + start)
        g.gain.exponentialRampToValueAtTime(0.3, t0 + start + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur)
        o.start(t0 + start); o.stop(t0 + start + dur + 0.02)
      }
      tone(784, 0, 0.18)      // G5
      tone(1047, 0.13, 0.22)  // C6 (naik, seperti "ding-dong")
      setTimeout(() => ctx.close().catch(() => {}), 700)
    }
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {})
    else play()
  } catch { /* diamkan */ }
}
