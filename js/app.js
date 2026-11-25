/**
 * ==========================================================================
 * XIE XE HAT - CORE APPLICATION STORE, AUTH, ANALYTICS & N8N WEBHOOK ENGINE
 * End-to-End Dynamic State (LocalStorage Multi-Account + InfinityFree PHP API)
 * ==========================================================================
 */

const STORAGE_KEY = 'xiexehat_store_v2';
const API_URL = 'api.php';
const WEBHOOK_PROXY_URL = 'webhook-proxy.php';
// Harus sama persis dengan konstanta WEBHOOK_SECRET di webhook-proxy.php
const CLIENT_HMAC_SECRET = 'GANTI_DENGAN_SECRET_ACAK_MIN_32_KARAKTER';
const WEBHOOK_COOLDOWN_MS = 60000; // Rate-limit client-side: 60 detik per akun

/**
 * Katalog Lengkap 6 Dimensi Kesehatan Organisasi (Standar HSE)
 * Digunakan secara dinamis oleh dashboard.html, enam-faktor.html, dan rekomendasi.html
 */
const FACTOR_CATALOG = [
    {
        key: 'demands',
        number: 1,
        label: 'Tuntutan Tugas (Demands)',
        shortLabel: 'Tuntutan Tugas',
        badgeText: 'Beban & Waktu',
        badgeClass: 'badge-primary',
        color: '#114B5F',
        description: 'Mengukur beban kerja fisik dan mental, batasan tenggat waktu (deadline), jam kerja lembur, serta kelayakan lingkungan fisik operasional.',
        indicator: 'Kapasitas kerja harian & pola istirahat.',
        improvementDesc: 'Terindikasi beban tugas harian, ritme kerja, atau tenggat waktu mulai menekan kapasitas normal karyawan sehingga berisiko memicu kelelahan.',
        improvementActions: [
            'Lakukan audit distribusi jam kerja dan kurangi lembur berulang pada posisi padat.',
            'Tetapkan skala prioritas tugas harian agar target deadline lebih realistis.',
            'Jadwalkan jeda istirahat singkat di tengah jam sibuk operasional.'
        ],
        maintenanceDesc: 'Beban kerja dan ritme penyelesaian tugas berada pada porsi yang seimbang dengan kapasitas tim.',
        maintenanceActions: [
            'Pertahankan sistem pembagian shift dan estimasi waktu pengerjaan saat ini.',
            'Pantau lonjakan order musiman agar penambahan tenaga paruh waktu tepat waktu.',
            'Evaluasi beban kerja secara berkala setiap awal bulan.'
        ],
        roadmapInitiative: 'Audit Beban Kerja & Penyesuaian Jadwal Shift',
        roadmapOwner: 'Supervisor / Pemilik Usaha'
    },
    {
        key: 'control',
        number: 2,
        label: 'Kendali Kerja (Control)',
        shortLabel: 'Kendali Kerja',
        badgeText: 'Otonomi',
        badgeClass: 'badge-sage',
        color: '#4E9F3D',
        description: 'Tingkat otonomi dan kebebasan yang dimiliki karyawan dalam menentukan metode kerja, urutan prioritas, dan inisiatif pemecahan masalah.',
        indicator: 'Otonomi operasional & delegasi wewenang.',
        improvementDesc: 'Karyawan merasa ruang gerak atau keleluasaan dalam mengambil keputusan teknis sehari-hari masih terlalu terbatas.',
        improvementActions: [
            'Berikan delegasi wewenang yang jelas untuk keputusan operasional harian.',
            'Libatkan staf dalam menyusun cara kerja yang paling efisien di divisinya.',
            'Kurangi micromanagement dan fokus pada hasil akhir yang disepakati.'
        ],
        maintenanceDesc: 'Tim memiliki otonomi dan kepercayaan yang baik dalam mengatur ritme serta metode kerjanya.',
        maintenanceActions: [
            'Terus dorong inisiatif perbaikan proses kerja dari karyawan lini depan.',
            'Dokumentasikan praktik terbaik hasil inisiatif tim sebagai panduan bersama.',
            'Berikan ruang eksplorasi ide baru pada rapat evaluasi bulanan.'
        ],
        roadmapInitiative: 'Pemberian Delegasi Wewenang & Otonomi Teknis',
        roadmapOwner: 'Pemilik Usaha'
    },
    {
        key: 'managerSupport',
        number: 3,
        label: 'Dukungan Atasan (Manager Support)',
        shortLabel: 'Dukungan Atasan',
        badgeText: 'Kepemimpinan',
        badgeClass: 'badge-cyan',
        color: '#0284C7',
        description: 'Ketersediaan bimbingan langsung, umpan balik yang membangun, kepedulian atas kesejahteraan staf, dan keterbukaan komunikasi pimpinan.',
        indicator: 'Kepemimpinan empatik & mentoring rutin.',
        improvementDesc: 'Karyawan membutuhkan arahan yang lebih konsisten, umpan balik konstruktif, dan perhatian lebih dari pimpinan saat menghadapi kendala.',
        improvementActions: [
            'Jadwalkan sesi bimbingan singkat (one-on-one) minimal 1 kali sebulan per staf.',
            'Berikan umpan balik spesifik disertai apresiasi atas pencapaian kerja tim.',
            'Sediakan waktu khusus untuk mendengarkan kendala operasional dari karyawan.'
        ],
        maintenanceDesc: 'Pimpinan dinilai hadir, suportif, dan mampu memberikan arahan serta motivasi yang jelas bagi tim.',
        maintenanceActions: [
            'Pertahankan pola komunikasi terbuka dan responsif terhadap kendala lapangan.',
            'Jadwalkan sesi coaching rutin untuk pengembangan kapasitas staf potensial.',
            'Jaga konsistensi apresiasi baik secara lisan maupun penghargaan kinerja.'
        ],
        roadmapInitiative: 'Penyusunan Jadwal Coaching & Feedback One-on-One',
        roadmapOwner: 'Pemilik Usaha / Manajer'
    },
    {
        key: 'peerSupport',
        number: 4,
        label: 'Dukungan Rekan (Peer Support)',
        shortLabel: 'Dukungan Rekan',
        badgeText: 'Sinergi Tim',
        badgeClass: 'badge-primary',
        color: '#185C74',
        description: 'Kekompakan tim, solidaritas rekan sejawat, dan kesiapan saling membantu saat rekan lain mengalami lonjakan beban tugas mendesak.',
        indicator: 'Solidaritas tim & keterbukaan koordinasi.',
        improvementDesc: 'Koordinasi dan kesediaan saling membantu antar rekan kerja masih belum merata saat terjadi lonjakan pekerjaan.',
        improvementActions: [
            'Terapkan mekanisme cross-training agar staf dapat saling mem-backup saat sibuk.',
            'Adakan briefing pagi singkat (5–10 menit) untuk menyelaraskan bantuan antar bagian.',
            'Bangun budaya kerja kolaboratif melalui target tim bersama.'
        ],
        maintenanceDesc: 'Solidaritas dan kerja sama antar rekan kerja terjalin erat sehingga hambatan tugas cepat teratasi.',
        maintenanceActions: [
            'Pertahankan budaya saling bantu dan briefing koordinasi harian.',
            'Adakan kegiatan kebersamaan tim secara berkala untuk menjaga kekompakan.',
            'Libatkan tim senior untuk membimbing karyawan baru agar cepat beradaptasi.'
        ],
        roadmapInitiative: 'Briefing Koordinasi Harian & Cross-Training Tim',
        roadmapOwner: 'Koordinator Lapangan'
    },
    {
        key: 'relationships',
        number: 5,
        label: 'Hubungan Interpersonal (Relationships)',
        shortLabel: 'Relasi Rekan',
        badgeText: 'Relasi Kerja',
        badgeClass: 'badge-sage',
        color: '#D97706',
        description: 'Terbebasnya lingkungan kerja dari perpecahan internal, saling menjatuhkan, bullying, serta terjaganya suasana saling menghargai.',
        indicator: 'Mitigasi friksi personal & etika kerja.',
        improvementDesc: 'Terindikasi adanya gesekan komunikasi atau rasa kurang nyaman dalam interaksi antar individu yang dapat memicu salah paham operasional.',
        improvementActions: [
            'Agendakan sesi dialog santai (coffee morning) untuk mencairkan komunikasi tim.',
            'Terapkan kesepakatan etika komunikasi kerja yang saling menghormati.',
            'Sediakan jalur penyampaian keluhan tertutup langsung kepada pemilik UMKM.'
        ],
        maintenanceDesc: 'Iklim komunikasi di tempat kerja harmonis, sehat, dan bebas dari konflik interpersonal yang mengganggu.',
        maintenanceActions: [
            'Jaga keterbukaan dan keadilan dalam menyelesaikan setiap perbedaan pendapat.',
            'Pertahankan norma saling menghargai lintas posisi dan masa kerja.',
            'Lakukan pengecekan iklim tim secara berkala lewat survei anonim.'
        ],
        roadmapInitiative: 'Sesi Sharing Tim & Penguatan Etika Komunikasi',
        roadmapOwner: 'Pemilik Usaha'
    },
    {
        key: 'roleClarity',
        number: 6,
        label: 'Kejelasan Peran (Role Clarity)',
        shortLabel: 'Kejelasan Peran',
        badgeText: 'Struktur',
        badgeClass: 'badge-cyan',
        color: '#10B981',
        description: 'Pemahaman pasti karyawan atas tugas pokok, batasan wewenang, target hasil kerja, serta keselarasan dengan tujuan bisnis UMKM.',
        indicator: 'Job description transparan & target terukur.',
        improvementDesc: 'Masih terdapat tumpang tindih tanggung jawab atau ketidakjelasan target hasil kerja yang diharapkan pada beberapa peran.',
        improvementActions: [
            'Susun dan bagikan deskripsi tugas (Job Description) tertulis yang ringkas untuk tiap posisi.',
            'Perjelas batas wewenang dan alur pelaporan jika terjadi masalah di lapangan.',
            'Samakan pemahaman target harian/mingguan pada setiap pergantian shift.'
        ],
        maintenanceDesc: 'Setiap anggota tim memahami dengan sangat baik tugas harian, target keluaran, dan batasan tanggung jawabnya.',
        maintenanceActions: [
            'Dokumentasikan Standard Operating Procedure (SOP) tertulis agar tetap konsisten.',
            'Jadikan kejelasan peran saat ini sebagai acuan onboarding karyawan baru.',
            'Tinjau ulang job description setiap kali ada penambahan lini layanan atau cabang.'
        ],
        roadmapInitiative: 'Pembaruan Dokumen SOP & Job Description Tertulis',
        roadmapOwner: 'Pemilik Usaha & Admin'
    }
];

/**
 * Factory Data Awal untuk Akun Demo Default
 */
function createDefaultStore() {
    const demoSubmissions = [
        {
            id: 101,
            respondentName: 'Ahmad Fauzi',
            respondentRole: 'Barista / Operasional',
            umkmName: 'Kopi Kenangan Sehat',
            submittedAt: '2026-11-04T09:15:00+07:00',
            rawRatings: { demands: 4, control: 4, managerSupport: 5, peerSupport: 4, relationships: 4, roleClarity: 5 },
            scores: { demands: 80, control: 80, managerSupport: 100, peerSupport: 80, relationships: 80, roleClarity: 100 }
        },
        {
            id: 102,
            respondentName: 'Siti Rahmawati',
            respondentRole: 'Kasir & Admin',
            umkmName: 'Kopi Kenangan Sehat',
            submittedAt: '2026-11-04T14:30:00+07:00',
            rawRatings: { demands: 4, control: 5, managerSupport: 4, peerSupport: 5, relationships: 4, roleClarity: 4 },
            scores: { demands: 80, control: 100, managerSupport: 80, peerSupport: 100, relationships: 80, roleClarity: 80 }
        },
        {
            id: 103,
            respondentName: 'Dewi Lestari',
            respondentRole: 'Dapur & Logistik',
            umkmName: 'Kopi Kenangan Sehat',
            submittedAt: '2026-11-05T10:20:00+07:00',
            rawRatings: { demands: 4, control: 4, managerSupport: 5, peerSupport: 4, relationships: 3, roleClarity: 5 },
            scores: { demands: 80, control: 80, managerSupport: 100, peerSupport: 80, relationships: 60, roleClarity: 100 }
        }
    ];

    return {
        currentSessionEmail: 'owner@tokosehat.id',
        lastWebhookSentAt: {},
        accounts: {
            'owner@tokosehat.id': {
                user: {
                    name: 'Budi Santoso',
                    email: 'owner@tokosehat.id',
                    role: 'owner',
                    umkm: 'Kopi Kenangan Sehat'
                },
                assessmentSubmissions: demoSubmissions,
                umkmList: [
                    { id: 1, name: 'Kopi Kenangan Sehat', sektor: 'F&B', karyawanCount: 4, skor: 84 },
                    { id: 2, name: 'Batik Lestari Mandiri', sektor: 'Kriya & Tekstil', karyawanCount: 14, skor: 79 },
                    { id: 3, name: 'Catering Berkah Rasa', sektor: 'Kuliner', karyawanCount: 6, skor: 91 }
                ],
                employees: [
                    { id: 1, name: 'Ahmad Fauzi', role: 'Barista / Operasional', status: 'Selesai', date: '04 Nov 2026' },
                    { id: 2, name: 'Siti Rahmawati', role: 'Kasir & Admin', status: 'Selesai', date: '04 Nov 2026' },
                    { id: 3, name: 'Dewi Lestari', role: 'Dapur & Logistik', status: 'Selesai', date: '05 Nov 2026' },
                    { id: 4, name: 'Rian Pratama', role: 'Staff Operasional', status: 'Menunggu', date: '-' }
                ]
            }
        }
    };
}

/**
 * UI Helper (Toast Notifications, Formatting, Sidebar Sync)
 */
const UI = {
    getInitials(name) {
        if (!name || typeof name !== 'string') return 'XX';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    formatDateID(isoStr) {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            return d.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return '-';
        }
    },

    escapeHTML(str) {
        return String(str ?? '').replace(/[&<>"'`]/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '`': '&#96;'
        }[ch]));
    },

    showToast(title, message, type = 'info') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const iconEl = document.createElement('div');
        iconEl.style.cssText = 'font-size: 16px; line-height: 1.2;';
        iconEl.textContent = icons[type] || icons.info;

        const bodyEl = document.createElement('div');
        bodyEl.style.flex = '1';

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-weight: 700; color: var(--text-heading); margin-bottom: 2px;';
        titleEl.textContent = title;

        const msgEl = document.createElement('div');
        msgEl.style.cssText = 'font-size: 12px; color: var(--text-muted); line-height: 1.4;';
        msgEl.textContent = message;

        bodyEl.appendChild(titleEl);
        bodyEl.appendChild(msgEl);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text-subtle);font-size:14px;';
        closeBtn.addEventListener('click', () => toast.remove());

        toast.appendChild(iconEl);
        toast.appendChild(bodyEl);
        toast.appendChild(closeBtn);

        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(8px)';
                toast.style.transition = 'all 0.2s ease';
                setTimeout(() => toast.remove(), 220);
            }
        }, 4500);
    },

    syncSidebarProfile() {
        const account = Store.getActiveAccount();
        if (!account) return;

        const user = account.user;
        const userNameEl = document.getElementById('userName');
        const userRoleEl = document.getElementById('userRole');
        const avatarEls = document.querySelectorAll('.user-avatar');

        if (userNameEl) userNameEl.textContent = user.name || 'Pengguna';
        if (userRoleEl) {
            userRoleEl.textContent = user.role === 'owner' ? 'Pemilik UMKM' : 'Karyawan';
        }
        const initials = this.getInitials(user.name);
        avatarEls.forEach(el => {
            el.textContent = initials;
        });
    }
};

/**
 * Store Manager: Mengelola State Multi-Akun, Akumulasi Skor Real-Time, API PHP & Webhook n8n
 */
const Store = {
    getStore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                const initial = createDefaultStore();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
                return initial;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.accounts) {
                const initial = createDefaultStore();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
                return initial;
            }
            return parsed;
        } catch (e) {
            return createDefaultStore();
        }
    },

    saveStore(store) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    },

    getActiveEmail() {
        const store = this.getStore();
        return store.currentSessionEmail;
    },

    getActiveAccount() {
        const store = this.getStore();
        const email = store.currentSessionEmail;
        if (email && store.accounts[email]) {
            return store.accounts[email];
        }
        // Jika belum login, kembalikan null (atau di halaman internal kita cek session)
        return null;
    },

    updateActiveAccount(updaterFn) {
        const store = this.getStore();
        const email = store.currentSessionEmail;
        if (!email || !store.accounts[email]) return null;
        updaterFn(store.accounts[email], store);
        this.saveStore(store);
        return store.accounts[email];
    },

    /**
     * Menghitung Skor Akumulasi 6 Faktor secara Real-Time dari seluruh pengisian kuesioner akun aktif
     */
    getAccumulatedScores() {
        const account = this.getActiveAccount();
        const zeroScores = {
            demands: 0,
            control: 0,
            managerSupport: 0,
            peerSupport: 0,
            relationships: 0,
            roleClarity: 0
        };

        if (!account || !Array.isArray(account.assessmentSubmissions) || account.assessmentSubmissions.length === 0) {
            return zeroScores;
        }

        const submissions = account.assessmentSubmissions;
        const count = submissions.length;
        const totals = { ...zeroScores };

        submissions.forEach(sub => {
            const sc = sub.scores || {};
            FACTOR_CATALOG.forEach(f => {
                totals[f.key] += Number(sc[f.key] || 0);
            });
        });

        const averages = {};
        FACTOR_CATALOG.forEach(f => {
            averages[f.key] = Math.round(totals[f.key] / count);
        });
        return averages;
    },

    getOverallScore() {
        const account = this.getActiveAccount();
        if (!account || !account.assessmentSubmissions || account.assessmentSubmissions.length === 0) {
            return 0;
        }
        const scores = this.getAccumulatedScores();
        const vals = Object.values(scores);
        const sum = vals.reduce((a, b) => a + b, 0);
        return Math.round(sum / vals.length);
    },

    getHealthCategory(score) {
        const account = this.getActiveAccount();
        const hasSubmissions = account && account.assessmentSubmissions && account.assessmentSubmissions.length > 0;
        if (!hasSubmissions) {
            return {
                label: 'Belum Ada Data',
                riskLabel: 'Belum Terukur',
                class: 'badge-primary',
                color: '#64748B',
                summaryTitle: 'Belum Ada Data Asesmen Terkumpul',
                summaryDesc: 'Silakan isi kuesioner asesmen organisasi terlebih dahulu untuk memulai diagnosis kesehatan tim Anda.'
            };
        }
        if (score >= 80) {
            return {
                label: 'Sangat Sehat',
                riskLabel: 'Rendah',
                class: 'badge-sage',
                color: '#10B981',
                summaryTitle: 'Kondisi Psikososial Tim Berada Pada Tingkat Optimal',
                summaryDesc: 'Mayoritas dimensi kesehatan organisasi berada di zona hijau. Pertahankan komunikasi terbuka dan lakukan pemantauan berkala.'
            };
        }
        if (score >= 65) {
            return {
                label: 'Cukup Sehat / Waspada',
                riskLabel: 'Sedang',
                class: 'badge-cyan',
                color: '#0284C7',
                summaryTitle: 'Organisasi Stabil Namun Memerlukan Perhatian Terarah',
                summaryDesc: 'Beberapa indikator menunjukkan tekanan kerja ringan hingga sedang. Prioritaskan perbaikan pada dimensi dengan skor terendah.'
            };
        }
        return {
            label: 'Perlu Intervensi',
            riskLabel: 'Tinggi',
            class: 'badge-danger',
            color: '#EF4444',
            summaryTitle: 'Terdeteksi Risiko Stres & Ketidakseimbangan Organisasi',
            summaryDesc: 'Segera jalankan rencana intervensi 30 hari pada dimensi prioritas untuk mencegah penurunan produktivitas dan turnover karyawan.'
        };
    },

    /**
     * Analisis Komprehensif Faktor Tertinggi, Terendah, dan Urutan Prioritas
     */
    getFactorAnalysis() {
        const scores = this.getAccumulatedScores();
        const overall = this.getOverallScore();
        const category = this.getHealthCategory(overall);

        const enriched = FACTOR_CATALOG.map(meta => ({
            ...meta,
            score: scores[meta.key] ?? 0
        }));

        const sortedAsc = [...enriched].sort((a, b) => a.score - b.score);
        const sortedDesc = [...enriched].sort((a, b) => b.score - a.score);

        return {
            overall,
            category,
            scores,
            factors: enriched,
            sortedAsc,
            sortedDesc,
            lowest: sortedAsc[0],
            highest: sortedDesc[0]
        };
    },

    getParticipationStats() {
        const account = this.getActiveAccount();
        if (!account) {
            return { totalEmployees: 0, completedEmployees: 0, totalSubmissions: 0, rate: 0, latestDate: '-' };
        }
        const employees = account.employees || [];
        const submissions = account.assessmentSubmissions || [];
        const totalEmployees = employees.length;
        const completedEmployees = employees.filter(e => e.status === 'Selesai').length;
        const rate = totalEmployees > 0
            ? Math.min(100, Math.round((completedEmployees / totalEmployees) * 100))
            : (submissions.length > 0 ? 100 : 0);

        const latestSub = submissions.length > 0 ? submissions[submissions.length - 1] : null;
        const latestDate = latestSub ? UI.formatDateID(latestSub.submittedAt) : 'Belum ada';

        return {
            totalEmployees,
            completedEmployees,
            totalSubmissions: submissions.length,
            rate,
            latestDate
        };
    },

    // Kompatibilitas backward agar halaman yang memanggil Store.get() tetap lancar
    get() {
        const account = this.getActiveAccount();
        if (!account) {
            return {
                user: { name: 'Tamu', email: '', role: 'owner', umkm: '-' },
                scores: this.getAccumulatedScores(),
                umkmList: [],
                employees: [],
                assessmentSubmissions: []
            };
        }
        return {
            ...account,
            scores: this.getAccumulatedScores()
        };
    },

    // ================= AUTHENTICATION =================
    async registerAccount({ name, email, umkm, role, password }) {
        const normalizedEmail = email.trim().toLowerCase();
        const store = this.getStore();

        const newAccount = {
            user: {
                name: name.trim(),
                email: normalizedEmail,
                role: role || 'owner',
                umkm: umkm.trim()
            },
            assessmentSubmissions: [],
            umkmList: [
                { id: 1, name: umkm.trim(), sektor: 'Umum', karyawanCount: 1, skor: 0 }
            ],
            employees: [
                { id: 1, name: name.trim(), role: role === 'owner' ? 'Pemilik / Manajemen' : 'Karyawan', status: 'Menunggu', date: '-' }
            ]
        };

        store.accounts[normalizedEmail] = newAccount;
        store.currentSessionEmail = normalizedEmail;
        this.saveStore(store);

        // Kirim ke endpoint register (password di-hash dengan password_hash() di server)
        await this.postToApi('register', {
            ...newAccount.user,
            password: password || 'password123'
        });
        return newAccount;
    },

    async loginAccount(emailInput, passwordInput) {
        const normalizedEmail = (emailInput || '').trim().toLowerCase();
        const store = this.getStore();

        // Verifikasi dengan backend PHP jika tersedia
        const apiRes = await this.postToApi('login', {
            email: normalizedEmail,
            password: passwordInput || ''
        });

        let account = store.accounts[normalizedEmail];
        if (apiRes && apiRes.success && apiRes.user) {
            if (!account) {
                account = {
                    user: apiRes.user,
                    assessmentSubmissions: [],
                    umkmList: [
                        { id: 1, name: apiRes.user.umkm || 'UMKM Utama', sektor: 'Umum', karyawanCount: 1, skor: 0 }
                    ],
                    employees: []
                };
            } else {
                account.user = { ...account.user, ...apiRes.user };
                delete account.user.password;
            }
            store.accounts[normalizedEmail] = account;
        } else if (!account) {
            // Fallback mode demo offline (tanpa menyimpan plaintext password di localStorage)
            account = {
                user: {
                    name: normalizedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Pengguna',
                    email: normalizedEmail,
                    role: 'owner',
                    umkm: 'UMKM ' + (normalizedEmail.split('@')[0] || 'Mandiri').toUpperCase()
                },
                assessmentSubmissions: [],
                umkmList: [
                    { id: 1, name: 'UMKM ' + (normalizedEmail.split('@')[0] || 'Mandiri').toUpperCase(), sektor: 'Umum', karyawanCount: 1, skor: 0 }
                ],
                employees: []
            };
            store.accounts[normalizedEmail] = account;
        }

        store.currentSessionEmail = normalizedEmail;
        this.saveStore(store);
        return account;
    },

    logout() {
        const store = this.getStore();
        store.currentSessionEmail = null;
        this.saveStore(store);
    },

    requireAuth() {
        const account = this.getActiveAccount();
        if (!account) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    // ================= ASSESSMENT SUBMISSION & ACCUMULATION =================
    async submitAssessment({ respondentName, respondentRole, umkmName, rawRatings }) {
        const nowIso = new Date().toISOString();
        const todayText = UI.formatDateID(nowIso);

        const scores = {
            demands: Math.round((Number(rawRatings.demands) / 5) * 100),
            control: Math.round((Number(rawRatings.control) / 5) * 100),
            managerSupport: Math.round((Number(rawRatings.managerSupport) / 5) * 100),
            peerSupport: Math.round((Number(rawRatings.peerSupport) / 5) * 100),
            relationships: Math.round((Number(rawRatings.relationships) / 5) * 100),
            roleClarity: Math.round((Number(rawRatings.roleClarity) / 5) * 100)
        };

        let createdSubmission = null;
        this.updateActiveAccount(account => {
            if (!Array.isArray(account.assessmentSubmissions)) {
                account.assessmentSubmissions = [];
            }
            createdSubmission = {
                id: Date.now(),
                respondentName: respondentName || account.user.name,
                respondentRole: respondentRole || (account.user.role === 'owner' ? 'Pemilik UMKM' : 'Karyawan'),
                umkmName: umkmName || account.user.umkm,
                submittedAt: nowIso,
                rawRatings,
                scores
            };
            account.assessmentSubmissions.push(createdSubmission);

            // Sinkronkan status karyawan jika nama responden cocok atau tambahkan jika belum ada
            if (!Array.isArray(account.employees)) account.employees = [];
            const matchEmp = account.employees.find(
                e => e.name.trim().toLowerCase() === createdSubmission.respondentName.trim().toLowerCase()
            );
            if (matchEmp) {
                matchEmp.status = 'Selesai';
                matchEmp.date = todayText;
            } else {
                const nextEmpId = account.employees.length > 0
                    ? Math.max(...account.employees.map(e => Number(e.id) || 0)) + 1
                    : 1;
                account.employees.push({
                    id: nextEmpId,
                    name: createdSubmission.respondentName,
                    role: createdSubmission.respondentRole,
                    status: 'Selesai',
                    date: todayText
                });
            }
        });

        // Hitung ulang skor akumulasi terbaru dan perbarui skor UMKM terkait
        const newAccumulated = this.getAccumulatedScores();
        const newOverall = this.getOverallScore();
        this.updateActiveAccount(account => {
            if (Array.isArray(account.umkmList)) {
                const targetUmkm = account.umkmList.find(
                    u => u.name.trim().toLowerCase() === (umkmName || account.user.umkm).trim().toLowerCase()
                ) || account.umkmList[0];
                if (targetUmkm) {
                    targetUmkm.skor = newOverall;
                    targetUmkm.karyawanCount = Math.max(targetUmkm.karyawanCount || 0, (account.employees || []).length);
                }
            }
        });

        // Sinkron ke PHP/MySQL InfinityFree
        const account = this.getActiveAccount();
        await this.postToApi('save_assessment', {
            ...newAccumulated,
            email: account?.user?.email || '',
            umkmName: createdSubmission?.umkmName || '',
            respondentName: createdSubmission?.respondentName || ''
        });

        // Kirim Outbound Webhook ke n8n
        const webhookResult = await this.sendN8nWebhook('assessment_submitted', createdSubmission);

        return {
            submission: createdSubmission,
            accumulatedScores: newAccumulated,
            overallScore: newOverall,
            webhookResult
        };
    },

    // ================= UMKM & EMPLOYEE CRUD =================
    async saveUmkm(umkm) {
        let newUmkm = null;
        this.updateActiveAccount(account => {
            if (!Array.isArray(account.umkmList)) account.umkmList = [];
            const nextId = account.umkmList.length > 0
                ? Math.max(...account.umkmList.map(u => Number(u.id) || 0)) + 1
                : 1;
            newUmkm = {
                id: nextId,
                name: umkm.name,
                sektor: umkm.sektor,
                karyawanCount: Number(umkm.karyawanCount) || 1,
                skor: Number(umkm.skor ?? this.getOverallScore())
            };
            account.umkmList.push(newUmkm);
        });

        await this.postToApi('save_umkm', newUmkm);
        return newUmkm;
    },

    async deleteUmkm(id) {
        this.updateActiveAccount(account => {
            account.umkmList = (account.umkmList || []).filter(u => Number(u.id) !== Number(id));
        });
        await this.postToApi('delete_umkm', { id });
    },

    async saveEmployee(emp) {
        let newEmp = null;
        this.updateActiveAccount(account => {
            if (!Array.isArray(account.employees)) account.employees = [];
            const nextId = account.employees.length > 0
                ? Math.max(...account.employees.map(e => Number(e.id) || 0)) + 1
                : 1;
            newEmp = {
                id: nextId,
                name: emp.name,
                role: emp.role,
                status: 'Menunggu',
                date: '-'
            };
            account.employees.push(newEmp);
        });

        await this.postToApi('save_employee', newEmp);
        return newEmp;
    },

    async deleteEmployee(id) {
        this.updateActiveAccount(account => {
            account.employees = (account.employees || []).filter(e => Number(e.id) !== Number(id));
        });
        await this.postToApi('delete_employee', { id });
    },

    // ================= BACKEND PHP / MYSQL SYNC =================
    async postToApi(action, payload) {
        try {
            const activeEmail = this.getActiveEmail() || payload?.email || '';
            const enrichedPayload = {
                ...(payload || {}),
                ownerEmail: payload?.ownerEmail || activeEmail
            };
            const res = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enrichedPayload)
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) return data;
            return data;
        } catch (err) {
            return null;
        }
    },

    async syncWithBackend() {
        const account = this.getActiveAccount();
        if (!account) return null;

        try {
            const emailParam = encodeURIComponent(account.user.email || '');
            const res = await fetch(`${API_URL}?action=get_all&email=${emailParam}`);
            if (!res.ok) return account;
            const result = await res.json();
            if (result.success && result.data) {
                this.updateActiveAccount(acc => {
                    if (Array.isArray(result.data.umkmList) && result.data.umkmList.length > 0) {
                        acc.umkmList = result.data.umkmList;
                    }
                    if (Array.isArray(result.data.employees) && result.data.employees.length > 0) {
                        acc.employees = result.data.employees;
                    }
                    if (Array.isArray(result.data.assessmentSubmissions) && result.data.assessmentSubmissions.length > 0) {
                        acc.assessmentSubmissions = result.data.assessmentSubmissions;
                    }
                });
            }
        } catch (err) {
            // Mode offline / file:// — tetap gunakan LocalStorage
        }
        return this.getActiveAccount();
    },

    // ================= OUTBOUND WEBHOOK N8N (VIA PHP PROXY + HMAC) =================
    async computeHmacSha256(secret, message) {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('Web Crypto API tidak tersedia (pastikan menggunakan HTTPS atau localhost).');
        }
        const enc = new TextEncoder();
        const key = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(message));
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    getWebhookCooldownRemainingMs(email) {
        const store = this.getStore();
        const lastMap = store.lastWebhookSentAt || {};
        const lastTs = Number(lastMap[email] || 0);
        if (!lastTs) return 0;
        const elapsed = Date.now() - lastTs;
        return elapsed < WEBHOOK_COOLDOWN_MS ? (WEBHOOK_COOLDOWN_MS - elapsed) : 0;
    },

    recordWebhookSent(email) {
        const store = this.getStore();
        if (!store.lastWebhookSentAt) store.lastWebhookSentAt = {};
        store.lastWebhookSentAt[email] = Date.now();
        this.saveStore(store);
    },

    /**
     * Mengirim payload JSON ke webhook-proxy.php (server-side relay ke n8n).
     * URL asli Webhook n8n tidak pernah terekspos di browser.
     */
    async sendN8nWebhook(eventType = 'assessment_submitted', latestSubmission = null) {
        const account = this.getActiveAccount();
        if (!account) return { sent: false, reason: 'no_session' };

        const email = (account.user.email || '').trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            UI.showToast('Email Tidak Valid', 'Format email pemilik akun tidak valid untuk pengiriman laporan.', 'error');
            return { sent: false, reason: 'invalid_email' };
        }

        // Client-side rate limit check (anti-spam saat refresh / double-click)
        const remainingMs = this.getWebhookCooldownRemainingMs(email);
        if (remainingMs > 0) {
            const waitSec = Math.ceil(remainingMs / 1000);
            UI.showToast(
                'Batas Pengiriman Aktif',
                `Tunggu ${waitSec} detik sebelum memicu notifikasi Webhook n8n kembali.`,
                'warning'
            );
            return { sent: false, reason: 'rate_limited_client', waitSec };
        }

        const analysis = this.getFactorAnalysis();
        if (typeof analysis.overall !== 'number' || analysis.overall < 0 || analysis.overall > 100) {
            UI.showToast('Payload Tidak Valid', 'Skor keseluruhan berada di luar rentang 0-100.', 'error');
            return { sent: false, reason: 'invalid_score' };
        }

        const stats = this.getParticipationStats();
        const payload = {
            platform: 'Xie Xe Hat',
            event: eventType,
            timestamp: new Date().toISOString(),
            umkm: {
                name: account.user.umkm,
                total_umkm_units: (account.umkmList || []).length,
                total_employees: stats.totalEmployees,
                total_submissions: stats.totalSubmissions,
                participation_rate_percent: stats.rate
            },
            owner: {
                name: account.user.name,
                email: email,
                role: account.user.role
            },
            assessment_summary: {
                overall_score: analysis.overall,
                category: analysis.category.label,
                risk_level: analysis.category.riskLabel,
                highest_factor: {
                    name: analysis.highest.label,
                    score: analysis.highest.score
                },
                lowest_factor: {
                    name: analysis.lowest.label,
                    score: analysis.lowest.score
                }
            },
            six_factors: analysis.scores,
            latest_submission: latestSubmission
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const ts = Math.floor(Date.now() / 1000).toString();
            const rawBody = JSON.stringify(payload);
            const sig = await this.computeHmacSha256(CLIENT_HMAC_SECRET, `${ts}.${rawBody}`);

            const response = await fetch(WEBHOOK_PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XXH-Timestamp': ts,
                    'X-XXH-Signature': sig
                },
                body: rawBody,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const resData = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(resData.message || resData.error || `HTTP ${response.status}`);
            }

            this.recordWebhookSent(email);
            UI.showToast(
                'Terkirim Aman ke n8n',
                `Payload (${analysis.overall}%) untuk ${account.user.umkm} berhasil diteruskan via proxy.`,
                'success'
            );
            return { sent: true, status: response.status, payload };
        } catch (error) {
            clearTimeout(timeoutId);
            const errMsg = error.name === 'AbortError'
                ? 'Koneksi ke proxy webhook timeout (>10 detik).'
                : `Gagal mengirim via proxy (${error.message}).`;

            UI.showToast('Gagal Mengirim Webhook', errMsg, 'error');
            return { sent: false, reason: 'network_error', error: error.message };
        }
    }
};

// Authentication Handlers untuk login.html & register.html
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    await Store.loginAccount(email, password);
    window.location.href = 'dashboard.html';
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const umkm = document.getElementById('umkm').value.trim();
    const password = document.getElementById('password').value;
    const role = document.querySelector('input[name="role"]:checked')?.value || 'owner';

    await Store.registerAccount({ name, email, umkm, role, password });
    window.location.href = 'dashboard.html';
}

function handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar dari sesi akun ini?')) {
        Store.logout();
        window.location.href = 'login.html';
    }
}

// Global Initialization pada setiap halaman
document.addEventListener('DOMContentLoaded', () => {
    const isAuthPage = /\/(index|login|register)\.html$/i.test(window.location.pathname) ||
        window.location.pathname.endsWith('/');

    if (!isAuthPage) {
        if (!Store.requireAuth()) return;
    }

    UI.syncSidebarProfile();
});
