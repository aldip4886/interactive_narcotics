const QUESTIONS = [
  {
    q: "Seorang penumpang terlihat menolak makan dan minum sepanjang penerbangan, serta berkeringat dingin. Modus penyembunyian narkotika yang paling patut dicurigai adalah...",
    opts: ["Body Strapping di perut", "Body Packing (Telan) melalui lambung", "Narkotika diresapkan ke kain", "Prostetik palsu"],
    ans: 1,
    explain: "Penolakan makan/minum dilakukan oleh body packer agar tidak mengganggu posisi paket dalam saluran GI. Keringat dingin adalah tanda awal paket mendekati ruptur."
  },
  {
    q: "Pada pemeriksaan X-Ray abdomen, tampak pola bayangan radio-opaque berbentuk roset berulang. Kondisi ini dikenal sebagai...",
    opts: ["Shadow Sign", "Rosette Sign", "Halo Effect", "Mule Pattern"],
    ans: 1,
    explain: "'Rosette Sign' adalah temuan khas pada X-Ray abdomen body packer — gambaran khas dari paket narkotika yang terbungkus latex di dalam saluran pencernaan."
  },
  {
    q: "Pemeriksaan area pembalut wanita (sanitary pad) pada penumpang perempuan WAJIB dilakukan oleh...",
    opts: ["Petugas laki-laki senior", "Petugas perempuan yang terlatih", "Dokter laki-laki yang berwenang", "Siapapun yang tersedia"],
    ans: 1,
    explain: "Prosedur standar DJBC dan hukum perlindungan HAM mewajibkan pemeriksaan pada area gender-sensitif dilakukan oleh petugas perempuan, dengan saksi, dan dokumentasi resmi."
  },
  {
    q: "Narkotika yang diresapkan ke dalam serat kain pakaian paling efektif dideteksi menggunakan alat...",
    opts: ["X-Ray bagasi biasa", "Ion Mobility Spectrometry (IMS) / swab trace detection", "Pemeriksaan visual", "Timbangan digital"],
    ans: 1,
    explain: "IMS (Ion Mobility Spectrometry) mendeteksi residu kimia pada permukaan kain pada tingkat partikel — alat wajib di checkpoint modern untuk mendeteksi modus kain diresapi."
  },
  {
    q: "Saat memeriksa penumpang yang dicurigai menggunakan modus body strapping di area perut, urutan prosedur yang BENAR adalah...",
    opts: ["Langsung buka pakaian subjek", "Pat-down menyeluruh dari rusuk ke pinggul oleh petugas sesama gender, minta angkat baju jika diperlukan", "Minta subjek ke toilet untuk membuka sendiri", "Langsung X-Ray tanpa pat-down"],
    ans: 1,
    explain: "Prosedur pat-down standar DJBC: petugas sesama gender menekan area torso secara sistematis dari rusuk bawah ke pinggul. Jika ditemukan anomali, barulah dilanjutkan dengan pemeriksaan lebih lanjut."
  },
  {
    q: "Risiko terbesar bagi body packer (penumpang yang menelan paket narkotika) jika paket ruptur adalah...",
    opts: ["Mual ringan yang hilang sendiri", "Overdosis masif yang dapat menyebabkan kematian dalam menit", "Dehidrasi", "Sembelit parah"],
    ans: 1,
    explain: "Satu paket kokain atau heroin yang ruptur dapat menyebabkan overdosis masif dan kematian dalam hitungan menit. Inilah mengapa petugas DILARANG memberikan pencahar atau stimulan."
  },
  {
    q: "Petugas menemukan gips pada kaki penumpang yang mencurigakan. Langkah pertama yang tepat adalah...",
    opts: ["Langsung bongkar gips", "Minta penumpang melepas sendiri", "Lakukan X-Ray pada gips dan verifikasi dokumen medis ke RS penerbit", "Abaikan karena berbentuk alat medis"],
    ans: 2,
    explain: "X-Ray akan menampilkan rongga atau kepadatan tidak normal dalam gips palsu. Verifikasi dokumen ke rumah sakit penerbit memastikan keaslian kondisi medis yang diklaim."
  },
  {
    q: "Ketika memeriksa kain yang dicurigai mengandung narkotika cair (misalnya fentanyl), petugas WAJIB...",
    opts: ["Mencium kain untuk memastikan baunya", "Merendam kain dalam air untuk cek reaksi", "Menggunakan sarung tangan nitril — jangan kontak kulit langsung", "Menyentuh dengan tangan kosong tapi cuci tangan sesudahnya"],
    ans: 2,
    explain: "Fentanyl dapat terserap melalui kulit (absorpsi transdermal) dalam jumlah yang berbahaya bahkan fatal. Sarung tangan nitril WAJIB digunakan — bukan lateks yang bisa meresap."
  },
  {
    q: "Modus insertion melalui anus paling mudah diidentifikasi secara visual dari...",
    opts: ["Warna kulit yang berbeda", "Cara berjalan tidak normal dengan kaki renggang dan menghindari duduk", "Ukuran kepala yang lebih besar", "Cara bernapas yang berbeda"],
    ans: 1,
    explain: "Subjek dengan benda asing di rektum akan berjalan dengan kaki renggang, menghindari duduk penuh, atau duduk miring ke satu sisi untuk mengurangi tekanan."
  },
  {
    q: "Standar SCORM yang digunakan pada modul pelatihan ini adalah...",
    opts: ["SCORM 1.2", "SCORM 2004 4th Edition", "AICC", "xAPI (Tin Can)"],
    ans: 1,
    explain: "Modul ini menggunakan SCORM 2004 4th Edition yang mendukung cmi.completion_status dan cmi.success_status — standar modern yang lebih kaya fitur dibanding SCORM 1.2."
  }
];

export class QuizModule {
  constructor({ onComplete }) {
    this.questions  = QUESTIONS;
    this.onComplete = onComplete || (() => {});
    this.current    = 0;
    this.answers    = [];
    this.score      = 0;

    this._overlay  = document.getElementById('quiz-overlay');
    this._qEl      = document.getElementById('quiz-question');
    this._optsEl   = document.getElementById('quiz-options');
    this._feedEl   = document.getElementById('quiz-feedback');
    this._nextBtn  = document.getElementById('quiz-next-btn');
    this._submitBtn= document.getElementById('quiz-submit-btn');
    this._progEl   = document.getElementById('quiz-progress-label');

    this._nextBtn.addEventListener('click',   () => this._nextQuestion());
    this._submitBtn.addEventListener('click', () => this._finish());
  }

  start() {
    this.current = 0;
    this.answers = [];
    this.score   = 0;
    this._overlay.classList.remove('hidden');
    this._renderQuestion();
  }

  _renderQuestion() {
    const q   = this.questions[this.current];
    const num = this.current + 1;
    const tot = this.questions.length;

    this._progEl.textContent = `Soal ${num} / ${tot}`;
    this._qEl.textContent    = q.q;
    this._feedEl.classList.add('hidden');
    this._feedEl.className   = 'hidden';
    this._nextBtn.classList.add('hidden');
    this._submitBtn.classList.add('hidden');

    this._optsEl.innerHTML = '';
    q.opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = `${String.fromCharCode(65 + i)}. ${opt}`;
      btn.addEventListener('click', () => this._answer(i, btn));
      this._optsEl.appendChild(btn);
    });
  }

  _answer(idx, btn) {
    // Disable all options
    this._optsEl.querySelectorAll('.quiz-option').forEach(b => {
      b.disabled = true;
      b.style.cursor = 'default';
    });

    const q       = this.questions[this.current];
    const correct = idx === q.ans;
    this.answers.push({ q: this.current, chosen: idx, correct });
    if (correct) this.score++;

    // Highlight answer
    this._optsEl.querySelectorAll('.quiz-option').forEach((b, i) => {
      if (i === q.ans) b.classList.add('correct');
      else if (i === idx && !correct) b.classList.add('wrong');
    });

    // Show feedback
    this._feedEl.className = correct ? 'correct' : 'wrong';
    this._feedEl.innerHTML = `
      <strong>${correct ? '✅ Benar!' : '❌ Kurang tepat.'}</strong><br>
      ${q.explain}`;
    this._feedEl.classList.remove('hidden');

    const isLast = this.current === this.questions.length - 1;
    (isLast ? this._submitBtn : this._nextBtn).classList.remove('hidden');
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
