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
var ENDPOINT = 'https://datalitiq.com/api/keuangan/ingest';
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

/** Uji satu email terbaru TANPA memasang label — untuk memastikan setup benar. */
function ujiCoba() {
  var threads = GmailApp.search('from:bca@bca.co.id subject:"Internet Transaction Journal"', 0, 1);
  if (!threads.length) { Logger.log('Tidak ada email BCA yang cocok.'); return; }
  var m = threads[0].getMessages()[0];
  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({
      token: TOKEN, messageId: m.getId(), subject: m.getSubject(),
      from: m.getFrom(), text: m.getPlainBody(), html: m.getBody(),
    }),
  });
  Logger.log('HTTP ' + res.getResponseCode() + ' → ' + res.getContentText());
}
