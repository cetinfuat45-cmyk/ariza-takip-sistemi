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

        // Yeni Arıza Bildirimini Web3Forms ile Mail At
        try {
            const mailDoc = await db.collection('ayarlar').doc('adminEmail').get();
            if (mailDoc.exists && mailDoc.data().key && mailDoc.data().enabled !== false) {
                const accessKey = mailDoc.data().key;
                
                const dashboardLink = window.location.href.replace('index.html', '') + 'dashboard.html';
                const faultTypeStr = faultData.jobType ? faultData.jobType.toUpperCase() : "ARIZA BİLDİRİMİ";

                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        access_key: accessKey,
                        subject: faultData.machine || "Yeni Arıza", // Konu başlığı Makine Adı
                        from_name: faultTypeStr, // Gönderen kişi MEKANİK ARIZA vs.
                        "Arıza Açıklaması": faultData.description,
                        "Bildiren Personel": faultData.userName,
                        "Çalışılan Vardiya": faultData.shift,
                        "Sisteme Giriş Linki": dashboardLink
                    })
                });
                
                const result = await response.json();
                if(!result.success) {
                    alert("⚠️ API Hatası (Mail Gitmedi): " + result.message);
                } else {
                    console.log("✅ Mail Web3Forms'a başarıyla iletildi.");
                }
            } else {
                alert("⚠️ Sistem Uyarısı: Admin panelindeki Mail Şalteri KAPALI veya Access Key kaydedilmemiş. Bu yüzden mail atılmadı.");
            }
        } catch(e) {
            alert("⚠️ Mail gönderim aşamasında kritik hata: " + e.message);
            console.log("Arıza maili gönderilemedi: ", e);
        }

        successMessage.classList.remove('hidden');
        form.reset();
        
        // 3 saniye sonra mesajı gizle ve butonu düzelt
        setTimeout(() => {
            successMessage.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <span>Talebi Gönder</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            `;
            window.resetStepper(); // Formu 1. adıma döndür
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
// --- Çok Adımlı Form (Stepper) Mantığı ---

window.goToStep = (step) => {
    const currentActive = document.querySelector('.step-container.active');
    if (currentActive) {
        const currentStepNum = parseInt(currentActive.id.replace('step', ''));
        if (currentStepNum === step) return;
        
        if (step > currentStepNum) {
            if (!validateStep(currentStepNum)) return;
        }
        
        updateSummary(currentStepNum);
        currentActive.classList.remove('active');
        currentActive.classList.add('completed');
    }
    
    const target = document.getElementById(`step${step}`);
    if(target) {
        target.classList.add('active');
        target.classList.remove('completed');
        
        const firstInput = target.querySelector('input, select, textarea');
        if(firstInput) setTimeout(() => firstInput.focus(), 300);
    }
};

window.nextStep = (currentStepNum) => {
    if (validateStep(currentStepNum)) goToStep(currentStepNum + 1);
};

const validateStep = (step) => {
    const container = document.getElementById(`step${step}`);
    const inputs = container.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(el => {
        if (!el.value.trim()) {
            el.style.borderColor = 'var(--danger)';
            el.classList.add('shake');
            setTimeout(() => el.classList.remove('shake'), 500);
            isValid = false;
        } else {
            el.style.borderColor = ''; 
        }
    });
    return isValid;
};

const updateSummary = (step) => {
    let summaryText = "";
    if (step === 1) {
        summaryText = document.getElementById('userName').value;
    } else if (step === 2) {
        const dept = document.getElementById('costCenter').value;
        const mach = document.getElementById('machine').value;
        if(dept && mach) summaryText = `${dept} > ${mach}`;
        else if (dept) summaryText = dept;
    } else if (step === 3) {
        const shift = document.getElementById('shift').value;
        const job = document.getElementById('jobType').value;
        if(shift && job) summaryText = `${shift} / ${job}`;
    } else if (step === 4) {
        summaryText = document.getElementById('description').value;
    }
    
    const summarySpan = document.getElementById(`summary${step}`);
    if (summarySpan) summarySpan.innerText = summaryText;
};

// Form submit başarılı olduğunda ilk adıma döndür
window.resetStepper = () => {
    document.querySelectorAll('.step-summary').forEach(el => el.innerText = '');
    document.querySelectorAll('.step-container').forEach(el => {
        el.classList.remove('active');
        el.classList.remove('completed');
    });
    document.getElementById('step1').classList.add('active');
};
