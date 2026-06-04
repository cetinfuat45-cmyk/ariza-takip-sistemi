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
    document.querySelectorAll('.admin-col').forEach(el => el.style.display = 'table-cell');
}

window.adminLogin = async () => {
    const pass = prompt("Admin Şifresini Giriniz:");
    if (pass === "12345") { 
        sessionStorage.setItem('isAdmin', 'true');
        
        // Admin Giriş Yaptığında Mail Gönderimi (Web3Forms API - Doğrulamasız)
        try {
            const mailDoc = await db.collection('ayarlar').doc('adminEmail').get();
            if (mailDoc.exists && mailDoc.data().key && mailDoc.data().enabled !== false) {
                const accessKey = mailDoc.data().key;
                
                // Arka planda sessizce API isteği at (Doğrulama veya Captcha istemez)
                await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({
                        access_key: accessKey,
                        subject: "⚠️ SİSTEM GÜVENLİĞİ: Admin Paneline Giriş Yapıldı",
                        from_name: "Bakım Sistemi",
                        email: "sistem@bildirim.com",
                        message: `Sisteminize an itibariyle şifre ile başarılı bir Admin girişi yapılmıştır.\nTarih: ${new Date().toLocaleString('tr-TR')}`
                    })
                });
            }
        } catch(e) { console.log("Mail gönderilemedi."); }
        
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
        
        const grouped = {};
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getFullYear()).slice(-2)}`;
        
        faultList.forEach(fault => {
            const dateObj = fault.createdAt ? fault.createdAt.toDate() : new Date();
            const faultDateStr = `${String(dateObj.getDate()).padStart(2,'0')}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getFullYear()).slice(-2)}`;
            
            const rawType = fault.jobType ? fault.jobType.toUpperCase() : 'DİĞER';
            let jType = rawType;
            
            if (rawType.includes('ELEKTRİK')) jType = 'ELEKTRİK';
            else if (rawType.includes('MEKANİK')) jType = 'MEKANİK';
            else if (rawType.includes('İSG') || rawType.includes('GÜVENLİ')) jType = 'İŞ GÜVENLİĞİ';
            else if (rawType.includes('PLANLI')) jType = 'PLANLI BAKIM';
            else if (rawType.includes('TEKRAR')) jType = 'TEKRAR EDEN ARIZA';

            let groupName;
            let groupType;
            
            if (faultDateStr === todayStr) {
                groupName = `${jType}`;
                groupType = 'TODAY';
            } else {
                groupName = `${faultDateStr} ESKİ KAYITLAR`;
                groupType = 'OLD';
            }

            if (!grouped[groupName]) {
                grouped[groupName] = { type: groupType, jType: jType, faults: [] };
            }
            grouped[groupName].faults.push(fault);
        });

        let html = '';

        // Sıralama: BUGÜN olanlar en üstte (kendi içinde alfabetik İş Türü), sonra ESKİ olanlar (Tarihe göre yeniden eskiye)
        const sortedGroups = Object.keys(grouped).sort((a, b) => {
            const gA = grouped[a];
            const gB = grouped[b];
            
            if (gA.type === 'TODAY' && gB.type === 'OLD') return -1;
            if (gA.type === 'OLD' && gB.type === 'TODAY') return 1;
            
            if (gA.type === 'TODAY' && gB.type === 'TODAY') {
                return a.localeCompare(b);
            }
            
            if (gA.type === 'OLD' && gB.type === 'OLD') {
                const timeA = gA.faults[0].createdAt ? gA.faults[0].createdAt.toMillis() : 0;
                const timeB = gB.faults[0].createdAt ? gB.faults[0].createdAt.toMillis() : 0;
                return timeB - timeA;
            }
            return 0;
        });

        sortedGroups.forEach(groupName => {
            const groupData = grouped[groupName];
            if (groupData.faults.length === 0) return; 

            // Terminal Grup Başlığı
            let headerColor = '#94a3b8'; 
            
            if (groupData.type === 'TODAY') {
                if (groupData.jType.includes('ELEKTRİK')) { headerColor = '#FFFF00'; }
                else if (groupData.jType.includes('MEKANİK')) { headerColor = '#00FFFF'; }
                else if (groupData.jType.includes('GÜVENLİ')) { headerColor = '#FF0000'; }
                else if (groupData.jType.includes('PLANLI')) { headerColor = '#FFA500'; }
                else if (groupData.jType.includes('TEKRAR')) { headerColor = '#FF00FF'; }
                else { headerColor = '#3b82f6'; }
            }
            
            html += `
                <div style="margin-top: 1.2rem; margin-bottom: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.08); border-left: 5px solid ${headerColor}; color: ${headerColor}; font-weight: bold; letter-spacing: 1px;">
                    ${groupName} (${groupData.faults.length} Kayıt)
                </div>
            `;

            groupData.faults.forEach(fault => {
                const dateObj = fault.createdAt ? fault.createdAt.toDate() : new Date();
                
                // Satırlarda ARTIK SADECE SAAT var, Tarih Yok.
                const timeStr = dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); 
                
                // Renkler
                let textColor = '#ffffff';
                const jType = fault.jobType ? fault.jobType.toUpperCase() : '';
                if (jType.includes('TEKRAR')) { textColor = '#FF00FF'; } // Tekrar Eden Arıza
                else if (jType.includes('İSG') || jType.includes('GÜVENLİ')) { textColor = '#FF0000'; } 
                else if (jType.includes('MEKANİK')) { textColor = '#00FFFF'; } 
                else if (jType.includes('ELEKTRİK')) { textColor = '#FFFF00'; } 
                else if (jType.includes('PLANLI')) { textColor = '#FFA500'; }

                const statusIcon = isResolved ? '✓ ✓' : '⚡';
                let photoLink = fault.photoUrl ? `<span style="color:#a78bfa; margin-left: 5px;">[FOTOĞRAF VAR]</span>` : '';
                
                // Görevli gösterimi (Satırda sadece metin olarak kalacak, atama modal içinden yapılacak)
                let assignText = '';
                if (fault.assignedTo) {
                    assignText = `<span style="color:#3b82f6; margin-left:10px; font-size:0.85rem;">[Görevli: ${fault.assignedTo}]</span>`;
                } else if (isAdmin && !isResolved) {
                    assignText = `<span style="color:#f59e0b; margin-left:10px; font-size:0.85rem;">[Görevli Bekliyor]</span>`;
                }

                // Sadece ESKİ kayıtlarda (tarihsel gruplamada) İş Türünü satırda göster
                let jobTypeDisplay = groupData.type === 'OLD' ? `${jType || 'BİLİNMİYOR'} ` : '';
                
                // Bugünün kaydı ise özel bir sınıf ekle
                let rowClass = groupData.type === 'TODAY' ? 'today-row' : 'old-row';

                // Satırları tıklanabilir olarak oluştur (Modal açtırır)
                html += `
                    <div class="term-line fault-row ${rowClass}" onclick="openFaultModal('${fault.id}')" style="margin-bottom: 0.8rem; padding-bottom: 0.5rem; cursor: pointer;">
                        <span class="term-time">[${timeStr}]</span>
                        <span class="term-content">
                            <span style="color: ${textColor}; font-weight:bold;">${statusIcon} ${jobTypeDisplay}</span>
                            <span style="color: ${textColor}; font-weight:normal; font-size:0.9em;">${fault.machine || ''}</span>
                            <span style="color: #cbd5e1;"> -> ${fault.description || '-'}</span> 
                            <span style="color: #64748b; font-size: 0.85rem; margin-left: 5px;">[Bldrn: ${fault.userName || '-'}]</span>
                            ${photoLink} ${assignText}
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

// MODAL İŞLEMLERİ
window.allFaults = []; // Global arıza havuzu
db.collection("arizalar").onSnapshot(snap => {
    window.allFaults = [];
    snap.forEach(doc => window.allFaults.push({ id: doc.id, ...doc.data() }));
});

window.openFaultModal = (id) => {
    const fault = window.allFaults.find(f => f.id === id);
    if(!fault) return;

    const dateObj = fault.createdAt ? fault.createdAt.toDate() : new Date();
    const dateStr = dateObj.toLocaleString('tr-TR');
    
    let photoLink = fault.photoUrl ? `<div style="margin-top:1rem;"><a href="${fault.photoUrl}" target="_blank" style="color:var(--accent); font-weight:bold; text-decoration:none;">📸 FOTOĞRAFI GÖRÜNTÜLE</a></div>` : '';

    document.getElementById('faultModalBody').innerHTML = `
        <div style="margin-bottom: 0.4rem;"><strong>Tarih:</strong> <span style="color:var(--text-secondary);">${dateStr}</span></div>
        <div style="margin-bottom: 0.4rem;"><strong>Bildiren:</strong> <span style="color:var(--text-secondary);">${fault.userName || '-'}</span></div>
        <div style="margin-bottom: 0.4rem;"><strong>İş Türü:</strong> <span style="color:var(--text-secondary);">${fault.jobType || '-'}</span></div>
        <div style="margin-bottom: 0.4rem;"><strong>Bölüm / Maliyet M.:</strong> <span style="color:var(--text-secondary);">${fault.costCenter || '-'}</span></div>
        <div style="margin-bottom: 0.4rem;"><strong>Makine / Ekipman:</strong> <span style="color:var(--text-secondary);">${fault.machine || '-'}</span></div>
        <div style="margin-bottom: 0.4rem;"><strong>Vardiya:</strong> <span style="color:var(--text-secondary);">${fault.shift || '-'}</span></div>
        <div style="margin-bottom: 0.4rem;"><strong>Durum:</strong> <span style="color:var(--text-secondary);">${fault.status}</span></div>
        <div style="margin-bottom: 0.4rem;"><strong>Görevli:</strong> <span style="color:var(--text-secondary);">${fault.assignedTo || 'Henüz Atanmadı'}</span></div>
        
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
            <strong style="color:white;">Açıklama:</strong><br>
            <span style="color: #cbd5e1;">${fault.description || '-'}</span>
        </div>
        ${photoLink}
    `;

    let actionsHtml = '';
    
    // Admin yetkisi varsa butonları çiz
    if (isAdmin) {
        let assignSection = '';
        if (fault.status !== 'Çözüldü') {
            let opts = `<option value="">Görevli Seç...</option>`;
            operatorsList.sort().forEach(op => {
                opts += `<option value="${op}" ${fault.assignedTo === op ? 'selected' : ''}>${op}</option>`;
            });
            assignSection = `
                <div style="flex: 1; margin-right: 1rem;">
                    <label style="display:block; font-size:0.8rem; margin-bottom:0.3rem;">Operatör Ata/Değiştir:</label>
                    <select onchange="updateAssigneeAndClose('${fault.id}', this.value)" style="padding: 0.6rem; border-radius: 8px;">
                        ${opts}
                    </select>
                </div>
            `;
        }
        
        actionsHtml = `
            ${assignSection}
            <div style="display: flex; align-items: flex-end;">
                <button onclick="deleteFaultAndClose('${fault.id}')" style="background:var(--danger); width:auto; padding:0.6rem 1rem; margin:0;">🗑️ Kaydı Sil</button>
            </div>
        `;
    }

    document.getElementById('faultModalActions').innerHTML = actionsHtml;
    document.getElementById('faultModal').classList.remove('hidden');
};

window.closeFaultModal = () => {
    document.getElementById('faultModal').classList.add('hidden');
};

window.updateAssigneeAndClose = async (id, val) => {
    await window.updateAssignee(id, val);
    closeFaultModal();
};

window.deleteFaultAndClose = async (id) => {
    await window.deleteFault(id);
    closeFaultModal();
};
