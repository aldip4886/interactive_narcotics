const QUESTIONS = [
  {
    q: "Seorang penumpang terlihat menolak makan dan minum sepanjang penerbangan, serta berkeringat dingin. Modus penyembunyian narkotika yang paling patut dicurigai adalah...",
    opts: ["Body Strapping di dada", "Body Packing (Telan) melalui saluran cerna", "Narkotika diresapkan ke pakaian", "Penyembunyian di dalam rambut"],
    ans: 1,
    explain: "Penolakan makan/minum dilakukan oleh kurir body packer agar transit paket dalam saluran GI tidak terpicu untuk keluar atau rusak sebelum tiba di tujuan. Keringat dingin merupakan tanda awal kecemasan ekstrem atau kebocoran paket."
  },
  {
    q: "Pada pemeriksaan X-Ray abdomen, tampak bayangan radio-opaque bulat/oval berlapis dengan pola khas. Temuan radiologis ini dikenal sebagai...",
    opts: ["Shadow Sign", "Rosette Sign", "Halo Effect", "Mule Pattern"],
    ans: 1,
    explain: "'Rosette Sign' adalah temuan patognomonik pada rontgen abdomen body packer — kontur udara yang terperangkap pada lipatan simpul kondom/lateks berlapis."
  },
  {
    q: "Pemeriksaan area tubuh sensitif (pemeriksaan badan mendalam / penggeledahan fisik) pada subjek wanita WAJIB dilakukan oleh...",
    opts: ["Petugas laki-laki senior", "Petugas wanita terlatih di ruang pemeriksaan tertutup", "Dokter laki-laki yang bertugas", "Petugas mana pun yang pertama menemukan indikasi"],
    ans: 1,
    explain: "SOP DJBC dan regulasi perlindungan HAM mewajibkan pemeriksaan fisik badan dilakukan oleh petugas dengan jenis kelamin yang sama di ruangan tertutup dan didampingi saksi."
  },
  {
    q: "Narkotika yang disamarkan dengan metode strapping di paha atau betis paling sering menimbulkan indikator fisik berupa...",
    opts: ["Pola tidur berlebihan di pesawat", "Gaya berjalan kaku, pincang, atau langkah diseret (tidak wajar)", "Wajah kemerahan dan demam tinggi", "Suara serak saat menjawab pertanyaan"],
    ans: 1,
    explain: "Bungkusan padat yang dililitkan ketat di paha atau betis membatasi pergerakan sendi lutut dan tungkai, menyebabkan gaya berjalan kaku atau langkah diseret."
  },
  {
    q: "Tindakan pertama yang paling tepat jika dicurigai adanya penyembunyian paket narkotika di rongga mulut (oral concealment) adalah...",
    opts: ["Memasukkan jari petugas ke dalam mulut subjek untuk mengambil bungkusan", "Meminta subjek membuka mulut lebar, menjulurkan lidah, dan memeriksa dengan penlight steril", "Memberikan air minum agar subjek menelannya", "Memaksa subjek batuk keras"],
    ans: 1,
    explain: "Gunakan penlight dan tongue depressor. Petugas TIDAK BOLEH memasukkan jari ke dalam mulut subjek guna mencegah risiko gigitan atau memicu subjek menelan paket secara fatal."
  },
  {
    q: "Risiko medis paling fatal bagi kurir dengan modus body packing jika salah satu paket pembungkus pecah (ruptur) adalah...",
    opts: ["Dehidrasi ringan", "Overdosis masif fatal dan henti jantung dalam hitungan menit", "Sembelit berkepanjangan", "Iritasi kulit ringan"],
    ans: 1,
    explain: "Satu paket body packing dapat berisi 8-12 gram zat murni dengan konsentrasi tinggi. Ruptur satu paket melepaskan dosis mematikan ke aliran darah yang menyebabkan kematian kilat."
  },
  {
    q: "Pada tersangka pembawa paket narkotika di saluran pencernaan, petugas DJBC DILARANG KERAS untuk...",
    opts: ["Membawa tersangka ke rumah sakit rujukan pemerintah", "Memberikan obat pencahar / obat pelancar BAB secara mandiri tanpa resep dokter", "Melakukan wawancara mendalam terkait rute perjalanan", "Melakukan rontgen abdomen"],
    ans: 1,
    explain: "Pemberian obat pencahar tanpa indikasi dokter spesialis sangat berbahaya karena gerakan peristaltik usus yang terstimulasi kuat dapat merobek dinding pembungkus paket."
  },
  {
    q: "Apabila subjek mengaku mengalami patah tulang dan mengenakan gips tebal yang mencurigakan, langkah verifikasi yang benar adalah...",
    opts: ["Langsung memotong gips dengan gergaji darurat", "Melakukan pemindaian Sinar-X pada gips dan verifikasi dokumen rekam medis ke RS penerbit", "Mengabaikan pemeriksaan karena subjek adalah orang sakit", "Mengetuk gips dengan palu"],
    ans: 1,
    explain: "X-Ray akan menampakkan rongga atau densitas serbuk di dalam dinding gips palsu. Verifikasi rekam medis memastikan keabsahan riwayat kesehatan subjek."
  },
  {
    q: "Pemeriksaan rongga tubuh internal (rektum atau vagina) untuk mendeteksi modus cavity insertion HANYA boleh dilakukan oleh...",
    opts: ["Petugas penindakan senior DJBC", "Tenaga medis berwenang (dokter) di fasilitas kesehatan resmi", "Petugas bea cukai yang didampingi penyidik", "Kepala kantor pelayanan"],
    ans: 1,
    explain: "Pemeriksaan invasif internal rongga tubuh secara hukum dan medis HANYA boleh dilaksanakan oleh dokter berwenang di fasilitas kesehatan resmi untuk menjamin keselamatan dan keabsahan alat bukti."
  },
  {
    q: "Fungsi utama pelacakan K-9 (anjing pelacak narkotika) pada pemeriksaan tubuh penumpang di terminal kedatangan adalah...",
    opts: ["Melakukan penggeledahan badan secara paksa", "Deteksi bau residu zat narkotika secara non-invasif dari jarak aman", "Menggantikan seluruh proses wawancara petugas", "Menahan paspor penumpang secara otomatis"],
    ans: 1,
    explain: "Unit K-9 mendeteksi partikel uap bau narkotika (bahkan yang terbungkus rapat) secara cepat dan non-invasif, memberikan indikasi awal yang kuat bagi petugas untuk pemeriksaan mendalam."
  }
];

export class QuizModule {
  constructor({ onComplete }) {
    this.questions  = QUESTIONS;
    this.onComplete = onComplete || (() => {});
    this.current    = 0;
    this.answers    = [];
    this.score      = 0;

    this._overlay   = document.getElementById('quiz-overlay');
    this._qEl       = document.getElementById('quiz-question');
    this._optsEl    = document.getElementById('quiz-options');
    this._feedEl    = document.getElementById('quiz-feedback');
    this._nextBtn   = document.getElementById('quiz-next-btn');
    this._submitBtn = document.getElementById('quiz-submit-btn');
    this._progEl    = document.getElementById('quiz-progress-label');
    this._progFill  = document.getElementById('quiz-progress-fill');
    this._closeBtn  = document.getElementById('btn-close-quiz');

    this._nextBtn?.addEventListener('click',   () => this._nextQuestion());
    this._submitBtn?.addEventListener('click', () => this._finish());
    this._closeBtn?.addEventListener('click',  () => this.close());
  }

  start() {
    this.current = 0;
    this.answers = [];
    this.score   = 0;
    this._overlay.classList.remove('hidden');
    this._renderQuestion();
  }

  close() {
    this._overlay.classList.add('hidden');
  }

  _renderQuestion() {
    const q   = this.questions[this.current];
    const num = this.current + 1;
    const tot = this.questions.length;

    if (this._progEl) this._progEl.textContent = `Soal ${num} / ${tot}`;
    if (this._progFill) this._progFill.style.width = `${(num / tot) * 100}%`;
    if (this._qEl) this._qEl.textContent = q.q;

    if (this._feedEl) {
      this._feedEl.classList.add('hidden');
      this._feedEl.className = 'quiz-feedback-box hidden';
    }
    this._nextBtn?.classList.add('hidden');
    this._submitBtn?.classList.add('hidden');

    if (this._optsEl) {
      this._optsEl.innerHTML = '';
      q.opts.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option-btn';
        btn.textContent = `${String.fromCharCode(65 + i)}. ${opt}`;
        btn.addEventListener('click', () => this._answer(i, btn));
        this._optsEl.appendChild(btn);
      });
    }
  }

  _answer(idx, btn) {
    // Disable all option buttons
    this._optsEl.querySelectorAll('.quiz-option-btn').forEach(b => {
      b.disabled = true;
    });

    const q       = this.questions[this.current];
    const correct = idx === q.ans;
    this.answers.push({ q: this.current, chosen: idx, correct });
    if (correct) this.score++;

    // Highlight options
    this._optsEl.querySelectorAll('.quiz-option-btn').forEach((b, i) => {
      if (i === q.ans) b.classList.add('correct');
      else if (i === idx && !correct) b.classList.add('incorrect');
    });

    // Show explanation feedback
    if (this._feedEl) {
      this._feedEl.className = `quiz-feedback-box ${correct ? 'correct' : 'incorrect'}`;
      this._feedEl.innerHTML = `
        <strong>${correct ? '✅ Jawaban Benar!' : '❌ Jawaban Kurang Tepat.'}</strong><br>
        ${q.explain}
      `;
      this._feedEl.classList.remove('hidden');
    }

    const isLast = this.current === this.questions.length - 1;
    if (isLast) {
      this._submitBtn?.classList.remove('hidden');
    } else {
      this._nextBtn?.classList.remove('hidden');
    }
  }

  _nextQuestion() {
    this.current++;
    this._renderQuestion();
  }

  _finish() {
    this._overlay.classList.add('hidden');
    const pct = Math.round((this.score / this.questions.length) * 100);
    this.onComplete(pct, this.answers);
  }
}
