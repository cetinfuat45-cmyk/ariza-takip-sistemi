
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
window.removeItem = async (cat, item) => {
    if (!confirm(`"${item}" silinecek. Emin misiniz?`)) return;
    try {
        await settingsRef.doc(cat).update({ list: firebase.firestore.FieldValue.arrayRemove(item) });
    } catch (err) { alert("Silinirken hata oluştu."); }
};

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
