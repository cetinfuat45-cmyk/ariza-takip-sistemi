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

// Dinamik verileri çek ve tabloyu güncelle
db.collection("arizalar").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
    const openTbody = document.getElementById('faultTableBody');
    const resolvedTbody = document.getElementById('resolvedTableBody');
    
    if (snapshot.empty) {
        openTbody.innerHTML = `<tr><td colspan="${isAdmin ? 11 : 10}" style="text-align:center;">Henüz hiç kayıt yok.</td></tr>`;
        resolvedTbody.innerHTML = `<tr><td colspan="${isAdmin ? 12 : 11}" style="text-align:center;">Henüz çözülmüş kayıt yok.</td></tr>`;
        document.getElementById('totalOpen').innerText = 0;
        document.getElementById('totalResolved').innerText = 0;
        document.getElementById('totalToday').innerText = 0;
        return;
    }

    const faults = [];
    snapshot.forEach((doc) => {
        faults.push({ id: doc.id, ...doc.data() });
    });

    const openFaults = faults.filter(f => f.status === 'Açık');
    const resolvedFaults = faults.filter(f => f.status === 'Çözüldü');

    // Gruplandırma Fonksiyonu
    const renderGroupedTable = (faultList, isResolved, baseColSpan) => {
        if (faultList.length === 0) return '';
        
        const grouped = {};
        faultList.forEach(fault => {
            const type = fault.jobType ? fault.jobType.toUpperCase() : 'DİĞER KAYITLAR';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(fault);
        });

        let html = '';
        const currentColSpan = isAdmin ? baseColSpan + 1 : baseColSpan;
        
        Object.keys(grouped).forEach(type => {
            let bgColor = '#cbd5e1'; 
            let textColor = '#0f172a';
            
            if (type.includes('İSG') || type.includes('GÜVENLİK')) { bgColor = '#ea580c'; textColor = 'white'; } 
            else if (type.includes('MEKANİK')) { bgColor = '#67e8f9'; } 
            else if (type.includes('ELEKTRİK')) { bgColor = '#fde047'; } 
            else if (type.includes('PLANLI')) { bgColor = '#f59e0b'; }

            html += `
                <tr style="background: ${bgColor}; color: ${textColor};">
                    <td colspan="${currentColSpan}" style="font-weight: 800; font-size: 1.05rem; padding: 0.6rem; border-left: 5px solid #0f172a; text-align: left;">
                        ${type} (${grouped[type].length})
                    </td>
                </tr>
            `;

            grouped[type].forEach(fault => {
                const dateStr = fault.createdAt ? new Date(fault.createdAt.toDate()).toLocaleString('tr-TR') : 'Şimdi';
                let photoLink = fault.photoUrl ? `<a href="${fault.photoUrl}" target="_blank" style="color:var(--accent)">Foto Gör</a>` : '-';
                const rowBg = `${bgColor}33`; 
                const id = fault.id;

                let assigneeHtml = fault.assignedTo || '-';
                if (isAdmin) {
                    let opts = `<option value="" style="background:white; color:black;">Görevli Seç</option>`;
                    operatorsList.sort().forEach(op => {
                        opts += `<option value="${op}" style="background:white; color:black;" ${fault.assignedTo === op ? 'selected' : ''}>${op}</option>`;
                    });
                    assigneeHtml = `<select onchange="updateAssignee('${id}', this.value)" style="padding:0.4rem 0.5rem; background:#f8fafc; color:#0f172a; font-weight:600; border:2px solid #3b82f6; border-radius:8px; width:auto; min-width:160px; max-width:250px; cursor:pointer;">${opts}</select>`;
                }

                let adminCol = '';
                if (isAdmin) {
                    adminCol = `<td data-label="İşlem" style="text-align:center;">
                        <button onclick="deleteFault('${id}')" style="background:transparent; border:none; color:#ef4444; padding:0; margin:0; width:auto; font-size:1.3rem; cursor:pointer;" title="Kayıt Sil">🗑️</button>
                    </td>`;
                }

                if (!isResolved) {
                    html += `
                        <tr style="background: ${rowBg}; color: white;">
                            <td data-label="Tarih">${dateStr}</td>
                            <td data-label="Bildiren">${fault.userName || '-'}</td>
                            <td data-label="Bölüm">${fault.costCenter || '-'}</td>
                            <td data-label="Makine">${fault.machine || '-'}</td>
                            <td data-label="Vardiya">${fault.shift || '-'}</td>
                            <td data-label="İş Türü"><b>${fault.jobType || '-'}</b></td>
                            <td data-label="Açıklama" style="max-width: 200px; overflow:hidden; text-overflow:ellipsis;">${fault.description || '-'}</td>
                            <td data-label="Fotoğraf">${photoLink}</td>
                            <td data-label="Görevli">${assigneeHtml}</td>
                            <td data-label="Durum"><span class="status-badge status-acik">Açık</span></td>
                            ${adminCol}
                        </tr>
                    `;
                } else {
                    const resolvedDateStr = fault.resolvedAt ? new Date(fault.resolvedAt.toDate()).toLocaleString('tr-TR') : 'Şimdi';
                    html += `
                        <tr style="background: ${rowBg}; color: white;">
                            <td data-label="Bildirim">${dateStr}</td>
                            <td data-label="Çözülme">${resolvedDateStr}</td>
                            <td data-label="Bildiren">${fault.userName || '-'}</td>
                            <td data-label="Bölüm">${fault.costCenter || '-'}</td>
                            <td data-label="Makine">${fault.machine || '-'}</td>
                            <td data-label="Vardiya">${fault.shift || '-'}</td>
                            <td data-label="İş Türü"><b>${fault.jobType || '-'}</b></td>
                            <td data-label="Açıklama" style="max-width: 200px; overflow:hidden; text-overflow:ellipsis;">${fault.description || '-'}</td>
                            <td data-label="Fotoğraf">${photoLink}</td>
                            <td data-label="Görevli">${assigneeHtml}</td>
                            <td data-label="Durum"><span class="status-badge status-cozuldu">Çözüldü</span></td>
                            ${adminCol}
                        </tr>
                    `;
                }
            });
        });
        
        return html;
    };

    openTbody.innerHTML = renderGroupedTable(openFaults, false, 10) || `<tr><td colspan="${isAdmin ? 11 : 10}" style="text-align:center;">Harika! Açık arıza bulunmuyor.</td></tr>`;
    resolvedTbody.innerHTML = renderGroupedTable(resolvedFaults, true, 11) || `<tr><td colspan="${isAdmin ? 12 : 11}" style="text-align:center;">Henüz çözülmüş kayıt yok.</td></tr>`;
    
    document.getElementById('totalOpen').innerText = openFaults.length;
    document.getElementById('totalResolved').innerText = resolvedFaults.length;
    document.getElementById('totalToday').innerText = faults.length;
});
