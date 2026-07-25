/**
 * Google Apps Script — kirim notifikasi transaksi BCA ke Datalitiq Keuangan.
 *
 * Pasang di script.google.com (akun Gmail Anda sendiri), lalu buat trigger
 * berjangka setiap 5 atau 10 menit.
 *
 * KENAPA CARA INI, BUKAN GMAIL API:
 * Gmail API tidak punya scope "hanya email dari pengirim X" — yang tersedia
 * hanya gmail.readonly, artinya akses baca SELURUH inbox, dan aplikasi harus
 * menyimpan refresh token yang membuka semua itu selamanya. Untuk membaca
 * beberapa puluh notifikasi per bulan, itu pertukaran yang buruk.
 *
 * Skrip ini berjalan di dalam akun Google Anda sendiri. Tidak ada token akses
 * yang keluar, tidak ada aplikasi pihak ketiga yang diberi izin, dan yang
 * dikirim keluar hanya email yang cocok dengan QUERY di bawah — yang bisa Anda
 * baca dan ubah sendiri kapan saja.
 */

// ── Isi dua baris ini ────────────────────────────────────────────────────
// WAJIB pakai www: datalitiq.com me-redirect 308 ke www.datalitiq.com, dan
// UrlFetchApp tidak dijamin membawa serta body POST saat mengikuti redirect.
// Kalau body-nya hilang, server menerima request kosong dan menolaknya 401 —
// gejalanya "token salah" padahal tokennya benar.
var ENDPOINT = 'https://www.datalitiq.com/api/keuangan/ingest';
var TOKEN    = 'TEMPEL_TOKEN_DARI_HALAMAN_KEUANGAN';

// Hanya email yang cocok query ini yang pernah dibaca dan dikirim.
var QUERY = 'from:bca@bca.co.id subject:"Internet Transaction Journal" -label:datalitiq-terkirim';

// Label penanda: dipakai supaya email yang sudah terkirim tidak dikirim ulang.
// Ini lapisan pertama; server tetap punya kunci idempotensi sendiri (Reference
// No.), jadi kalaupun label gagal terpasang, transaksi tidak akan jadi dua.
var LABEL = 'datalitiq-terkirim';

var MAX_PER_RUN = 25;   // batas per eksekusi, supaya tidak kena limit Apps Script

function kirimNotifikasiBCA() {
  var label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  var threads = GmailApp.search(QUERY, 0, MAX_PER_RUN);
  var terkirim = 0, gagal = 0;

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    var semuaOk = true;

    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      var from = m.getFrom();
      if (from.indexOf('bca.co.id') === -1) continue;   // jaga-jaga

      var payload = {
        token: TOKEN,
        messageId: m.getId(),
        subject: m.getSubject(),
        from: from,
        text: m.getPlainBody(),
        html: m.getBody(),
      };

      try {
        var res = UrlFetchApp.fetch(ENDPOINT, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        });
        var code = res.getResponseCode();
        if (code >= 200 && code < 300) {
          terkirim++;
        } else {
          gagal++;
          semuaOk = false;
          Logger.log('Gagal ' + code + ': ' + res.getContentText().slice(0, 300));
        }
      } catch (e) {
        gagal++;
        semuaOk = false;
        Logger.log('Error: ' + e);
      }
    }

    // Label HANYA dipasang kalau seluruh pesan di thread berhasil terkirim.
    // Memasangnya lebih awal berarti email yang gagal terkirim hilang dari
    // query selamanya — dan transaksinya tidak akan pernah tercatat.
    if (semuaOk) label.addToThread(threads[i]);
  }

  Logger.log('Selesai. Terkirim: ' + terkirim + ', gagal: ' + gagal);
}

/** Jalankan SEKALI untuk memasang trigger otomatis tiap 10 menit. */
function pasangTrigger() {
  var ada = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ada.length; i++) {
    if (ada[i].getHandlerFunction() === 'kirimNotifikasiBCA') ScriptApp.deleteTrigger(ada[i]);
  }
  ScriptApp.newTrigger('kirimNotifikasiBCA').timeBased().everyMinutes(10).create();
  Logger.log('Trigger dipasang: tiap 10 menit.');
}

/**
 * Uji satu email terbaru TANPA memasang label — jalankan ini DULU sebelum
 * pasangTrigger. Aman diulang berkali-kali.
 *
 * Sengaja mencari bertahap dari sempit ke longgar: kegagalan paling umum saat
 * setup pertama bukan token atau endpoint, melainkan QUERY yang tidak cocok
 * dengan subjek email yang benar-benar Anda terima. Sekadar melaporkan "tidak
 * ada email" membuat orang menebak-nebak; melaporkan subjek asli yang ditemukan
 * langsung menunjukkan apa yang harus diperbaiki.
 */
function ujiCoba() {
  if (TOKEN.indexOf('TEMPEL') === 0) {
    Logger.log('BERHENTI: TOKEN belum diisi. Ambil dari /keuangan → tab Inbox → Setup.');
    return;
  }
  Logger.log('Endpoint: ' + ENDPOINT);

  var coba = [
    QUERY.replace(' -label:' + LABEL, ''),
    'from:bca@bca.co.id subject:"Internet Transaction Journal"',
    'from:bca@bca.co.id',
    'from:bca.co.id',
  ];
  var threads = [], dipakai = '';
  for (var i = 0; i < coba.length; i++) {
    threads = GmailApp.search(coba[i], 0, 3);
    if (threads.length) { dipakai = coba[i]; break; }
  }

  if (!threads.length) {
    Logger.log('Tidak ada email dari bca.co.id sama sekali di akun ini.');
    Logger.log('Periksa: apakah notifikasi BCA memang masuk ke akun Gmail INI?');
    return;
  }

  Logger.log('Ketemu lewat query: ' + dipakai);
  if (dipakai !== coba[0]) {
    Logger.log('CATATAN: query utama tidak cocok. Subjek email yang ada:');
    for (var t = 0; t < threads.length; t++) {
      Logger.log('   • "' + threads[t].getMessages()[0].getSubject() + '"');
    }
    Logger.log('   → Sesuaikan var QUERY di atas dengan subjek itu.');
  }

  var m = threads[0].getMessages()[0];
  Logger.log('Menguji: "' + m.getSubject() + '" dari ' + m.getFrom());

  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({
      token: TOKEN, messageId: m.getId(), subject: m.getSubject(),
      from: m.getFrom(), text: m.getPlainBody(), html: m.getBody(),
    }),
  });
  var code = res.getResponseCode(), body = res.getContentText();
  Logger.log('HTTP ' + code + ' → ' + body);

  if (code === 200 && body.indexOf('"status":"draft"') !== -1) {
    Logger.log('BERHASIL — buka /keuangan → tab Inbox, drafnya sudah ada di sana.');
  } else if (code === 200 && body.indexOf('"status":"gagal"') !== -1) {
    Logger.log('Email terkirim tapi formatnya tidak terbaca. Tersimpan utuh di Inbox — laporkan agar parser diperbarui.');
  } else if (code === 401) {
    Logger.log('Token ditolak. Salin ulang dari /keuangan → tab Inbox → Setup.');
  } else if (code === 404 || code === 308 || code === 301) {
    Logger.log('URL salah atau kena redirect. Pastikan ENDPOINT memakai www.');
  }
}
