// Bunyi notifikasi via Web Audio — tanpa file aset.
//
// Tiap parameter punya pola nada sendiri, dan arahnya menentukan nada naik atau
// turun. Tujuannya supaya trader tahu APA yang berubah dan KE MANA arahnya tanpa
// harus melihat layar — saat sedang membaca chart, bunyi yang seragam untuk semua
// kejadian tidak memberi informasi apa pun.
//
//   regime   → 2 nada, register tengah
//   momentum → 2 nada pendek, register tinggi
//   signal   → 3 nada (paling penting, paling menonjol)
//
//   naik → nada menaik   ·   turun → nada menurun   ·   datar → dua nada sama
export type ChimeKind = 'regime' | 'momentum' | 'signal' | 'coiling' | 'ignition'
export type ChimeDir = 'up' | 'down' | 'flat'

const PATTERNS: Record<ChimeKind, { base: number[]; dur: number; gap: number }> = {
  regime:   { base: [784, 1047], dur: 0.20, gap: 0.13 },        // G5 → C6
  momentum: { base: [988, 1319], dur: 0.11, gap: 0.09 },        // B5 → E6, lebih pendek
  signal:   { base: [659, 880, 1175], dur: 0.17, gap: 0.12 },   // E5 → A5 → D6
  // R&D Sniper: coiling = 2 nada rendah pelan (siaga, bukan aksi);
  // ignition = 4 nada cepat menanjak (urgensi — momen entry sedang lewat).
  coiling:  { base: [440, 523], dur: 0.24, gap: 0.20 },          // A4 → C5
  ignition: { base: [659, 784, 988, 1319], dur: 0.09, gap: 0.075 }, // E5→G5→B5→E6 rentetan cepat
}

export function playChime(kind: ChimeKind = 'regime', dir: ChimeDir = 'up') {
  if (typeof window === 'undefined') return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const pat = PATTERNS[kind]
    // 'flat' memakai satu nada berulang: perubahan ke netral bukan kabar baik
    // maupun buruk, jadi tidak pantas berbunyi naik atau turun.
    const freqs = dir === 'down' ? [...pat.base].reverse()
      : dir === 'flat' ? pat.base.map(() => pat.base[0])
      : pat.base

    // Browser modern sering start AudioContext dalam state 'suspended' sampai di-resume
    // eksplisit setelah user gesture — tanpa ini, tone() jalan tanpa error tapi SENYAP.
    const play = () => {
      const t0 = ctx.currentTime
      freqs.forEach((freq, i) => {
        const start = i * pat.gap
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = freq
        o.connect(g); g.connect(ctx.destination)
        g.gain.setValueAtTime(0.0001, t0 + start)
        g.gain.exponentialRampToValueAtTime(0.3, t0 + start + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + pat.dur)
        o.start(t0 + start); o.stop(t0 + start + pat.dur + 0.02)
      })
      const total = (freqs.length - 1) * pat.gap + pat.dur
      setTimeout(() => ctx.close().catch(() => {}), (total + 0.4) * 1000)
    }
    if (ctx.state === 'suspended') ctx.resume().then(play).catch(() => {})
    else play()
  } catch { /* diamkan */ }
}

// Nama lama — dipakai tombol uji di admin Dev Tools.
export const playRegimeChime = () => playChime('regime', 'up')
