'use client'

import { useStore } from '@/lib/store'

export type Lang = 'id' | 'en'

// English translations keyed by the Indonesian source string.
// Missing keys fall back to the Indonesian text, so nothing ever breaks.
const EN: Record<string, string> = {
  // ── Navigation groups ──
  'Ringkasan': 'Overview',
  'Trading': 'Trading',
  'Jurnal & Analisa': 'Journal & Analysis',
  'Akun': 'Account',
  'Bantuan': 'Help',

  // ── Nav items ──
  'Dashboard': 'Dashboard',
  'Trade': 'Trades',
  'Catat Trade': 'New Trade',
  'Analisis': 'Analysis',
  'Laporan': 'Reports',
  'Simulator': 'Simulator',
  'Keuangan': 'Finance',
  'Jurnal': 'Journal',
  'Panduan': 'Guide',
  'Setting': 'Settings',
  'Langganan': 'Subscription',
  'Tagihan': 'Billing',
  'Admin': 'Admin',
  'Light Mode': 'Light Mode',
  'Dark Mode': 'Dark Mode',
  'Keluar': 'Log out',
  'Menu lainnya': 'More menu',
  'Lainnya': 'More',

  // ── Common actions/words ──
  'Simpan': 'Save',
  'Batal': 'Cancel',
  'Hapus': 'Delete',
  'Edit': 'Edit',
  'Tutup': 'Close',
  'Tambah': 'Add',
  'Lanjut': 'Next',
  'Kembali': 'Back',
  'Selesai': 'Finish',
  'Mulai': 'Start',
  'Simpan Pengaturan': 'Save Settings',
  'Tersimpan!': 'Saved!',
  'Pilih akun': 'Select account',
  'Semua Akun': 'All Accounts',
  'opsional': 'optional',
  'Catatan (opsional)': 'Note (optional)',
  'Tanggal': 'Date',
  'Jumlah': 'Amount',
  'trade': 'trades',

  // ── Finance ──
  'Keuangan Broker': 'Broker Finance',
  'Catatan dana di akun broker — deposit, withdraw, dan hasil trading': 'Funds in your broker account — deposits, withdrawals, and trading results',
  'Saldo Sekarang': 'Current Balance',
  'Total uang di broker saat ini': 'Total money in the broker now',
  'Total Deposit': 'Total Deposit',
  'Uang yang kamu setor': 'Money you deposited',
  'Total Withdraw': 'Total Withdraw',
  'Uang yang sudah ditarik': 'Money already withdrawn',
  'Profit Trading': 'Trading Profit',
  'Saldo Awal': 'Starting Balance',
  'Deposit': 'Deposit',
  'Withdraw': 'Withdraw',
  'Profit': 'Profit',
  'Cara hitung saldo': 'How the balance is calculated',
  'Deposit Bln Ini': 'Deposit This Month',
  'Withdraw Bln Ini': 'Withdraw This Month',
  'Profit Bln Ini': 'Profit This Month',
  'Profit Trading per Bulan': 'Trading Profit per Month',
  'Deposit vs Withdraw': 'Deposit vs Withdraw',
  'Pertumbuhan Saldo': 'Balance Growth',
  'Catat Dana': 'Record Funds',
  'Riwayat': 'History',
  'Per Akun': 'Per Account',
  'Catat Deposit / Withdraw': 'Record Deposit / Withdraw',
  'Akun Broker': 'Broker Account',
  'ROI Akun Ini': 'This Account ROI',
  'Catat Deposit': 'Record Deposit',
  'Catat Withdraw': 'Record Withdraw',
  'Murni dari hasil trade': 'Purely from trading results',
  'Tambah akun broker dulu di menu Setting.': 'Add a broker account first in Settings.',
  'Tambah akun broker di menu Setting': 'Add a broker account in Settings',
  'Belum ada catatan dana. Catat deposit pertamamu.': 'No fund records yet. Record your first deposit.',
  'Awal': 'Initial',

  // ── Dashboard extra ──
  'Butuh minimal 2 trade untuk tampilkan grafik': 'Need at least 2 trades to show the chart',
  'No trades yet': 'No trades yet',
  'per trade': 'per trade',
  'Monthly Target': 'Monthly Target',
  'This month': 'This month',

  // ── Settings extra ──
  'Belum ada akun. Tambah akun broker di bawah.': 'No accounts yet. Add a broker account below.',

  // ── Dashboard ──
  'Your trading performance overview': 'Your trading performance overview',
  'Ringkasan performa trading kamu': 'Your trading performance overview',
  'Selamat pagi': 'Good morning',
  'Selamat siang': 'Good afternoon',
  'Selamat sore': 'Good evening',
  'Selamat malam': 'Good night',
  'Saldo Trading': 'Trading Balance',
  'Saldo di broker saat ini': 'Balance in broker now',
  'Win Rate': 'Win Rate',
  'Recent Trades': 'Recent Trades',
  'Equity Curve': 'Equity Curve',

  // ── Settings ──
  'Profil, konfigurasi, strategi, dan akun': 'Profile, configuration, strategies, and accounts',
  'Profil': 'Profile',
  'Nama Tampilan': 'Display Name',
  'Umum': 'General',
  'Bahasa': 'Language',
  'Mata Uang': 'Currency',
  'Pair Default': 'Default Pair',
  'Target Harian': 'Daily Target',
  'Target Mingguan': 'Weekly Target',
  'Target Bulanan': 'Monthly Target',
  'Minggu Mulai Hari Senin': 'Week Starts on Monday',
  'Nama Akun': 'Account Name',
  'Broker / Platform': 'Broker / Platform',
  'Tambah Akun Broker': 'Add Broker Account',
  'Tambah Akun': 'Add Account',

  // ── Wizard ──
  'Selamat Datang': 'Welcome',
  'Ayo siapkan jurnal trading kamu dalam beberapa langkah singkat.': "Let's set up your trading journal in a few quick steps.",
  'Siapa nama kamu?': 'What is your name?',
  'Nama Lengkap': 'Full Name',
  'Pilih Broker': 'Choose Broker',
  'Broker atau platform yang kamu pakai': 'The broker or platform you use',
  'Ketik nama broker…': 'Type broker name…',
  'Modal / Deposit Awal': 'Starting Capital / Deposit',
  'Berapa saldo awal di akun ini?': 'What is the starting balance in this account?',
  'Trade Pertama': 'First Trade',
  'Catat satu trade untuk memulai (boleh dilewati)': 'Record one trade to start (optional)',
  'Lewati': 'Skip',
  'Selesai! Selamat trading 🎉': 'Done! Happy trading 🎉',
  'Pengaturan awal selesai. Kamu bisa ubah kapan saja di menu Setting.': 'Initial setup complete. You can change anything anytime in Settings.',
  'Masuk ke Dashboard': 'Go to Dashboard',
  'Langkah': 'Step',

  // ── Subscription ──
  'Paket Langganan': 'Subscription Plans',
  'Pilih paket yang sesuai kebutuhan trading kamu': 'Choose the plan that fits your trading needs',
  'Paling Populer': 'Most Popular',
  'Paket Sekarang': 'Current Plan',
  'Pilih Paket': 'Choose Plan',
  '/bulan': '/month',
  'Gratis': 'Free',
  'selamanya': 'forever',

  // ── Billing ──
  'Tagihan & Pembayaran': 'Billing & Payments',
  'Kelola langganan dan lihat riwayat pembayaran': 'Manage subscription and view payment history',
  'Paket Aktif': 'Active Plan',
  'Metode Pembayaran': 'Payment Method',
  'Riwayat Pembayaran': 'Payment History',
  'Belum ada pembayaran': 'No payments yet',
  'Tanggal Perpanjangan': 'Renewal Date',
}

export function useT() {
  const { settings } = useStore()
  const lang: Lang = settings.language ?? 'id'
  return (s: string) => (lang === 'en' ? (EN[s] ?? s) : s)
}

export function useLang() {
  const { settings, saveSettings } = useStore()
  const lang: Lang = settings.language ?? 'id'
  const setLang = (l: Lang) => saveSettings({ language: l })
  return [lang, setLang] as const
}
