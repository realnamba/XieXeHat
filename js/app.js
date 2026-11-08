/**
 * XIE XE HAT - CLIENT-SIDE CONTROLLER & DATABASE BRIDGE
 * Mendukung sinkronisasi otomatis ke endpoint PHP MySQL InfinityFree
 * dengan fallback offline LocalStorage jika server belum aktif.
 */

const STORAGE_KEY = 'xiexepat_data_v1';
const API_URL = 'api.php'; // Terhubung langsung ke endpoint PHP di InfinityFree

const defaultData = {
    user: {
        name: 'Budi Santoso',
        email: 'owner@tokosehat.id',
        role: 'owner',
        umkm: 'Kopi Kenangan Sehat'
    },
    scores: {
        demands: 82,      // 1. Tuntutan Tugas
        control: 88,      // 2. Kendali Kerja
        managerSupport: 90, // 3. Dukungan Atasan
        peerSupport: 85,  // 4. Dukungan Rekan
        relationships: 78,// 5. Hubungan Interpersonal
        roleClarity: 92   // 6. Kejelasan Peran
    },
    umkmList: [
        { id: 1, name: 'Kopi Kenangan Sehat', sektor: 'F&B', karyawanCount: 8, skor: 86 },
        { id: 2, name: 'Batik Lestari Mandiri', sektor: 'Kriya & Tekstil', karyawanCount: 14, skor: 79 },
        { id: 3, name: 'Catering Berkah Rasa', sektor: 'Kuliner', karyawanCount: 6, skor: 91 }
    ],
    employees: [
        { id: 1, name: 'Ahmad Fauzi', role: 'Barista / Operasional', status: 'Selesai', date: '04 Nov 2026' },
        { id: 2, name: 'Siti Rahmawati', role: 'Kasir & Admin', status: 'Selesai', date: '04 Nov 2026' },
        { id: 3, name: 'Dewi Lestari', role: 'Dapur & Logistik', status: 'Selesai', date: '05 Nov 2026' },
        { id: 4, name: 'Rian Pratama', role: 'Staff Operasional', status: 'Menunggu', date: '-' }
    ]
};

// Store Manager (Hybrid: Sinkron MySQL + LocalStorage Cache)
const Store = {
    get() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : defaultData;
        } catch (e) {
            return defaultData;
        }
    },
    save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
    getOverallScore() {
        const s = this.get().scores;
        const vals = Object.values(s);
        const sum = vals.reduce((a, b) => a + b, 0);
        return Math.round(sum / vals.length);
    },
    getHealthCategory(score) {
        if (score >= 80) return { label: 'Sangat Sehat', class: 'badge-sage', color: '#10B981' };
        if (score >= 65) return { label: 'Cukup Sehat / Waspada', class: 'badge-cyan', color: '#0284C7' };
        return { label: 'Perlu Intervensi', class: 'badge-danger', color: '#EF4444' };
    },

    // 1. Sinkronisasi Data dari MySQL InfinityFree
    async syncWithBackend() {
        try {
            const res = await fetch(`${API_URL}?action=get_all`);
            const result = await res.json();
            if (result.success && result.data) {
                this.save(result.data);
                console.log('✓ Terhubung dan tersinkronisasi dengan Database MySQL InfinityFree');
                return result.data;
            }
        } catch (err) {
            console.log('Mode Offline / LocalStorage aktif (API belum diakses atau dibuka via file://)');
        }
        return this.get();
    },

    // 2. Simpan Asesmen ke MySQL
    async saveAssessment(scores) {
        const data = this.get();
        data.scores = scores;
        this.save(data);

        try {
            await fetch(`${API_URL}?action=save_assessment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scores)
            });
        } catch (err) {
            // Tetap tersimpan di localStorage
        }
    },

    // 3. Simpan UMKM ke MySQL
    async saveUmkm(umkm) {
        const data = this.get();
        const nextId = (data.umkmList?.length || 0) + 1;
        const newUmkm = { ...umkm, id: nextId };
        data.umkmList.push(newUmkm);
        this.save(data);

        try {
            await fetch(`${API_URL}?action=save_umkm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(umkm)
            });
        } catch (err) {}
    },

    // 4. Hapus UMKM dari MySQL
    async deleteUmkm(id) {
        const data = this.get();
        data.umkmList = data.umkmList.filter(u => u.id !== id);
        this.save(data);

        try {
            await fetch(`${API_URL}?action=delete_umkm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
        } catch (err) {}
    },

    // 5. Simpan Karyawan ke MySQL
    async saveEmployee(emp) {
        const data = this.get();
        const nextId = (data.employees?.length || 0) + 1;
        const newEmp = { ...emp, id: nextId, status: 'Menunggu', date: '-' };
        data.employees.push(newEmp);
        this.save(data);

        try {
            await fetch(`${API_URL}?action=save_employee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emp)
            });
        } catch (err) {}
    },

    // 6. Hapus Karyawan dari MySQL
    async deleteEmployee(id) {
        const data = this.get();
        data.employees = data.employees.filter(e => e.id !== id);
        this.save(data);

        try {
            await fetch(`${API_URL}?action=delete_employee`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
        } catch (err) {}
    },

    // 7. Simpan Profile Pengguna ke MySQL
    async saveUser(user) {
        const data = this.get();
        data.user = user;
        this.save(data);

        try {
            await fetch(`${API_URL}?action=save_user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
        } catch (err) {}
    }
};

// Authentication Handlers
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const data = Store.get();
    data.user.email = email || 'user@xiexepat.id';
    await Store.saveUser(data.user);
    window.location.href = 'dashboard.html';
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const umkm = document.getElementById('umkm').value.trim();
    const role = document.querySelector('input[name="role"]:checked')?.value || 'owner';

    await Store.saveUser({ name, email, role, umkm });
    window.location.href = 'dashboard.html';
}

function handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        window.location.href = 'index.html';
    }
}

// Global UI setup & Sinkronisasi Database Otomatis saat halaman dimuat
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Sync data dari MySQL
    await Store.syncWithBackend();

    // 2. Tampilkan Nama User di Sidebar
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    if (userNameEl) {
        const user = Store.get().user;
        userNameEl.textContent = user.name || 'Pengguna';
        if (userRoleEl) {
            userRoleEl.textContent = user.role === 'owner' ? 'Pemilik UMKM' : 'Karyawan';
        }
    }
});
