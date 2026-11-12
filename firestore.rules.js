rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Fungsi untuk mengecek apakah user adalah admin
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Koleksi Users
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || isAdmin();
    }

    // Koleksi Inventory & Locations (Master Data)
    match /inventory/{itemId} {
      allow read: if request.auth != null; // Semua user bisa lihat katalog
      allow write: if isAdmin();
    }
    
    match /locations/{locId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // Koleksi Transactions
    match /transactions/{transId} {
      // User bisa baca transaksinya sendiri, admin bisa baca semua
      allow read: if request.auth.uid == resource.data.uid_peminjam || isAdmin();
      // User bisa buat pengajuan, admin bisa update status
      allow create: if request.auth != null && request.resource.data.uid_peminjam == request.auth.uid;
      allow update, delete: if isAdmin();
    }
  }
}