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

// Yeni Gönderim Modalı Elementleri
const submissionModal = document.getElementById('submissionModal');
const loadingState = document.getElementById('loadingState');
const successState = document.getElementById('successState');
const loadingSubText = document.getElementById('loadingSubText');
const closeCountdown = document.getElementById('closeCountdown');
let closeCountdownTimer = null;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Yükleniyor ekranını aç
    submissionModal.classList.remove('hidden');
    loadingState.classList.remove('hidden');
    successState.classList.add('hidden');
    loadingSubText.innerText = "Sistemle bağlantı kuruluyor...";

    try {
        let photoUrl = "";
        
        // Fotoğraf seçildiyse işle (Kamera veya Dosyadan)
        const cameraFile = document.getElementById('cameraInput') ? document.getElementById('cameraInput').files[0] : null;
        const folderFile = document.getElementById('fileInput') ? document.getElementById('fileInput').files[0] : null;
        const photoFile = cameraFile || folderFile;
        
        if (photoFile) {
            loadingSubText.innerText = "Fotoğraf Sıkıştırılıyor...";
            const compressedBlob = await compressImage(photoFile);
            
            loadingSubText.innerText = "Fotoğraf Yükleniyor...";
            const storageRef = storage.ref('ariza_fotolari/' + Date.now() + '.jpg');
            await storageRef.put(compressedBlob);
            photoUrl = await storageRef.getDownloadURL();
        }

        loadingSubText.innerText = "Kayıt Oluşturuluyor...";

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
                    console.log("API Hatası (Mail Gitmedi): " + result.message);
                } else {
                    console.log("✅ Mail Web3Forms'a başarıyla iletildi.");
                }
            } else {
                console.log("Admin panelindeki Mail Şalteri KAPALI veya Access Key kaydedilmemiş. Bu yüzden mail atılmadı.");
            }
        } catch(e) {
            console.log("Arıza maili gönderilemedi: ", e);
        }

        // Gönderim Başarılı -> Modal'ın 2. Aşamasını Aç
        loadingState.classList.add('hidden');
        successState.classList.remove('hidden');
        
        // Formu Arka Planda Sıfırla
        form.reset();
        window.resetStepper();
        
        // 10 Saniyelik Otomatik Kapatma Sayacı
        let secondsLeft = 10;
        closeCountdown.innerText = secondsLeft;
        
        clearInterval(closeCountdownTimer);
        closeCountdownTimer = setInterval(() => {
            secondsLeft--;
            closeCountdown.innerText = secondsLeft;
            if (secondsLeft <= 0) {
                clearInterval(closeCountdownTimer);
                window.closeSystem();
            }
        }, 1000);

    } catch (error) {
        console.error("Hata: ", error);
        // Hata durumunda sadece modalı kapat (veya konsola yaz)
        submissionModal.classList.add('hidden');
    }
});

// Modal İçi Butonların Fonksiyonları
window.startNewForm = () => {
    clearInterval(closeCountdownTimer);
    submissionModal.classList.add('hidden');
    window.resetStepper();
};

window.closeSystem = () => {
    clearInterval(closeCountdownTimer);
    // Genellikle tarayıcılar JS ile açılmayan pencereleri window.close() ile kapatmaya izin vermez.
    // Bu yüzden pencereyi kapatmayı dener, olmazsa ekranı tamamen siyaha çevirir veya "Kapatabilirsiniz" mesajı verir.
    document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; width:100vw; background:#000; color:#fff; flex-direction:column; font-family:sans-serif;"><h2 style="margin-bottom:1rem;">Sistem Kapatıldı</h2><p style="color:#aaa;">Bu sekmeyi güvenle kapatabilirsiniz.</p></div>';
    window.close(); 
};

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

    // Açılır Listeler (Select) için Otomatik İlerleme (Auto-Advance)
    document.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', (e) => {
            if (!e.target.value) return; // Eğer 'Seçiniz' boş kalırsa işlem yapma
            
            const stepContainer = e.target.closest('.step-container');
            if (!stepContainer) return;
            
            const stepNum = parseInt(stepContainer.id.replace('step', ''));
            const stepInputs = Array.from(stepContainer.querySelectorAll('input:not([type="hidden"]), select, textarea'));
            const currentIndex = stepInputs.indexOf(e.target);
            
            if (currentIndex >= 0 && currentIndex < stepInputs.length - 1) {
                // Aynı adımda sıradaki giriş alanına geç (Örn: Bölüm seçilince Makine'ye odaklan)
                setTimeout(() => {
                    stepInputs[currentIndex + 1].focus();
                }, 100);
            } else {
                // Bu adımdaki son liste seçildi, doğrudan bir sonraki adıma (merdivene) atla
                setTimeout(() => {
                    window.nextStep(stepNum);
                }, 250);
            }
        });
    });

    // Fotoğraf Modalı ve Seçim İşlemleri
    const openPhotoModalBtn = document.getElementById('openPhotoModalBtn');
    const photoSelectionModal = document.getElementById('photoSelectionModal');
    const cameraInput = document.getElementById('cameraInput');
    const fileInput = document.getElementById('fileInput');
    const photoCompactText = document.getElementById('photoCompactText');

    if (openPhotoModalBtn && photoSelectionModal) {
        openPhotoModalBtn.addEventListener('click', () => {
            photoSelectionModal.classList.remove('hidden');
        });

        const handlePhotoSelection = (e, otherInput) => {
            if (e.target.files && e.target.files.length > 0) {
                // Diğer input'u temizle (çakışmayı önlemek için)
                otherInput.value = "";
                
                const fileName = e.target.files[0].name;
                photoCompactText.innerText = "✅ " + fileName;
                openPhotoModalBtn.style.background = "rgba(16, 185, 129, 0.1)";
                openPhotoModalBtn.style.borderColor = "var(--success)";
                openPhotoModalBtn.style.color = "var(--success)";
                
                // Seçim yapıldıktan sonra modalı kapat
                setTimeout(() => {
                    photoSelectionModal.classList.add('hidden');
                }, 300);
            }
        };

        if (cameraInput && fileInput) {
            cameraInput.addEventListener('change', (e) => handlePhotoSelection(e, fileInput));
            fileInput.addEventListener('change', (e) => handlePhotoSelection(e, cameraInput));
        }
    }
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
    
    // Fotoğraf Butonunu ve Seçimlerini Sıfırla
    const openPhotoModalBtn = document.getElementById('openPhotoModalBtn');
    if (openPhotoModalBtn) {
        document.getElementById('photoCompactText').innerText = "Fotoğraf Ekle (Opsiyonel)";
        openPhotoModalBtn.style.color = "var(--text-secondary)";
        
        const cameraInput = document.getElementById('cameraInput');
        const fileInput = document.getElementById('fileInput');
        if(cameraInput) cameraInput.value = "";
        if(fileInput) fileInput.value = "";
    }
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.classList.remove('ready-to-submit');
    const wrap = document.querySelector('.nav-center-wrap');
    if (wrap) wrap.classList.remove('show-btn');
};

window.adminLogin = async () => {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('adminPasswordInput').value = '';
        setTimeout(() => document.getElementById('adminPasswordInput').focus(), 100);
    }
};

window.closeAdminLogin = () => {
    const modal = document.getElementById('adminLoginModal');
    if (modal) modal.classList.add('hidden');
};

window.submitAdminModalLogin = async () => {
    const passInput = document.getElementById('adminPasswordInput');
    if (passInput.value === "12345") { 
        sessionStorage.setItem("isAdmin", "true");
        
        // Admin Giriş Yaptığında Mail Gönderimi
        try {
            const mailDoc = await db.collection('ayarlar').doc('adminEmail').get();
            if (mailDoc.exists && mailDoc.data().key && mailDoc.data().enabled !== false) {
                await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        access_key: mailDoc.data().key,
                        subject: "⚠️ SİSTEM GÜVENLİĞİ: Ana Sayfadan Admin Paneline Giriş Yapıldı",
                        from_name: "Bakım Sistemi",
                        email: "sistem@bildirim.com",
                        message: `Sisteminize (Ana Sayfa üzerinden) şifre ile başarılı bir Admin girişi yapılmıştır.\nTarih: ${new Date().toLocaleString('tr-TR')}`
                    })
                });
            }
        } catch(e) { console.log("Mail gönderilemedi."); }

        window.location.href = "admin.html";
    } else {
        alert("Hatalı şifre!");
        passInput.value = "";
        passInput.focus();
    }
};

// Gönder Butonu Görünürlük ve Neon Kontrolü
const descriptionInput = document.getElementById('description');
const submitNeonBtn = document.getElementById('submitBtn');
const navCenterWrap = document.querySelector('.nav-center-wrap');

if (descriptionInput) {
    descriptionInput.addEventListener('input', function() {
        if (this.value.trim().length > 3) {
            if(submitNeonBtn) submitNeonBtn.classList.add('ready-to-submit');
            if(navCenterWrap) navCenterWrap.classList.add('show-btn');
        } else {
            if(submitNeonBtn) submitNeonBtn.classList.remove('ready-to-submit');
            if(navCenterWrap) navCenterWrap.classList.remove('show-btn');
        }
    });
}
