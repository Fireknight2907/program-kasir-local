from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from xml.sax.saxutils import escape
from pathlib import Path
import json
root=Path(r'C:\Users\richa\program-kasir\program-kasir-local')
out=root/'output/pdf/audit-menyeluruh-kasir-pintar.pdf'
pdfmetrics.registerFont(TTFont('Arial',r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold',r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialBold',italic='Arial',boldItalic='ArialBold')
styles=getSampleStyleSheet()
for name,size,leading,font,after in [('BodyAudit',10.2,14.5,'Arial',9),('TitleAudit',24,29,'ArialBold',20),('SectionAudit',17,22,'ArialBold',15),('SubAudit',11.5,15,'ArialBold',7),('SmallAudit',8.1,11,'Arial',5),('CellAudit',9,12,'Arial',0)]:
 styles.add(ParagraphStyle(name=name,fontName=font,fontSize=size,leading=leading,spaceAfter=after,textColor=colors.HexColor('#202020')))
story=[]
def p(s):story.append(Paragraph(s,styles['BodyAudit']))
def sub(s):story.append(Spacer(1,5));story.append(Paragraph(s,styles['SubAudit']))
def page(title):
 if story:story.append(PageBreak())
 story.append(Paragraph(title,styles['SectionAudit']))
def foot(s):story.append(Spacer(1,9));story.append(Paragraph(s,styles['SmallAudit']))
def table(headers,rows,widths):
 data=[[Paragraph('<b>'+escape(str(v))+'</b>',styles['CellAudit']) for v in headers]]
 data += [[Paragraph(escape(str(v)),styles['CellAudit']) for v in row] for row in rows]
 t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeeeee')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor('#888888')),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#dddddd')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
 story.append(t);story.append(Spacer(1,12))

story.append(Paragraph('Audit menyeluruh Kasir Pintar',styles['TitleAudit']))
p('<b>Keputusan: belum siap untuk trial dengan pelanggan nyata.</b> Pengamanan aplikasi sudah menolak beberapa bentuk klik berulang dan tagihan basi, tetapi jalur database publik masih dapat melewatinya. Audit juga membuktikan masalah harga negatif, perubahan pesanan yang sudah disajikan, dan konsistensi laporan penjualan.')
p('Ada <b>sembilan temuan</b>: satu kritis, tiga tinggi, dan lima menengah. Dua temuan akses memerlukan keputusan tentang batas hak kasir dan masa berlaku tautan pelanggan; keduanya tidak disamakan dengan eksploitasi lintas akun yang sudah terjadi.')
table(['ID / prioritas','Temuan','Status bukti'],[
('F01 / P0','Database publik: izin baca, tambah, ubah, hapus tanpa RLS','Metadata aktif + Data API baca kosong'),
('F02 / P1','Upload Storage publik melewati validasi aplikasi','Policy aktif + kode upload'),
('F03 / P1','Harga negatif menurunkan tagihan melalui Edit Order','Reproduksi PostgreSQL; rollback'),
('F04 / P1','Order sudah disajikan masuk antrean dengan jumlah penuh','Reproduksi PostgreSQL + kode UI'),
('F05 / P2','Pembayaran lintas tengah malam masuk hari pembukaan meja','Reproduksi filter tanggal'),
('F06 / P2','Harga satuan rekap salah untuk campuran harga historis','Reproduksi fungsi rekap'),
('F07 / P2','Retry pembuatan takeaway dapat membuat sesi tambahan','Simulasi respons hilang + kode'),
('F08 / P2','Arsip dibatasi di UI admin; endpoint menerima kasir','Alur otorisasi + fixture'),
('F09 / P2','Endpoint QR membagikan metadata pembayaran internal','Reproduksi respons fixture')],[69,286,144])
p('<b>Urutan tindakan:</b> tutup F01 dan F02; perbaiki harga dan perubahan kitchen; lalu rapikan laporan, retry pembuatan sesi, dan pembatasan data. Lolos tes aplikasi tidak cukup apabila akses langsung Supabase masih terbuka.')
foot('Sumber: bukti reproduksi [7], kode lokal [8-14,17], tes [15-16]. P0: penghalang trial. P1: risiko langsung pada operasi/integritas. P2: perlu perbaikan atau batas operasional yang eksplisit. Nomor rujukan dijabarkan pada bagian Sumber.')

page('1. Ruang lingkup dan batas bukti')
p('Penilaian dilakukan pada 9 September 2026 terhadap repository program-kasir-local. Commit terakhir adalah 534d8af (Rev 4.7), dengan perubahan lokal yang lebih baru. Rujukan file/baris berlaku pada salinan lokal saat audit, bukan otomatis pada GitHub.')
p('Cakupan meliputi tampilan web, total harga, kirim/tambah order, kitchen, pembayaran, penutupan meja, klik cepat, retry, serta akses pelanggan/kasir/admin dan jalur langsung Supabase. Kode dan perilaku aplikasi merupakan bukti utama; dokumentasi resmi memeriksa prinsip pengamanan, bukan mengasumsikan konfigurasi server.')
table(['Tahap','Kontrol yang ada','Batas yang ditemukan'],[
('Pelanggan mengirim','ID pengiriman, batas porsi, kunci sesi','Jalur database langsung terbuka'),
('Order tersimpan','Order dan total dalam transaksi database','Edit menerima harga menu negatif'),
('Kitchen menerima','Status dan versi kitchen','Edit setelah served mengantrekan jumlah penuh'),
('Kasir membayar','Total + revisi yang dikonfirmasi; retry identik','Laporan memakai tanggal pembukaan meja'),
('Meja ditutup','Sesi lama ditolak untuk order baru','Pembuatan takeaway belum punya identitas retry'),
('Data diakses','Login staf pada mutasi/koleksi transaksi','Hak arsip dan metadata publik belum dipersempit')],[98,198,203])
sub('Kekuatan bukti')
p('<b>Terbukti:</b> keluaran endpoint/fungsi, state fixture, atau izin aktif tercatat. <b>Risiko operasional:</b> akibat yang mungkin terjadi, seperti memasak terlalu banyak; bukan klaim kejadian restoran yang sudah diamati. <b>Belum terverifikasi:</b> perangkat fisik, backup restore, HTTPS produksi, dan kebijakan bisnis yang belum dinyatakan.')
p('Tes database baru memakai data contoh dalam transaksi yang di-rollback. Tidak ada modifikasi transaksi restoran, percobaan penghapusan anonim, atau pengambilan isi password staf/pelanggan. Data API diperiksa dengan hasil kosong. Browser memakai fixture dan tidak mengirim pesanan ke dapur nyata.')
p('Sebanyak 83 tes regresi dan enam skenario browser lulus pada pengulangan audit ini. Temuan baru menunjukkan celah cakupan tes, bukan bahwa semua perilaku sistem aman. Build produksi dari pemeriksaan sebelumnya tetap hanya bukti build; bukan uji kapasitas atau keamanan menyeluruh.')
foot('Sumber: [7] evidence.json; [15] hasil regresi; [16] hasil browser. SHA-256 file rujukan disimpan pada source-fingerprints.json untuk mengidentifikasi versi bukti.')

page('2. F01 - Akses langsung database terbuka')
p('<b>P0 / kritis. Terbukti pada konfigurasi aktif.</b> Role anon memiliki SELECT, INSERT, UPDATE, DELETE pada delapan tabel aplikasi dan RLS semuanya nonaktif. Baca kosong ke User, Transaction, dan OrderSubmission menerima HTTP 200 tanpa sesi login aplikasi. Anon key diperlukan; key ini tidak boleh dianggap sebagai otorisasi pengguna.<super>1,2,7</super>')
table(['Tabel','RLS','SELECT','INSERT','UPDATE','DELETE'],[(x,'Nonaktif','Ya','Ya','Ya','Ya') for x in ['User','Transaction','Order','OrderItem','OrderSubmission','LoginThrottle','MenuItem','Category']],[139,80,70,70,70,70])
sub('Reproduksi aman')
p('Baca relrowsecurity dan has_table_privilege untuk role anon, cocokkan delapan tabel aplikasi, lalu kirim permintaan Data API select=id&amp;limit=0 memakai anon key. Tiga endpoint menerima HTTP 200 tanpa mengambil isi baris. Izin mutasi dibuktikan melalui metadata, bukan dengan mengubah atau menghapus data produksi.')
sub('Dampak restoran')
p('Pemegang key dan URL proyek dapat melewati pemeriksaan login, batas order, snapshot pembayaran, serta harga server apabila mengakses tabel langsung. Izin terbuka juga mencakup akun dan hitungan pembatasan login. Membaca kolom password atau mengubah role menjadi admin tidak dicoba, tetapi tidak ada RLS yang melindungi tabel akun.')
sub('Perbaikan dan syarat lulus')
p('Aktifkan RLS dan cabut izin anon/authenticated pada tabel internal, atau keluarkan tabel dari skema Data API yang diekspos. Koneksi Prisma saat diperiksa menggunakan role server dengan bypassrls=true; uji kembali akses server setelah perubahan. Setiap migrasi tabel baru juga harus mengatur grants/RLS. Draft penutupan sudah tersedia, tetapi <b>belum diterapkan</b>.')
p('Syarat lulus: Data API tanpa otorisasi tidak boleh membaca atau memodifikasi data internal; API pelanggan hanya melakukan operasi sesi yang diizinkan. Uji mutasi menggunakan fixture terisolasi, bukan transaksi restoran.')
foot('1. Supabase, Securing your API: grants mengatur akses objek, RLS membatasi baris. 2. Supabase, Row Level Security. 7. Metadata ACL dan anonymous_empty_read. File: src/lib/prisma.js; prisma/schema.prisma. Draft: prisma/sql/trial-public-access-review.sql.')

page('3. F02, F08, F09 - Batas akses lainnya')
sub('F02 / P1 - Storage mengizinkan upload publik')
p('Policy "Izinkan upload foto menu" mengizinkan INSERT kepada role public dengan kondisi bucket_id = menu-images. Route upload juga memakai NEXT_PUBLIC_SUPABASE_ANON_KEY. Jadi validasi login, PNG, dimensi dan batas 5 MB pada route dapat dilewati melalui Storage langsung. Tidak dilakukan upload anonim; buktinya policy aktif dan penggunaan key yang sama.<super>3,7,14</super>')
p('Tutup izin tulis publik dan gunakan kredensial khusus server pada route. SUPABASE_SERVICE_ROLE_KEY belum tersedia. Menghapus policy sebelum menyiapkan jalur server bisa memutus upload sah. Syarat lulus: upload anonim ditolak; upload staf lewat route diterima dan tetap tervalidasi. Izin baca gambar dapat dipertahankan sesuai kebutuhan.')
sub('F08 / P2 - Arsip admin hanya dibatasi di tampilan')
p('Tombol Arsip Transaksi hanya tampil untuk ADMIN, tetapi GET /api/transaction memakai requireStaff yang menerima ADMIN dan KASIR. tab=archive diterima; tanpa tanggal, filter kosong. Fixture menghasilkan HTTP 200 dengan cakupan tanpa filter. Ini membuktikan inkonsistensi UI/server, bukan bahwa kebijakan bisnis pasti melarang seluruh statistik kasir.<super>8,11,13</super>')
p('Tetapkan matriks hak kasir. Jika arsip/ekspor khusus admin, periksa role pada server dan batasi rentang data kasir. Jika seluruh arsip memang boleh dibaca kasir, samakan UI dan dokumentasikan kebijakan. Menyembunyikan tombol tidak menjadi kontrol akses.')
sub('F09 / P2 - Metadata internal ikut dikirim lewat QR')
p('GET /api/transaction/[id] tidak meminta login dan mengembalikan objek lengkap. Fixture menunjukkan paidById, paymentRequestId, dan paymentMethod ikut terkirim pada transaksi selesai. Pemanggil harus mengetahui ID; tidak ada bukti UUID baru dapat ditebak atau seluruh meja bisa dienumerasi. QR memang memberi akses sesi, tetapi tidak semua metadata internal diperlukan pelanggan.<super>4,7,8</super>')
p('Bentuk respons pelanggan dengan daftar kolom yang diizinkan; pisahkan endpoint staf. Tetapkan data struk yang tetap boleh dibaca setelah sesi tutup. Syarat lulus: pelanggan menerima item, total, dan status yang diperlukan, tanpa identitas petugas atau ID internal retry pembayaran.')
foot('3. Supabase, Storage Access Control. 4. OWASP API1:2023 mendukung pemeriksaan hak objek; bukan bukti enumerasi ID. Kode: upload/route.js:10-32; session.js:41-44; transaction/route.js:22; transaction/[id]/route.js:5-26; src/app/page.js:1510.')

page('4. F03 - Harga negatif merusak tagihan')
p('<b>P1 / tinggi. Direproduksi pada PostgreSQL, kemudian di-rollback.</b> Endpoint menu hanya memeriksa name/price terisi dan memakai parseInt. Harga -10000 lolos. Edit Order mengambil harga tersebut dan memeriksa total akhir, tetapi tidak memvalidasi setiap harga menu tambahan.<super>7,9,10</super>')
table(['Langkah','Masukan / state','Hasil aktual'],[
('Buat menu','price = -10000','HTTP 200; tersimpan -10000'),
('Transaksi awal','1 item lama @ 50000','Total 50000'),
('Edit: tambah item negatif','1 item lama + 1 item @ -10000','HTTP 200; total menjadi 40000'),
('Periksa order','Order lama 50000; tambahan -10000','Penjumlahan benar, nilai bisnis salah'),
('Akhiri tes','Rollback transaksi fixture','Data uji tidak tersimpan')],[93,203,203])
sub('Mengapa kontrol lama tidak menangkapnya')
p('Harga browser memang tidak dipercayai pada endpoint order pelanggan. Namun, data menu yang dianggap otoritatif bisa negatif karena jalur pengelolaan menu tidak memvalidasinya. Edit menerima angka itu sepanjang jumlah akhir nonnegatif. Ini perbedaan validasi antarjalur, bukan manipulasi field price browser pada POST /api/order.')
sub('Dampak dan batas akses')
p('Lewat aplikasi, perubahan menu memerlukan staf. Selama F01 terbuka, harga juga berpotensi diubah lewat database publik. Dampak yang terbukti adalah tagihan turun dan order tambahan bernilai negatif. Endpoint pelanggan biasa justru menolak harga negatif; tidak semua jalur memiliki perilaku yang sama.')
sub('Perbaikan')
p('Validasi harga secara ketat pada tambah/ubah menu dan saat setiap endpoint order/edit mengonsumsi harga: bilangan bulat aman, batas bawah sesuai kebijakan menu gratis, serta maksimum yang masuk akal. Tambahkan constraint database. Diskon, jika diperlukan, harus menjadi fitur dengan otorisasi dan riwayat, bukan menu berharga negatif.<super>5</super>')
p('Syarat lulus: nilai negatif, pecahan, angka di luar batas, dan string seperti "10000abc" ditolak sebelum menulis. Harga historis sah tetap dipertahankan. Ulangi Rp50.000 + menu negatif; total harus tidak berubah.')
foot('5. OWASP Input Validation: validasi sintaks dan makna bisnis di server. 7. Probe negative_menu_price dan negative_price_edit_reduces_bill. 10. menu/route.js:16-38; menu/[id]/route.js:5-17. 9. transaction/[id]/edit-order/route.js:25-45. Semua path route berada di src/app/api/.')

page('5. F04 - Perubahan order setelah disajikan')
p('<b>P1 / tinggi. State database terbukti; kelebihan masak adalah risiko operasional.</b> Mengubah jumlah item lama mengembalikan seluruh order ke queued dan mengosongkan acceptedAt/acceptedById, termasuk order yang sebelumnya served. Kitchen menampilkan jumlah terbaru tanpa jumlah terpenuhi atau selisih yang perlu dikerjakan.<super>7,9,12,17</super>')
table(['State','Yang sudah disajikan','Yang tampil di kitchen'],[
('Awal: served','1 porsi','Tidak berada di antrean aktif'),
('Jumlah diedit 1 menjadi 2','Secara fisik tetap 1 porsi','queued; tampil 2 porsi'),
('Yang perlu dibedakan','Riwayat 1 porsi tetap ada','Tambahan 1 porsi atau instruksi koreksi eksplisit')],[120,179,200])
sub('Langkah reproduksi')
p('Siapkan satu item dengan status served. Buka Edit, tambah jumlah dari satu menjadi dua, dan simpan memakai revisi yang benar. Hasil: HTTP 200, kitchenStatus=queued, quantity=2, acceptedAt=null. Tidak ada field delta atau jumlah terpenuhi dalam struktur yang diperiksa.')
p('Tampilan memang menyatakan "Pesanan diubah kasir. Periksa ulang jumlah terbaru." Pesan ini membantu, tetapi tidak menjelaskan apakah dua porsi adalah total atau dua porsi baru. Jika antrean dipahami sebagai pekerjaan baru, satu yang sudah disajikan ditambah dua yang dimasak ulang menghasilkan tiga porsi untuk tagihan dua. Audit tidak melakukan atau mengamati proses memasak nyata.')
sub('Usulan perbaikan')
p('Pisahkan tambahan makanan dari perubahan item yang telah diproses. Simpan jumlah lama, jumlah baru, jumlah terpenuhi, selisih, petugas, serta waktu. Pilihan sederhana untuk trial: larang edit langsung item served dan minta tambahan melalui order baru. Pengurangan item yang telah dibuat memerlukan alur pembatalan/koreksi yang eksplisit.')
p('Penerimaan ulang harus menjelaskan pekerjaan, misalnya "Tambahan 1 porsi; sebelumnya 1 sudah disajikan". Pertahankan bukti penerimaan lama; menimpa timestamp mengurangi kemampuan menelusuri kejadian.')
sub('Syarat lulus')
p('Setelah satu porsi served ditambah menjadi dua, hanya satu pekerjaan tambahan masuk kitchen. Uji saat accepted, preparing, ready, pengurangan jumlah, pembatalan seluruh item, dan dua petugas pada versi berbeda. Versi basi harus tetap ditolak tanpa menghilangkan riwayat pekerjaan.')
foot('7. Probe served_order_requeued_without_delta. 9. src/app/api/transaction/[id]/edit-order/route.js:30-39. 12. src/components/KitchenPanel.js:10. 17. prisma/schema.prisma:40-53; tidak ditemukan model riwayat perubahan atau jumlah terpenuhi.')

page('6. F05 dan F06 - Laporan penjualan')
sub('F05 / P2 - Pendapatan memakai tanggal pembukaan meja')
p('GET /api/transaction?tab=archive memfilter createdAt. fetchStats juga memakai endpoint archive. calculateDailyRecap menjumlahkan transaksi completed dari hasil itu, lalu UI menyebutnya "Total Pendapatan Harian". Pembayaran setelah tengah malam masuk ke laporan hari sebelumnya.<super>7,8,11</super>')
table(['Contoh UTC+8','Nilai','Hasil'],[
('Meja dibuka','8 Sep, 23:50','createdAt pada 8 September'),
('Pembayaran dicatat','9 Sep, 00:10; Rp20.000','completedAt pada 9 September'),
('Laporan 8 September','Rp20.000','Masuk tanggal pembukaan'),
('Laporan 9 September','Rp0 untuk transaksi ini','Pembayaran hari itu tidak tercakup')],[144,174,181])
p('Filter direproduksi dengan tanggal contoh. Sebagai kelompok meja yang dibuka hari itu, filter bisa disengaja; sebagai penerimaan uang hari itu, hasilnya tidak sesuai. Label tidak menjelaskan perbedaan tersebut. Query juga memakai UTC+8 tetap, sehingga lokasi dan jam tutup operasional perlu ditetapkan.')
p('Pisahkan tanggal pembukaan meja, tanggal order, dan tanggal pembayaran/businessDate. Untuk laporan penerimaan uang gunakan completedAt/paidAt atau tanggal bisnis yang ditetapkan. Syarat lulus: pembayaran lintas tengah malam masuk tepat satu hari yang sesuai, tidak hilang atau dihitung dua kali.')
sub('F06 / P2 - Harga satuan campuran ditampilkan sebagai satu angka')
p('Rekap menggabungkan item berdasarkan nama dan mempertahankan unitPrice pertama. Satu porsi Rp20.000 dan satu porsi Rp30.000 menghasilkan quantity=2, unitPrice=Rp20.000, totalRevenue=Rp50.000. Total pendapatan benar, tetapi tampilan menyiratkan 2 x Rp20.000. Menu berbeda dengan nama sama juga masuk kelompok yang sama.<super>7,11</super>')
p('Kelompokkan berdasarkan ID menu dan harga historis, atau tampilkan "harga bervariasi" beserta rinciannya. Jangan mengganti harga lama dengan harga menu sekarang. Syarat lulus: subtotal per kelompok cocok dengan quantity x harga; total tetap Rp50.000 pada layar maupun ekspor.')
foot('7. Probe midnight_revenue_uses_opening_day dan recap_mixed_price_label. 8. src/app/api/transaction/route.js:56-62. 11. src/app/page.js:219-234, 525-587 (unitPrice:566). Ini evaluasi konsistensi produk, bukan kesimpulan akuntansi/pajak yurisdiksi tertentu.')

page('7. F07 - Klik cepat dan pengiriman ulang')
p('<b>P2 / menengah. Retry pembuatan sesi takeaway belum idempoten.</b> Guard klik cepat melindungi pemanggilan bersamaan di satu tampilan. Receipt order melindungi pengiriman ulang dengan ID sama. Namun, handleCreateDirectTakeaway membuat sesi lewat POST /api/transaction sebelum menyimpan payload pending ke localStorage.<super>7,11</super>')
sub('Skenario yang masih gagal')
p('Sesi dibuat di server, tetapi respons hilang sebelum browser menerima transactionId. Belum ada payload pending. Staf mencoba kembali, sehingga POST /api/transaction dipanggil lagi. Pembuatan sesi tidak menerima identitas retry, dan benturan nama takeaway memang diizinkan. Simulasi menghasilkan dua permintaan pembuatan sesi.')
p('<b>Dampaknya potensi sesi kosong tambahan, bukan bukti order makanan atau pembayaran ganda.</b> Pada titik kegagalan ini order belum dikirim. Sesi tambahan dapat membingungkan kasir, mengotori daftar aktif, dan mempersulit pencocokan transaksi.')
table(['Skenario','Hasil / batas'],[
('20 kiriman order dengan ID sama','Lolos: satu order; receipt dipakai kembali'),
('Klik Simpan Edit berulang','Lolos: guard langsung dan revisi server'),
('Pembayaran memakai total lama','Lolos: ditolak saat total/revisi berubah'),
('Retry pembayaran identik','Lolos: tidak menulis pembayaran kedua'),
('Respons hilang setelah order tersimpan','Lolos: payload pending mempertahankan ID'),
('Respons hilang setelah sesi dibuat','Celah F07: pembuatan belum dideduplikasi')],[226,273])
sub('Perbaikan dan syarat lulus')
p('Buat ID operasi sebelum permintaan pertama dan simpan agar tahan-reload. Server harus mengembalikan sesi yang sama berdasarkan ID itu, atau menyediakan operasi atomik pembuatan takeaway dan order awal. Nama pelanggan yang sama bukan identitas retry. Identitas operasi stabil adalah prinsip umum; rujukan Stripe bukan usulan menambah integrasi Stripe.<super>6</super>')
p('Putuskan respons setelah commit pembuatan sesi, reload browser, lalu kirim ulang: hanya satu sesi dan satu order awal boleh ada. Uji juga storage browser gagal, respons 500, penolakan 4xx yang pasti, dua tab, dan pembuatan pesanan baru yang memang disengaja.')
foot('6. Stripe, Idempotent requests. 7. Probe takeaway_creation_retry_not_idempotent memakai simulasi respons hilang. 11. src/app/page.js:1040-1089. 15. Tes order-retry, order-client, edit-order dan payment-auth.')

page('8. Cakupan yang lulus dan batasnya')
p('<b>83 tes regresi lulus</b> pada pengulangan audit. Enam skenario browser juga lulus tanpa runtime error: formulir admin desktop/HP dan klik berulang, edit harga historis, konflik pembayaran, penerimaan kitchen, putus koneksi kitchen, dan status pelanggan. Semuanya memakai fixture pada browser; ini bukan sertifikasi bebas bug.<super>15,16</super>')
table(['Area','Bukti saat ini','Yang belum tercakup'],[
('Porsi berlebihan','1000 porsi dan pemecahan baris ditolak','Load test publik; banyak sesi berbeda'),
('Sesi tertutup','Order lama ditolak; nomor meja bisa dipakai sesi baru','Perangkat fisik dengan Wi-Fi putus berulang'),
('Retry order','ID sama menghasilkan receipt yang sama','Idempotensi pembuatan takeaway: F07'),
('Harga / total','Harga historis lama tetap saat edit','Harga negatif F03; label rekap F06'),
('Kitchen','Transisi dan versi basi diuji','Selisih pekerjaan sesudah served: F04'),
('Pembayaran','Snapshot total/revisi dan replay diuji','Pencocokan dengan uang atau bukti bank'),
('Akun admin','Form, hash, peran, anti-submit ganda','Akses langsung tabel User: F01'),
('Gambar','PNG palsu/rusak/besar ditolak route','Upload langsung Storage: F02')],[98,207,194])
sub('Pemetaan fitur')
p('<b>Penerimaan kitchen:</b> sudah ada di kode lokal dan diuji. <b>Status order:</b> status kitchen terpisah dari pembayaran/sesi. <b>Modifier/catatan makanan:</b> belum ditemukan alur penyimpanan pada skema; bungkus/makan di tempat bukan modifier. <b>Pemesanan staf:</b> sebagian, yaitu takeaway langsung dan tambahan melalui Edit; belum alur pelayan khusus.')
p('<b>Printer:</b> tidak ada bukti antrean cetak, acknowledgment perangkat, atau pemulihan job printer kitchen yang dapat diverifikasi. Antrean layar dapat menjadi prosedur cadangan, tetapi teks petunjuk bukan bukti cetak berhasil. CASH/QRIS/CARD saat ini dicatat manual; menandai selesai tidak membuktikan dana diterima bank.')
foot('15. tmp/audit/regression-results.txt: 83 pass, 0 fail. 16. tmp/audit/browser-results.txt. 17. prisma/schema.prisma. Hasil PostgreSQL/concurrency terdahulu tercatat di laporan sebelumnya; audit ini menambah probe, bukan mengklaim semua tes terdahulu dijalankan ulang.')

page('9. Prioritas perbaikan dan kriteria trial')
sub('Pertama: tutup jalur yang melewati aplikasi')
p('Tangani F01: atur grants/RLS atau pemaparan Data API pada tabel internal, lalu buktikan penolakan akses anonim. Tangani F02 bersama kredensial upload server agar upload sah tidak terputus. Draft SQL yang sudah ada perlu ditinjau sebelum diterapkan; laporan ini tidak menerapkannya.')
sub('Kedua: lindungi uang dan pekerjaan kitchen')
p('Perbaiki validasi harga di semua jalur dan tambahkan constraint database. Pisahkan tambahan makanan dari koreksi order yang sudah diproses. Kitchen harus melihat pekerjaan tambahan, bukan menafsirkan total terbaru. Uji item sudah served untuk membuktikan satu tambahan menghasilkan tepat satu pekerjaan tambahan.')
sub('Ketiga: laporan, retry dan hak data')
p('Tetapkan tanggal bisnis dan cakupan laporan. Perbaiki penyajian harga campuran. Tambahkan idempotensi pembuatan takeaway, kemudian putuskan data yang boleh dibaca kasir dan pelanggan. Respons pelanggan cukup memuat yang diperlukan untuk memesan serta melihat status/struk.')
table(['Kriteria sebelum trial','Bukti yang dibutuhkan'],[
('Keamanan','Anon tidak dapat membaca/menulis tabel internal atau upload langsung; route sah tetap bekerja'),
('Tagihan','Harga ilegal ditolak di semua jalur; total item, order, transaksi dan pembayaran cocok'),
('Kitchen','Tambahan setelah served hanya menjadi selisih pekerjaan; koreksi tercatat'),
('Klik / koneksi','Retry operasi yang sama tidak membuat sesi/order tambahan'),
('Laporan','Pembayaran lintas tanggal sesuai tanggal bisnis yang dinyatakan'),
('Operasional','Uji dua perangkat, Wi-Fi putus, printer gagal, dan pemulihan backup')],[132,367])
p('Bukti kemampuan restore backup, HTTPS produksi, dan kapasitas pada jumlah meja tertentu belum tersedia. Ketiganya tetap menjadi verifikasi lingkungan. Data lama yang pernah ganda/rusak jangan digabung otomatis tanpa pencocokan dengan staf.')
p('<b>Keputusan tetap belum siap trial.</b> Setelah F01-F04 ditutup dan kriteria di atas lulus, trial terbatas dapat dipertimbangkan dengan prosedur manual jelas untuk bagian yang belum terotomasi. Ini kriteria penerimaan yang direkomendasikan, bukan klaim bahwa perubahan telah diterapkan.')
foot('Prioritas berdasarkan [7-17]. F08 bergantung pada kebijakan hak kasir; F09 memerlukan keputusan masa akses struk. Tidak ada kode aplikasi, izin Supabase, atau transaksi restoran yang diubah dalam putaran audit ini.')

page('10. Sumber dan rujukan bukti')
refs=[
('1','Supabase. Securing your API. Tanpa tanggal publikasi; diakses 9 September 2026.','https://supabase.com/docs/guides/api/securing-your-api'),
('2','Supabase. Row Level Security. Tanpa tanggal publikasi; diakses 9 September 2026.','https://supabase.com/docs/guides/database/postgres/row-level-security'),
('3','Supabase. Storage Access Control. Tanpa tanggal publikasi; diakses 9 September 2026.','https://supabase.com/docs/guides/storage/security/access-control'),
('4','OWASP. API1:2023 Broken Object Level Authorization. Edisi 2023; diakses 9 September 2026.','https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/'),
('5','OWASP. Input Validation Cheat Sheet. Tanpa tanggal publikasi; diakses 9 September 2026.','https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html'),
('6','Stripe. Idempotent requests. Tanpa tanggal publikasi; diakses 9 September 2026.','https://docs.stripe.com/api/idempotent_requests')]
for n,label,url in refs:story.append(Paragraph(n+'. '+escape(label)+'<br/><link href="'+url+'" color="#333333">'+escape(url)+'</link>',styles['SmallAudit']))
local=[
('7','Bukti privat: tmp/audit/evidence.json dan audit-probes.cjs. Metadata ACL/Storage, baca Data API kosong, fixture rollback dan reproduksi fungsi; 9 September 2026. Tidak memuat key atau isi data restoran.'),
('8','Kode: src/app/api/transaction/route.js:22-80; src/app/api/transaction/[id]/route.js:5-79. Koleksi, filter tanggal, detail publik, pembayaran dan penghapusan.'),
('9','Kode: src/app/api/transaction/[id]/edit-order/route.js:5-49. Harga tambahan, total, item asal dan reset status kitchen.'),
('10','Kode: src/app/api/menu/route.js:16-38; src/app/api/menu/[id]/route.js:5-25. Validasi dan mutasi harga menu.'),
('11','Kode: src/app/page.js:219-234, 525-587, 1040-1089, 1136, 1259, 1510. Statistik, rekap, takeaway, snapshot pembayaran/edit, dan tombol arsip.'),
('12','Kode: src/components/KitchenPanel.js:3-10; src/app/api/kitchen/[id]/route.js; src/app/api/kitchen/route.js. Antrean, jumlah dan transisi status.'),
('13','Kode: src/lib/session.js:41-44 dan requireAdmin. Pemeriksaan role staf/admin.'),
('14','Kode: src/app/api/upload/route.js:10-32; src/lib/png-upload.js. Key, validasi route, dan Storage.'),
('15','Tes privat: tmp/audit/regression-results.txt; tests/*.test.cjs. Pengulangan 83 pass, 0 fail, 9 September 2026.'),
('16','Tes browser privat: tmp/audit/browser-results.txt; tests/trial-browser.cjs. Enam skenario fixture tanpa runtime error.'),
('17','Skema: prisma/schema.prisma:25-53; catatan terdahulu docs/trial-readiness.md. Versi file: tmp/audit/source-fingerprints.json dan line-references.json.')]
for n,label in local:story.append(Paragraph(n+'. '+escape(label),styles['SmallAudit']))
foot('Rujukan lokal berada di C:/Users/richa/program-kasir/program-kasir-local. URL proyek, key, kredensial, dan data akun/pelanggan tidak dicantumkan. Sumber eksternal mendukung prinsip desain; bukti bug berasal dari kode, metadata aktif, serta reproduksi lokal.')
doc=SimpleDocTemplate(str(out),pagesize=(595.28,841.89),rightMargin=48,leftMargin=48,topMargin=43,bottomMargin=39,title='Audit menyeluruh Kasir Pintar',author='',pageCompression=1)
doc.build(story)
from pypdf import PdfReader
r=PdfReader(str(out))
print(json.dumps({'pdf':str(out),'pages':len(r.pages),'pageTextLengths':[len(p.extract_text() or '') for p in r.pages]}))
