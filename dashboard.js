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

// Admin Kontrolü
const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
if (isAdmin) {
    document.getElementById('adminPanel').style.display = 'flex';
    document.getElementById('loginBtn').style.display = 'none';
    document.querySelectorAll('.admin-col').forEach(el => el.style.display = 'table-cell');
}

window.adminLogin = () => {
    const pass = prompt("Admin Şifresini Giriniz:");
    if (pass === "12345") { 
        sessionStorage.setItem('isAdmin', 'true');
        window.location.href = 'admin.html'; // Direkt admin paneline yönlendir
    } else if (pass !== null) {
        alert("Hatalı Şifre!");
    }
};

window.adminLogout = () => {
    sessionStorage.removeItem('isAdmin');
    window.location.reload();
};

window.deleteFault = async (id) => {
    if (confirm("Bu arıza kaydını KALICI OLARAK silmek istediğinize emin misiniz?")) {
        try { await db.collection("arizalar").doc(id).delete(); } 
        catch(e) { alert("Silinirken hata oluştu!"); }
    }
};

window.markAsResolved = async (id) => {
    if (confirm("Bu arızayı çözüldü olarak işaretlemek istediğinize emin misiniz?")) {
        try { 
            await db.collection("arizalar").doc(id).update({
                status: "Çözüldü",
                resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
            }); 
        } 
        catch(e) { alert("Güncellenirken hata oluştu!"); }
    }
};

window.updateAssignee = async (id, val) => {
    try { await db.collection("arizalar").doc(id).update({ assignedTo: val }); }
    catch(e) { alert("Görevli atanırken hata!"); }
};

// Operatör listesini çek
let operatorsList = [];
db.collection('ayarlar').doc('operators').onSnapshot(doc => {
    if (doc.exists) operatorsList = doc.data().list || [];
});

// Dinamik verileri çek ve log formatında güncelle
db.collection("arizalar").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
    const openTerminal = document.getElementById('faultTerminal');
    const resolvedTerminal = document.getElementById('resolvedTerminal');
    
    if (snapshot.empty) {
        if(openTerminal) openTerminal.innerHTML = '<div class="term-line" style="color:#888;">[SİSTEM] Bekleyen açık arıza bulunamadı...</div>';
        if(resolvedTerminal) resolvedTerminal.innerHTML = '<div class="term-line" style="color:#888;">[SİSTEM] Çözülmüş arıza bulunamadı...</div>';
        if(document.getElementById('totalOpenCount')) document.getElementById('totalOpenCount').innerText = '0 kayıt';
        if(document.getElementById('totalResolvedCount')) document.getElementById('totalResolvedCount').innerText = '0 kayıt';
        return;
    }

    const faults = [];
    snapshot.forEach((doc) => {
        faults.push({ id: doc.id, ...doc.data() });
    });

    const openFaults = faults.filter(f => f.status === 'Açık');
    const resolvedFaults = faults.filter(f => f.status === 'Çözüldü');

    const renderTerminal = (faultList, isResolved) => {
        if (faultList.length === 0) return '<div class="term-line" style="color:#888;">[SİSTEM] Kayıt bulunamadı...</div>';
        
        const grouped = {
            'BUGÜN EKLENEN KAYITLAR': [],
            'ESKİ KAYITLAR': []
        };
        
        const today = new Date();
        
        faultList.forEach(fault => {
            let isToday = false;
            if (fault.createdAt) {
                const fDate = fault.createdAt.toDate();
                if (fDate.getDate() === today.getDate() && 
                    fDate.getMonth() === today.getMonth() && 
                    fDate.getFullYear() === today.getFullYear()) {
                    isToday = true;
                }
            } else {
                isToday = true;
            }
            
            if (isToday) grouped['BUGÜN EKLENEN KAYITLAR'].push(fault);
            else grouped['ESKİ KAYITLAR'].push(fault);
        });

        let html = '';

        Object.keys(grouped).forEach(groupName => {
            if (grouped[groupName].length === 0) return; 

            // Terminal Grup Başlığı
            let headerColor = groupName.includes('BUGÜN') ? '#3b82f6' : '#94a3b8';
            let icon = groupName.includes('BUGÜN') ? '🔥' : '📅';
            
            html += `
                <div style="margin-top: 1.2rem; margin-bottom: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.08); border-left: 5px solid ${headerColor}; color: white; font-weight: bold; letter-spacing: 1px;">
                    > ${icon} [ ${groupName} ] (${grouped[groupName].length} Kayıt)
                </div>
            `;

            grouped[groupName].forEach(fault => {
                const dateObj = fault.createdAt ? fault.createdAt.toDate() : new Date();
                
                // Kısa Tarih ve Saat formatı: 03.06 08:30:14
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const shortDate = `${day}.${month}`;
                const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); 
                const dateTimeStr = `${shortDate} ${timeStr}`;
                
                // Renkler
                let textColor = '#ffffff';
                const jType = fault.jobType ? fault.jobType.toUpperCase() : '';
                if (jType.includes('İSG') || jType.includes('GÜVENLİ')) { textColor = '#FF0000'; } 
                else if (jType.includes('MEKANİK')) { textColor = '#00FFFF'; } 
                else if (jType.includes('ELEKTRİK')) { textColor = '#FFFF00'; } 
                else if (jType.includes('PLANLI')) { textColor = '#FFA500'; }

                const statusIcon = isResolved ? '✓ ✓' : '⚡';
                let photoLink = fault.photoUrl ? `<a href="${fault.photoUrl}" target="_blank" style="color:#a78bfa; text-decoration:none;">[FOTO]</a>` : '';
                
                // Görevli seçimi (Terminal stili)
                let assignBtn = '';
                if (isAdmin && !isResolved) {
                    let opts = `<option value="" style="background:#0f172a; color:#fff;">Görevli Ata</option>`;
                    operatorsList.sort().forEach(op => {
                        opts += `<option value="${op}" style="background:#0f172a; color:#fff;" ${fault.assignedTo === op ? 'selected' : ''}>${op}</option>`;
                    });
                    assignBtn = `<select onchange="updateAssignee('${fault.id}', this.value)" style="background:transparent; color:#3b82f6; border:none; font-family:monospace; cursor:pointer; outline:none; font-size:1rem; padding:0; margin-left:10px;">${opts}</select>`;
                } else if (fault.assignedTo) {
                    assignBtn = `<span style="color:#3b82f6; margin-left:10px;">[Görevli: ${fault.assignedTo}]</span>`;
                }

                // Admin silme butonu
                let adminBtn = '';
                if (isAdmin) {
                    adminBtn = `<span onclick="deleteFault('${fault.id}')" style="color:#ef4444; cursor:pointer; margin-left:10px;">[SİL]</span>`;
                }

                // Satırları Tek Satır (Single Line) Terminal formatında oluştur
                html += `
                    <div class="term-line" style="margin-bottom: 0.8rem; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                        <span class="term-time">[${dateTimeStr}]</span>
                        <span class="term-content">
                            <span style="color: ${textColor}; font-weight:bold;">${statusIcon} ${jType || 'BİLİNMİYOR'} </span>
                            <span style="color: ${textColor}; font-weight:normal; font-size:0.9em;">@ ${fault.machine || ''}</span>
                            <span style="color: #cbd5e1;"> -> ${fault.description || '-'}</span> 
                            <span style="color: #64748b; font-size: 0.85rem; margin-left: 5px;">[Bldrn: ${fault.userName || '-'}]</span>
                            ${photoLink} ${assignBtn} ${adminBtn}
                        </span>
                    </div>
                `;
            });
        });
        
        return html;
    };

    if(openTerminal) openTerminal.innerHTML = renderTerminal(openFaults, false);
    if(resolvedTerminal) resolvedTerminal.innerHTML = renderTerminal(resolvedFaults, true);
    
    if(document.getElementById('totalOpenCount')) document.getElementById('totalOpenCount').innerText = `${openFaults.length} kayıt`;
    if(document.getElementById('totalResolvedCount')) document.getElementById('totalResolvedCount').innerText = `${resolvedFaults.length} kayıt`;
});
