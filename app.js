import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// GANTI DENGAN CONFIG FIREBASE ANDA
const firebaseConfig = {
  apiKey: "AIzaSyDlPyiIPG61p7kywbBI4ZbBAJtssdcmWbA",
  authDomain: "simantap-sarpas.firebaseapp.com",
  projectId: "simantap-sarpas",
  storageBucket: "simantap-sarpas.firebasestorage.app",
  messagingSenderId: "699021070714",
  appId: "1:699021070714:web:2fc1aba7776154f6c0c6c3",
  measurementId: "G-CG4Q5CJGRQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userRole = 'user'; // Default

// 1. Cek Autentikasi
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Ambil Role dari Firestore (pastikan Anda membuat dokumen di koleksi 'users' secara manual di Firebase Console untuk Admin pertama)
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            userRole = userDoc.data().role;
        }
        
        document.getElementById('userRoleBadge').innerText = user.email + ` (${userRole.toUpperCase()})`;
        
        // Tampilkan menu admin jika role = admin
        if(userRole === 'admin') {
            document.getElementById('menuAdmin').style.display = 'block';
        }
        
        loadDashboardData();
    } else {
        window.location.href = "login.html";
    }
});

// Logout
document.getElementById('btnLogout').addEventListener('click', () => {
    signOut(auth);
});

// 2. Navigasi SPA
window.showPage = function(pageId) {
    document.querySelectorAll('.page-view').forEach(el => el.style.display = 'none');
    document.getElementById('page-' + pageId).style.display = 'block';
    
    // Update active class
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Load Data
    if(pageId === 'inventaris') loadInventaris();
    if(pageId === 'katalog') loadKatalog();
    if(pageId === 'transaksi') loadTransaksi();
}

// 3. Tambah Aset (Admin)
document.getElementById('formAset').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await addDoc(collection(db, "inventory"), {
            sku: document.getElementById('sku').value,
            nama: document.getElementById('namaBrg').value,
            kondisi: document.getElementById('kondisiBrg').value,
            stok: parseInt(document.getElementById('stokBrg').value)
        });
        alert('Aset berhasil disimpan!');
        document.getElementById('modalTambah').style.display = 'none';
        document.getElementById('formAset').reset();
        loadInventaris();
    } catch (error) {
        console.error("Error adding document: ", error);
        alert('Gagal! Pastikan Anda adalah Admin.');
    }
});

// 4. Load Master Inventaris (Admin)
async function loadInventaris() {
    const querySnapshot = await getDocs(collection(db, "inventory"));
    let html = '';
    querySnapshot.forEach((doc) => {
        let d = doc.data();
        let id = doc.id;
        html += `
            <tr>
                <td><strong>${d.sku}</strong></td>
                <td>${d.nama}</td>
                <td><span class="badge ${d.kondisi == 'Baik' ? 'baik' : 'rusak'}">${d.kondisi}</span></td>
                <td>${d.stok}</td>
                <td>
                    <button class="btn-3d outline" onclick="cetakLabel('${d.sku}', '${d.nama}')" style="padding: 5px 10px; font-size:12px;">Cetak Label Barcode</button>
                </td>
            </tr>
        `;
    });
    document.getElementById('tableInventaris').innerHTML = html;
}

// 5. Cetak Label Barcode Inventaris
window.cetakLabel = function(sku, nama) {
    const printDiv = document.getElementById('print-content');
    printDiv.innerHTML = `
        <div class="label-cetak">
            <h4 style="margin-bottom:5px;">SMKN 6 TEBO</h4>
            <p style="font-size: 12px;">${nama}</p>
            <svg id="barcode"></svg>
        </div>
    `;
    
    // Generate Barcode SVG
    JsBarcode("#barcode", sku, { format: "CODE128", width: 1.5, height: 40, displayValue: true });
    
    // Trigger Print browser
    window.print();
}

// 6. Load Katalog Peminjaman
async function loadKatalog() {
    const q = query(collection(db, "inventory"), where("kondisi", "==", "Baik"));
    const querySnapshot = await getDocs(q);
    let html = '';
    querySnapshot.forEach((doc) => {
        let d = doc.data();
        html += `
            <div class="card-3d">
                <div style="background:var(--soft-blue); height:120px; border-radius:10px; margin-bottom:15px; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-camera fa-3x" style="color:var(--primary);"></i>
                </div>
                <h4>${d.nama}</h4>
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Sisa Stok: ${d.stok}</p>
                <button class="btn-3d" style="width:100%;" onclick="ajukanPinjam('${doc.id}', '${d.nama}')">Pinjam Sekarang</button>
            </div>
        `;
    });
    document.getElementById('gridKatalog').innerHTML = html;
}

// 7. Pengajuan Pinjam
window.ajukanPinjam = async function(idBarang, namaBarang) {
    if(confirm(`Ajukan peminjaman untuk ${namaBarang}?`)) {
        await addDoc(collection(db, "transactions"), {
            uid_peminjam: currentUser.uid,
            email_peminjam: currentUser.email, // Untuk display
            id_item: idBarang,
            nama_item: namaBarang,
            tgl_pengajuan: new Date().toISOString().split('T')[0],
            status: "pending"
        });
        alert('Pengajuan berhasil, menunggu persetujuan Admin.');
        showPage('transaksi');
    }
}

// 8. Load Transaksi
async function loadTransaksi() {
    // Jika admin, load semua. Jika user, load miliknya saja
    let q;
    if(userRole === 'admin') {
        q = collection(db, "transactions");
    } else {
        q = query(collection(db, "transactions"), where("uid_peminjam", "==", currentUser.uid));
    }
    
    const querySnapshot = await getDocs(q);
    let html = '';
    querySnapshot.forEach((docSnap) => {
        let d = docSnap.data();
        
        let actionBtn = '';
        if(userRole === 'admin' && d.status === 'pending') {
            actionBtn = `<button class="btn-3d" onclick="approvePinjam('${docSnap.id}')">Setujui</button>`;
        }
        if(d.status === 'approved') {
            actionBtn = `<button class="btn-3d outline" onclick="cetakKartu('${d.nama_item}', '${d.email_peminjam}', '${d.tgl_pengajuan}')">Cetak Kartu</button>`;
        }

        html += `
            <tr>
                <td>${d.email_peminjam}</td>
                <td>${d.nama_item}</td>
                <td>${d.tgl_pengajuan}</td>
                <td><span class="badge ${d.status === 'approved' ? 'baik' : 'rusak'}">${d.status.toUpperCase()}</span></td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });
    document.getElementById('tableTransaksi').innerHTML = html;
}

window.approvePinjam = async function(idTrans) {
    await updateDoc(doc(db, "transactions", idTrans), { status: "approved" });
    alert('Disetujui!'); loadTransaksi();
}

// 9. Cetak Kartu Peminjaman
window.cetakKartu = function(namaBrg, email, tgl) {
    const printDiv = document.getElementById('print-content');
    printDiv.innerHTML = `
        <div class="kartu-cetak">
            <h2 style="text-align:center; margin-bottom: 20px;">KARTU BUKTI PEMINJAMAN<br>SMKN 6 TEBO</h2>
            <p><strong>Tanggal Pinjam:</strong> ${tgl}</p>
            <p><strong>Peminjam:</strong> ${email}</p>
            <table style="width:100%; margin: 20px 0;">
                <tr><th style="background:#ddd;">Nama Aset</th><th>Kondisi Diserahkan</th></tr>
                <tr><td>${namaBrg}</td><td>BAIK</td></tr>
            </table>
            <div style="display:flex; justify-content:space-between; margin-top:50px;">
                <div style="text-align:center;">Peminjam,<br><br><br><br>( ${email} )</div>
                <div style="text-align:center;">Admin Sarpras,<br><br><br><br>( ......................... )</div>
            </div>
        </div>
    `;
    window.print();
}

// 10. Dashboard Chart.js
async function loadDashboardData() {
    // Simulasi render chart
    const ctx = document.getElementById('kondisiChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr'],
            datasets: [{
                label: 'Jumlah Peminjaman',
                data: [12, 19, 3, 5],
                backgroundColor: '#F5B9D1',
                borderRadius: 10
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
}