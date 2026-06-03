// Service Worker Registration for PWA (Android Install)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(console.error);
    });
}

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEqLYUevIJCcLrJa-05MXx5ik-QFouq9o",
  authDomain: "arizabildirim-89dfa.firebaseapp.com",
  projectId: "arizabildirim-89dfa",
  storageBucket: "arizabildirim-89dfa.firebasestorage.app",
  messagingSenderId: "106785239667",
  appId: "1:106785239667:web:ab131b6a11d8133a537006"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const storage = firebase.storage();

// Admin Panelinden Ayarları (Listeleri) Çekip Dropdown'ları Doldur
const settingsRef = db.collection('ayarlar');
const dropdownMap = {
    'departments': 'costCenter',
    // 'machines': 'machine', -> Makineler artık bölüme göre dinamik gelecek
    'shifts': 'shift',
    'jobTypes': 'jobType'
};

// Bağımsız listeleri doldur
Object.keys(dropdownMap).forEach(cat => {
    settingsRef.doc(cat).onSnapshot(doc => {
        const selectEl = document.getElementById(dropdownMap[cat]);
        if (selectEl && doc.exists) {
            const list = doc.data().list || [];
            if (list.length > 0) {
                selectEl.innerHTML = '<option value="">Seçiniz...</option>';
                list.sort().forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item;
                    opt.textContent = item;
                    selectEl.appendChild(opt);
                });
            }
        }
    });
});

// Maliyet Merkezi -> Makine Dinamik İlişkisi
let currentMachineMap = {};
const costCenterSelect = document.getElementById('costCenter');
const machineSelect = document.getElementById('machine');

// Eşleştirme haritasını veritabanından dinle
settingsRef.doc('machineMap').onSnapshot(doc => {
    if (doc.exists) {
        currentMachineMap = doc.data();
    }
});

// Bölüm seçildiğinde makineleri güncelle
costCenterSelect.addEventListener('change', (e) => {
    const selectedDept = e.target.value;
    machineSelect.innerHTML = '<option value="">Önce Bölüm Seçiniz...</option>';
    
    if (selectedDept && currentMachineMap[selectedDept]) {
        machineSelect.innerHTML = '<option value="">Makine Seçiniz...</option>';
        const machList = currentMachineMap[selectedDept];
        machList.sort().forEach(mach => {
            const opt = document.createElement('option');
            opt.value = mach;
            opt.textContent = mach;
            machineSelect.appendChild(opt);
        });
    }
});

// Fotoğraf Sıkıştırma Fonksiyonu (5MB dosyayı 200KB'a düşürür)
async function compressImage(file, maxWidth = 1024) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // %80 kalite ile JPEG olarak sıkıştır
                canvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/jpeg', 0.8);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

const form = document.getElementById('faultForm');
const submitBtn = document.getElementById('submitBtn');
const successMessage = document.getElementById('successMessage');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Butonu yükleniyor durumuna al
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> <span>Gönderiliyor...</span>';

    try {
        let photoUrl = "";
        
        // Fotoğraf seçildiyse işle
        const photoFile = document.getElementById('photo').files[0];
        if (photoFile) {
            submitBtn.innerHTML = '<span class="loading-spinner"></span> <span>Fotoğraf Sıkıştırılıyor...</span>';
            const compressedBlob = await compressImage(photoFile);
            
            submitBtn.innerHTML = '<span class="loading-spinner"></span> <span>Fotoğraf Yükleniyor...</span>';
            const storageRef = storage.ref('ariza_fotolari/' + Date.now() + '.jpg');
            await storageRef.put(compressedBlob);
            photoUrl = await storageRef.getDownloadURL();
        }

        submitBtn.innerHTML = '<span>Kayıt Oluşturuluyor...</span>';

        const faultData = {
            userName: document.getElementById('userName').value,
            costCenter: document.getElementById('costCenter').value,
            machine: document.getElementById('machine').value,
            shift: document.getElementById('shift').value,
            jobType: document.getElementById('jobType').value,
            description: document.getElementById('description').value,
            photoUrl: photoUrl,
            status: 'Açık',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            resolvedData: null
        };

        await db.collection("arizalar").add(faultData);

        successMessage.classList.remove('hidden');
        form.reset();
        
        // 3 saniye sonra mesajı gizle ve butonu düzelt
        setTimeout(() => {
            successMessage.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Talebi Gönder';
        }, 3000);

    } catch (error) {
        console.error("Hata: ", error);
        alert("Kayıt sırasında bir hata oluştu! Gerekli izinleri verdiğinizden emin olun.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Talebi Gönder';
    }
});

// Doldurulan form alanlarının (input, select, textarea) yanıp sönmesi için dinleyici
document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('input, select, textarea');
    
    const checkFilled = (el) => {
        if (el.value && el.value.trim() !== '') {
            el.classList.add('input-filled');
        } else {
            el.classList.remove('input-filled');
        }
    };

    inputs.forEach(el => {
        el.addEventListener('input', () => checkFilled(el));
        el.addEventListener('change', () => checkFilled(el));
        // Sayfa yüklendiğinde mevcut doluları da kontrol et (Örn: tarayıcı otomatik doldurduysa)
        checkFilled(el);
    });
});
