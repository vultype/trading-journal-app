/**
 * Google Apps Script — kirim notifikasi transaksi BCA ke Datalitiq Keuangan.
 *
 * Skrip ini berjalan di dalam akun Google Anda sendiri. Tidak ada token akses
 * yang keluar, tidak ada aplikasi pihak ketiga yang diberi izin, dan yang
 * dikirim keluar hanya email yang cocok dengan QUERY di bawah.
 *
 * KENAPA BUKAN GMAIL API: Gmail API tidak punya scope "hanya email dari
 * pengirim X" — yang tersedia hanya gmail.readonly, artinya akses baca SELURUH
 * inbox lewat refresh token yang tersimpan selamanya. Untuk beberapa puluh
 * notifikasi per bulan, itu pertukaran yang buruk.
 */

// ── Isi baris TOKEN di bawah ─────────────────────────────────────────────
// WAJIB pakai www: datalitiq.com me-redirect 308 ke www.datalitiq.com, dan
// UrlFetchApp tidak dijamin membawa serta body POST saat mengikuti redirect.
var ENDPOINT = 'https://www.datalitiq.com/api/keuangan/ingest';
var TOKEN    = 'TEMPEL_TOKEN_DARI_HALAMAN_KEUANGAN';

// Pengirim yang dipantau. Jendela waktu ditambahkan otomatis di bawah.
var QUERY_DASAR = 'from:bca@bca.co.id';

// Berapa hari ke belakang yang dipindai tiap kali jalan. Tidak perlu besar:
// yang sudah terkirim dilewati lewat cache ID, jadi ini cuma jaring pengaman
// kalau skrip sempat mati beberapa hari.
var HARI_MUNDUR = 7;

var MAX_PESAN_PER_RUN = 40;   // batas per eksekusi, supaya tidak kena limit Apps Script

// ══ PELACAKAN PER-PESAN, BUKAN PER-THREAD ════════════════════════════════
// Versi awal skrip ini memberi LABEL pada thread yang sudah terkirim lalu
// mengecualikannya lewat "-label:". Itu diam-diam kehilangan transaksi:
// notifikasi BCA semuanya bersubjek "Internet Transaction Journal", jadi Gmail
// menggabungkannya menjadi SATU percakapan. Begitu thread itu berlabel, setiap
// email baru yang menyusul ke dalamnya ikut tersembunyi dari query — selamanya.
//
// Sekarang yang dicatat adalah ID tiap PESAN di PropertiesService. Kebal
// terhadap penggabungan thread, dan server tetap punya kunci idempotensi
// sendiri (Reference No.) sebagai lapisan terakhir.
var PROP_KEY = 'bca_terkirim_ids';
var MAX_CACHE = 400;          // ~7KB; batas per properti Apps Script 9KB

// ══ ujiCoba SENGAJA DITARUH PALING ATAS ══════════════════════════════════
// Apps Script memilih fungsi PERTAMA di file sebagai target default tombol Run.
// Fungsi diagnostik harus jadi yang paling gampang dijalankan tidak sengaja.

/**
 * Uji satu email terbaru TANPA menyentuh cache. Jalankan ini DULU.
 * Aman diulang berkali-kali.
 */
function ujiCoba() {
  if (TOKEN.indexOf('TEMPEL') === 0) {
    Logger.log('BERHENTI: TOKEN belum diisi. Ambil dari /keuangan → tab Inbox → Setup.');
    return;
  }
  Logger.log('Endpoint: ' + ENDPOINT);

  var threads = GmailApp.search(QUERY_DASAR, 0, 3);
  if (!threads.length) {
    Logger.log('Tidak ada email dari bca@bca.co.id di akun ini.');
    Logger.log('Periksa: apakah notifikasi BCA memang masuk ke akun Gmail INI?');
    return;
  }

  var msgs = threads[0].getMessages();
  var m = msgs[msgs.length - 1];   // pesan TERBARU di thread, bukan yang tertua
  Logger.log('Menguji: "' + m.getSubject() + '" (' + m.getDate() + ')');

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
    Logger.log('BERHASIL — buka /keuangan → tab Inbox.');
  } else if (code === 200 && body.indexOf('"status":"gagal"') !== -1) {
    Logger.log('Terkirim tapi format tak terbaca. Tersimpan utuh di Inbox — laporkan agar parser diperbarui.');
  } else if (code === 401) {
    Logger.log('Token ditolak. Salin ulang dari /keuangan → tab Inbox → Setup.');
  } else if (code === 404 || code === 308 || code === 301) {
    Logger.log('URL salah atau kena redirect. Pastikan ENDPOINT memakai www.');
  }
}

/** Sinkronisasi rutin — dipanggil trigger tiap 10 menit. */
function kirimNotifikasiBCA() {
  var terkirim = 0, gagal = 0, dilewati = 0;
  var sudah = _cacheAmbil();
  var set = {};
  for (var a = 0; a < sudah.length; a++) set[sudah[a]] = 1;

  var q = QUERY_DASAR + ' newer_than:' + HARI_MUNDUR + 'd';
  var threads = GmailApp.search(q, 0, 100);
  Logger.log('Query: ' + q + ' → ' + threads.length + ' thread');

  for (var i = 0; i < threads.length && terkirim + gagal < MAX_PESAN_PER_RUN; i++) {
    var msgs = threads[i].getMessages();

    for (var j = 0; j < msgs.length && terkirim + gagal < MAX_PESAN_PER_RUN; j++) {
      var m = msgs[j];
      var id = m.getId();
      if (set[id]) { dilewati++; continue; }               // sudah pernah dikirim
      if (m.getFrom().indexOf('bca.co.id') === -1) continue;

      try {
        var res = UrlFetchApp.fetch(ENDPOINT, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({
            token: TOKEN, messageId: id, subject: m.getSubject(),
            from: m.getFrom(), text: m.getPlainBody(), html: m.getBody(),
          }),
        });
        var code = res.getResponseCode();
        if (code >= 200 && code < 300) {
          terkirim++;
          sudah.push(id); set[id] = 1;
          // Disimpan per pesan, bukan sekali di akhir: kalau eksekusi kena batas
          // waktu Apps Script di tengah jalan, yang sudah terkirim tetap tercatat
          // dan tidak dikirim ulang.
          _cacheSimpan(sudah);
        } else {
          gagal++;
          Logger.log('  GAGAL ' + code + ': ' + res.getContentText().slice(0, 200));
        }
      } catch (e) {
        gagal++;
        Logger.log('  ERROR: ' + e);
      }
    }
  }

  Logger.log('Selesai. Terkirim: ' + terkirim + ', gagal: ' + gagal + ', dilewati (sudah ada): ' + dilewati);
}

/**
 * Ambil email LAMA di luar jendela HARI_MUNDUR. Jalankan manual sekali saja
 * kalau ingin mengimpor riwayat. Ubah angka hari sesuai kebutuhan.
 */
function imporRiwayat() {
  var HARI = 90;
  var terkirim = 0, dilewati = 0, gagal = 0;
  var sudah = _cacheAmbil();
  var set = {};
  for (var a = 0; a < sudah.length; a++) set[sudah[a]] = 1;

  var threads = GmailApp.search(QUERY_DASAR + ' newer_than:' + HARI + 'd', 0, 200);
  Logger.log('Riwayat ' + HARI + ' hari: ' + threads.length + ' thread');

  for (var i = 0; i < threads.length; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j], id = m.getId();
      if (set[id]) { dilewati++; continue; }
      if (m.getFrom().indexOf('bca.co.id') === -1) continue;
      try {
        var res = UrlFetchApp.fetch(ENDPOINT, {
          method: 'post', contentType: 'application/json', muteHttpExceptions: true,
          payload: JSON.stringify({
            token: TOKEN, messageId: id, subject: m.getSubject(),
            from: m.getFrom(), text: m.getPlainBody(), html: m.getBody(),
          }),
        });
        if (res.getResponseCode() < 300) { terkirim++; sudah.push(id); set[id] = 1; }
        else { gagal++; Logger.log('  GAGAL ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200)); }
      } catch (e) { gagal++; Logger.log('  ERROR: ' + e); }
    }
    if (i % 10 === 0) { _cacheSimpan(sudah); Logger.log('  ...' + (i + 1) + '/' + threads.length + ' (terkirim ' + terkirim + ')'); }
  }
  _cacheSimpan(sudah);
  Logger.log('Selesai. Terkirim: ' + terkirim + ', dilewati: ' + dilewati + ', gagal: ' + gagal);
}

function _cacheAmbil() {
  var raw = PropertiesService.getUserProperties().getProperty(PROP_KEY) || '';
  return raw ? raw.split(',') : [];
}
function _cacheSimpan(ids) {
  // Simpan yang TERBARU: yang lama sudah di luar jendela HARI_MUNDUR, jadi tidak
  // akan dipindai lagi walau ID-nya terlupakan.
  var potong = ids.slice(Math.max(0, ids.length - MAX_CACHE));
  PropertiesService.getUserProperties().setProperty(PROP_KEY, potong.join(','));
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
 * Kosongkan cache ID supaya SEMUA email dalam jendela dikirim ulang. Aman:
 * server menolak duplikat lewat Reference No., jadi tidak akan jadi transaksi
 * ganda. Pakai kalau curiga ada yang terlewat.
 */
function resetCache() {
  PropertiesService.getUserProperties().deleteProperty(PROP_KEY);
  Logger.log('Cache dikosongkan. Jalankan kirimNotifikasiBCA untuk memindai ulang.');
}
