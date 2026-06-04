
// Yetki Kontrolü
if (sessionStorage.getItem('isAdmin') !== 'true') {
    alert("Bu sayfaya erişim yetkiniz yok. Lütfen giriş yapın.");
    window.location.href = 'dashboard.html';
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
const settingsRef = db.collection('ayarlar');

const categories = ['departments', 'machines', 'shifts', 'jobTypes', 'operators'];

// Verileri Canlı Çek ve Ekrana Bas
categories.forEach(cat => {
    settingsRef.doc(cat).onSnapshot(doc => {
        const container = document.getElementById(`list-${cat}`);
        if (!doc.exists) { container.innerHTML = "<div class='list-item'>Liste boş</div>"; return; }
        
        const list = doc.data().list || [];
        if (list.length === 0) { container.innerHTML = "<div class='list-item'>Liste boş</div>"; return; }

        let html = "";
        list.sort().forEach(item => {
            const safeItem = item.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `
                <div class="list-item">
                    <span>${item}</span>
                    <button class="btn-delete" onclick="removeItem('${cat}', '${safeItem}')">Sil</button>
                </div>
            `;
        });
        container.innerHTML = html;
    });
});

// Standart Liste Elemanı Ekleme
window.addItem = async (cat) => {
    const inputEl = document.getElementById(`input-${cat}`);
    const value = inputEl.value.trim().toUpperCase();
    if (!value) return;
    try {
        await settingsRef.doc(cat).set({ list: firebase.firestore.FieldValue.arrayUnion(value) }, { merge: true });
        inputEl.value = "";
    } catch (err) { alert("Eklenirken hata oluştu."); }
};

// Standart Liste Elemanı Silme
let pendingDelete = null;

window.removeItem = (cat, item) => {
    pendingDelete = { cat, item };
    document.getElementById('confirmModalText').innerText = `"${item}" kaydını silmek istediğinize emin misiniz?`;
    document.getElementById('confirmModal').classList.remove('hidden');
};

document.getElementById('confirmBtnYes').addEventListener('click', async () => {
    if (!pendingDelete) return;
    const { cat, item } = pendingDelete;
    document.getElementById('confirmModal').classList.add('hidden');
    
    try {
        await settingsRef.doc(cat).update({ list: firebase.firestore.FieldValue.arrayRemove(item) });
    } catch (err) { alert("Silinirken hata oluştu."); }
    pendingDelete = null;
});

// Google Sheets Toplu Veri Çekme
window.fetchGoogleSheet = async () => {
    const btn = document.getElementById('syncBtn');
    if (!confirm("Google Sheets'teki tüm Makineler ve Maliyet Merkezleri okunarak sisteme eklenecektir. (Eski listeyi ezip güncel haliyle değiştirir). Onaylıyor musunuz?")) return;
    
    btn.disabled = true;
    btn.innerHTML = "⏳ Tabloya Bağlanıyor...";

    try {
        const sheetUrl = "https://docs.google.com/spreadsheets/d/1n4FONdt1lCVZ9MwNzkw3O3ljs97nWVshz6Ke6Sn7_zY/export?format=csv&gid=1434126787";
        
        let response;
        try {
            // Birinci aracı sunucu (En hızlısı)
            response = await fetch(`https://corsproxy.io/?${encodeURIComponent(sheetUrl)}`);
        } catch (e) {
            console.warn("1. Proxy başarısız, 2. deneniyor...");
        }

        if (!response || !response.ok) {
            try {
                // İkinci alternatif aracı sunucu
                response = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(sheetUrl)}`);
            } catch(e) {
                console.error("2. Proxy de başarısız.");
            }
        }
        
        if (!response || !response.ok) throw new Error("Bağlantı kurulamadı. (Şirket ağı proxy'leri engelliyor olabilir).");
        
        const csvText = await response.text();

        if (!csvText || csvText.length < 50) throw new Error("Google Sheets'ten veri çekilemedi.");

        const lines = csvText.split(/\r?\n/);
        const departments = new Set();
        const machines = new Set();
        const machineMap = {}; // Yeni: Bölüm -> Makine eşleştirmesi

        for (let i = 2; i < lines.length; i++) { // İlk 2 satır başlık olduğu için atla
            const line = lines[i].trim();
            if (!line) continue;
            
            // CSV Ayrıştırma (Tırnak içindeki virgülleri görmezden gelmek için)
            let cols = [];
            let inQuotes = false;
            let currentStr = "";
            for (let char of line) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { cols.push(currentStr); currentStr = ""; }
                else currentStr += char;
            }
            cols.push(currentStr);

            if (cols.length >= 3) {
                let dept = cols[1].trim().replace(/^"|"$/g, '');
                let mach = cols[2].trim().replace(/^"|"$/g, '');

                if (dept && dept !== 'MALİYET MERKEZİ' && !dept.includes("37")) {
                    dept = dept.toUpperCase();
                    departments.add(dept);
                    
                    if (mach && mach !== 'MAKİNE ADI' && !mach.includes("37")) {
                        mach = mach.toUpperCase();
                        machines.add(mach);
                        
                        // Eşleştirmeyi kaydet
                        if (!machineMap[dept]) machineMap[dept] = new Set();
                        machineMap[dept].add(mach);
                    }
                }
            }
        }

        btn.innerHTML = "⏳ Veritabanı Güncelleniyor...";

        const deptArray = Array.from(departments);
        const machArray = Array.from(machines);

        // Firestore'a kaydedilecek Map'i hazırla (Set'leri Array'e çevir)
        const finalMap = {};
        Object.keys(machineMap).forEach(k => {
            finalMap[k] = Array.from(machineMap[k]);
        });

        // Firebase'e Kaydet (Üzerine yazar)
        if (deptArray.length > 0) {
            await settingsRef.doc('departments').set({ list: deptArray });
        }
        if (machArray.length > 0) {
            await settingsRef.doc('machines').set({ list: machArray });
        }
        if (Object.keys(finalMap).length > 0) {
            // Eşleştirmeyi yeni bir doküman olarak kaydet
            await settingsRef.doc('machineMap').set(finalMap);
        }

        alert(`✅ Başarılı!\nTablonuzdan toplam:\n- ${deptArray.length} Adet Bölüm/Maliyet Merkezi\n- ${machArray.length} Adet Makine çekildi ve birbirlerine bağlandı.`);
        
    } catch (err) {
        console.error(err);
        alert("Bir hata oluştu: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "📥 Tablodan Makine ve Bölümleri Çek";
    }
};

// Mail Ayarlarını Çek
settingsRef.doc('adminEmail').onSnapshot(doc => {
    if (doc.exists) {
        document.getElementById('input-adminEmail').value = doc.data().key || "";
        document.getElementById('input-targetEmail').value = doc.data().targetEmail || "";
        
        // Şalterleri güncelle (Eğer ayar yoksa varsayılan olarak açık kabul et)
        document.getElementById('toggle-loginMailEnabled').checked = doc.data().loginMailEnabled !== false;
        document.getElementById('toggle-faultMailEnabled').checked = doc.data().faultMailEnabled !== false;
    } else {
        document.getElementById('toggle-loginMailEnabled').checked = true;
        document.getElementById('toggle-faultMailEnabled').checked = true;
    }
});

// Access Key veya Google Apps Script Linki Kaydet
window.saveAdminEmail = async () => {
    const key = document.getElementById('input-adminEmail').value.trim();
    const targetEmail = document.getElementById('input-targetEmail').value.trim();
    
    if(key.includes('@')) {
        alert("HATA: İlk kutuya şifreyi (Access Key) veya Google Apps Script Linkini yazmalısınız. E-Posta adresinizi 2. kutuya yazın.");
        return;
    }
    if(!key || (key.length < 25 && !key.startsWith('http'))) {
        alert("HATA: Girdiğiniz Web3Forms/Google kodu geçersiz. Lütfen eksiksiz kopyalayın.");
        return;
    }
    
    try {
        await settingsRef.doc('adminEmail').set({ key: key, targetEmail: targetEmail }, { merge: true });
        alert("✅ E-Posta Gönderim Bilgisi başarıyla kaydedildi! (Not: Google Apps Script kullanıyorsanız sağdaki 'Test Et' butonu sadece Web3Forms için çalışır, dikkate almayınız).");
        document.getElementById('testBtn').style.display = 'block';
    } catch (err) { alert("Kaydedilirken hata oluştu."); }
};

// Şalterleri (Aç/Kapat) Veritabanına Kaydet
window.toggleMailSetting = async (settingName) => {
    const isChecked = document.getElementById(`toggle-${settingName}`).checked;
    try {
        await settingsRef.doc('adminEmail').set({ [settingName]: isChecked }, { merge: true });
    } catch(e) {
        alert("Ayar değiştirilemedi.");
    }
};

// Aktarım Saatini Kaydet
window.saveSyncTime = async () => {
    const timeVal = document.getElementById('input-syncTime').value;
    if (!timeVal) {
        alert("Lütfen bir saat seçin!");
        return;
    }
    try {
        await settingsRef.doc('syncSettings').set({ exportTime: timeVal }, { merge: true });
        alert("✅ Günlük aktarım saati başarıyla kaydedildi: " + timeVal);
    } catch (err) { alert("Kaydedilirken hata oluştu."); }
};

// Aktarım Linkini Kaydet
window.saveExportUrl = async () => {
    let urlVal = document.getElementById('input-exportUrl').value.trim();
    
    if (!urlVal || urlVal.length < 10) {
        alert("Lütfen geçerli bir Google Apps Script (Web App) linki girin!");
        return;
    }

    // Android tarayıcılar bazen kopyalarken "https://" kısmını gizler/almaz. 
    // Eğer link http ile başlamıyorsa biz otomatik ekliyoruz.
    if (!urlVal.toLowerCase().startsWith('http')) {
        urlVal = 'https://' + urlVal;
    }

    try {
        await settingsRef.doc('syncSettings').set({ exportUrl: urlVal }, { merge: true });
        document.getElementById('input-exportUrl').value = urlVal;
        document.getElementById('testExportBtn').style.display = 'block';
        alert("✅ Aktarım Linki başarıyla kaydedildi!");
    } catch (err) { alert("Kaydedilirken hata oluştu."); }
};

// Ayarları Yükle
let autoExportSettings = { time: null, url: null, lastSync: null };
settingsRef.doc('syncSettings').onSnapshot(doc => {
    if (doc.exists) {
        if(doc.data().exportTime) {
            document.getElementById('input-syncTime').value = doc.data().exportTime;
            autoExportSettings.time = doc.data().exportTime;
        }
        if(doc.data().exportUrl) {
            document.getElementById('input-exportUrl').value = doc.data().exportUrl;
            document.getElementById('testExportBtn').style.display = 'block';
            autoExportSettings.url = doc.data().exportUrl;
        }
        if(doc.data().lastSyncDate) {
            document.getElementById('lastExportStatus').innerText = "Son başarılı aktarım: " + doc.data().lastSyncDate;
            autoExportSettings.lastSync = doc.data().lastSyncDate;
        }
    }
});

// Admin sayfasında açıkken saati yakalayabilmesi için Arka Plan Zamanlayıcısı
setInterval(async () => {
    if (!autoExportSettings.time || !autoExportSettings.url) return;
    
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const currentHourMin = `${h}:${m}`;
    const todayStr = now.toLocaleDateString('tr-TR');

    if (currentHourMin === autoExportSettings.time) {
        if (!autoExportSettings.lastSync || !autoExportSettings.lastSync.includes(todayStr)) {
            const nowStr = now.toLocaleString('tr-TR');
            autoExportSettings.lastSync = nowStr; 
            db.collection('ayarlar').doc('syncSettings').set({ lastSyncDate: nowStr }, { merge: true });

            try {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                function checkIsToday(dateString) {
                    if (!dateString || typeof dateString !== 'string') return false;
                    try {
                        const nums = dateString.match(/\d+/g);
                        if (nums && nums.length >= 3) {
                            const d = parseInt(nums[0], 10);
                            const m = parseInt(nums[1], 10) - 1;
                            let y = parseInt(nums[2], 10);
                            if (y < 100) y += 2000;
                            const dateObj = new Date(y, m, d);
                            return dateObj >= startOfDay;
                        }
                    } catch(e) {}
                    return false;
                }

                const snapshot = await db.collection("arizalar").get();
                let faultsToExport = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    let isToday = false;
                    let createdStr = "";
                    let completedStr = "";

                    if (data.createdAt) {
                        if (typeof data.createdAt.toDate === 'function') {
                            const dateObj = data.createdAt.toDate();
                            createdStr = dateObj.toLocaleString('tr-TR');
                            if (dateObj >= startOfDay) isToday = true;
                        } else if (typeof data.createdAt === 'string') {
                            createdStr = data.createdAt;
                            if (checkIsToday(createdStr)) isToday = true;
                        }
                    }

                    if (data.completedAt) {
                        if (typeof data.completedAt.toDate === 'function') {
                            const dateObj = data.completedAt.toDate();
                            completedStr = dateObj.toLocaleString('tr-TR');
                            if (dateObj >= startOfDay) isToday = true;
                        } else if (typeof data.completedAt === 'string') {
                            completedStr = data.completedAt;
                            if (checkIsToday(completedStr)) isToday = true;
                        }
                    }

                    if (isToday) {
                        const exportData = { ...data };
                        if (createdStr) exportData.createdAt = createdStr;
                        if (completedStr) exportData.completedAt = completedStr;
                        faultsToExport.push(exportData);
                    }
                });

                if (faultsToExport.length > 0) {
                    fetch(autoExportSettings.url, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify(faultsToExport)
                    }).catch(e => console.log(e));
                }
            } catch (err) {}
        }
    }
}, 20000);

// Test Gönderimi (Hayali Kayıt Gönderir)
window.testExportUrl = async () => {
    const exportUrl = document.getElementById('input-exportUrl').value.trim();
    if (!exportUrl) return;

    const btn = document.getElementById('testExportBtn');
    btn.innerText = "Gönderiliyor...";
    btn.disabled = true;

    try {
        const testFault = [{
            createdAt: new Date().toLocaleString('tr-TR'),
            userName: "Test Kullanıcı",
            costCenter: "01-Bakım ve Onarım Test Bölümü",
            machine: "TEST MAKİNESİ (BAĞLANTI)",
            shift: "1.VARDİYA 08:00 // 16:00",
            jobType: "TEST İŞLEMİ",
            description: "Bu kayıt, E-Tablolar entegrasyonunu doğrulamak için gönderilmiştir.",
            photoUrl: "Fotograf Yok"
        }];

        fetch(exportUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(testFault)
        }).catch(e => console.log(e));

        setTimeout(() => {
            alert("Test verisi başarıyla gönderildi! Lütfen Google Sheets dosyanızı kontrol ediniz.");
            btn.innerText = "Test Et";
            btn.disabled = false;
        }, 1500);
    } catch(err) {
        alert("Hata oluştu.");
        btn.innerText = "Test Et";
        btn.disabled = false;
    }
};

// Manuel Aktarım (Şimdi Aktar)
window.exportTodayFaults = async () => {
    const exportUrl = document.getElementById('input-exportUrl').value.trim();
    if (!exportUrl) {
        alert("Lütfen önce Google Sheets Script Linkini girip kaydedin!");
        return;
    }

    const btn = document.getElementById('exportBtn');
    btn.innerText = "⏳ Veriler Toplanıyor...";
    btn.disabled = true;

    try {
        // Bugünün başlangıcı
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        function checkIsToday(dateString) {
            if (!dateString || typeof dateString !== 'string') return false;
            try {
                const nums = dateString.match(/\d+/g);
                if (nums && nums.length >= 3) {
                    const d = parseInt(nums[0], 10);
                    const m = parseInt(nums[1], 10) - 1; // Aylar 0'dan başlar
                    let y = parseInt(nums[2], 10);
                    if (y < 100) y += 2000; // 26 ise 2026 yap
                    
                    const dateObj = new Date(y, m, d);
                    return dateObj >= startOfDay;
                }
            } catch(e) {}
            return false;
        }

        // Arızaları Çek (Bugün açılanlar veya bugün kapananlar)
        const snapshot = await db.collection("arizalar").get();
        let faultsToExport = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            let isToday = false;
            let createdStr = "";
            let completedStr = "";

            // 1. Oluşturulma Tarihi Kontrolü
            if (data.createdAt) {
                if (typeof data.createdAt.toDate === 'function') {
                    // Veritabanında Firebase Timestamp olarak kayıtlıysa
                    const dateObj = data.createdAt.toDate();
                    createdStr = dateObj.toLocaleString('tr-TR');
                    if (dateObj >= startOfDay) isToday = true;
                } else if (typeof data.createdAt === 'string') {
                    // String olarak kayıtlıysa
                    createdStr = data.createdAt;
                    if (checkIsToday(createdStr)) isToday = true;
                }
            }

            // 2. Kapanış Tarihi Kontrolü
            if (data.completedAt) {
                if (typeof data.completedAt.toDate === 'function') {
                    const dateObj = data.completedAt.toDate();
                    completedStr = dateObj.toLocaleString('tr-TR');
                    if (dateObj >= startOfDay) isToday = true;
                } else if (typeof data.completedAt === 'string') {
                    completedStr = data.completedAt;
                    if (checkIsToday(completedStr)) isToday = true;
                }
            }

            // Eğer bugün işlem görmüşse aktarım listesine ekle
            if (isToday) {
                // Firebase Timestamp nesnelerini stringe çevirerek export listesine at
                // Böylece Google Sheets'e giderken JSON formatı bozulmaz
                const exportData = { ...data };
                if (createdStr) exportData.createdAt = createdStr;
                if (completedStr) exportData.completedAt = completedStr;
                faultsToExport.push(exportData);
            }
        });

        if (faultsToExport.length === 0) {
            alert("Bugüne ait gönderilecek herhangi bir arıza kaydı bulunamadı.");
            btn.innerText = "🚀 Bugünün Arızalarını Şimdi Aktar";
            btn.disabled = false;
            return;
        }

        btn.innerText = `⏳ ${faultsToExport.length} Kayıt Gönderiliyor...`;
        
        // Webhook'a gönder
        fetch(exportUrl, {
            method: 'POST',
            mode: 'no-cors', // CORS'u aşmak için
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(faultsToExport)
        }).catch(e => console.log(e));

        setTimeout(async () => {
            alert(`✅ ${faultsToExport.length} adet arıza kaydı başarıyla gönderildi!\n(Google Sheets tablonuzu kontrol edebilirsiniz)`);
            const nowStr = new Date().toLocaleString('tr-TR');
            await settingsRef.doc('syncSettings').set({ lastSyncDate: nowStr }, { merge: true });
            
            btn.innerText = "🚀 Bugünün Arızalarını Şimdi Aktar";
            btn.disabled = false;
        }, 1500);

    } catch (err) {
        console.error(err);
        alert("Veriler toplanırken hata oluştu.");
        btn.innerText = "🚀 Bugünün Arızalarını Şimdi Aktar";
        btn.disabled = false;
    }
};

window.testEmail = async () => {
    const key = document.getElementById('input-adminEmail').value.trim();
    if(!key) return;
    
    const btn = document.getElementById('testBtn');
    btn.innerText = "Gönderiliyor...";
    btn.disabled = true;
    
    try {
        if (key.startsWith("http")) {
            const targetEmail = document.getElementById('input-targetEmail').value.trim();
            // Google Apps Script Testi
            fetch(key, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    type: 'fault',
                    targetEmail: targetEmail,
                    subject: "✅ SİSTEM TESTİ BAŞARILI (Google Apps Script)",
                    from_name: "Bakım Sistemi Test",
                    description: `Tebrikler! Google sunucunuz üzerinden E-Posta gönderimi kusursuz çalışıyor.\nTarih: ${new Date().toLocaleString('tr-TR')}`,
                    userName: "Test Kullanıcısı",
                    shift: "Test Vardiyası",
                    link: "#"
                })
            }).catch(e => console.log(e));
            
            setTimeout(() => {
                alert("Test maili Google sunucunuza iletildi. Lütfen gelen kutunuzu (Spam klasörü dahil) kontrol ediniz.");
                btn.innerText = "Test Et";
                btn.disabled = false;
            }, 1500);
            
        } else {
            // Web3Forms Testi
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    access_key: key,
                    subject: "✅ SİSTEM TESTİ BAŞARILI",
                    from_name: "Bakım Sistemi Test",
                    email: "test@sistem.com",
                    message: `Tebrikler! Web3Forms API bağlantınız kusursuz çalışıyor.\nTarih: ${new Date().toLocaleString('tr-TR')}`
                })
            });
            const result = await response.json();
            if(result.success) {
                alert("Test maili başarıyla gönderildi! Lütfen posta kutunuzu (ve gereksiz/spam klasörünü) kontrol edin.");
            } else {
                alert("❌ Hata: " + result.message);
            }
            btn.innerText = "Test Et";
            btn.disabled = false;
        }
    } catch (err) {
        alert("Bağlantı hatası oluştu.");
        btn.innerText = "Test Et";
        btn.disabled = false;
    }
};
