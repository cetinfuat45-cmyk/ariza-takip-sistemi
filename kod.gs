const SHEET_ID = '15uSQ-RW5FSTDM1jp2Oc41seCooPGSf1oavohK098q1s';

/**
 * =========================================================
 * 🔴 DİKKAT 🔴 "MailApp.sendEmail İzniniz Yok" HATASI İÇİN: 
 * Lütfen yukarıdaki "Çalıştır" (Run) tuşunun solundaki isim
 * kutucuğuna tıklayıp "YETKI_AL_MAIL" seçeneğini seç!
 * VE ÇALIŞTIR TUŞUNA BAS (Çıkan Pencerede "İzin Ver"e bas)
 * =========================================================
 */
function YETKI_AL_MAIL() {
  MailApp.sendEmail(Session.getActiveUser().getEmail() || "ornek@ornek.com", "Aylık Bakım Botu Yetkisi", "Tebrikler! Google Email onayını başarıyla verdiniz. Artık hatalar tamamen çözüldü!");
}

/**
 * Web Uygulamasını Başlatır (HTML sayfasını ekrana basar).
 */
function doGet() {
  var tmp = HtmlService.createTemplateFromFile('index');
  return tmp.evaluate()
    .setTitle("Aylık Bakım Sistemi")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
}

/**
 * İlk Kurulum: Veritabanı (4 Sekme) Otomatik Oluşturulur.
 * Bu fonksiyon bir kere manuel çalıştırılır.
 */
function kurulumYap() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // 1. BAKIM_PLANLARI (Admin Şablonları)
  let sheet1 = ss.getSheetByName('BAKIM_PLANLARI');
  if (!sheet1) {
    sheet1 = ss.insertSheet('BAKIM_PLANLARI');
    sheet1.appendRow(['MAKİNE SEÇ', 'KULLANILACAK PARÇA', 'YAPILACAK BAKIM', 'İstenen Değer', 'FOTO İSTEK', 'YAPILACAK İŞ RESMİ', 'SORUMLU OPERATÖR', 'BAKIM YAPAN BİRİM']);
    sheet1.getRange('A1:H1').setFontWeight('bold').setBackground('#fbc531').setFontColor('#2f3640');
  }

  // 2. YAPILAN_BAKIMLAR (Operatör Arşivi)
  let sheet2 = ss.getSheetByName('YAPILAN_BAKIMLAR');
  if (!sheet2) {
    sheet2 = ss.insertSheet('YAPILAN_BAKIMLAR');
    sheet2.appendRow(['1Bakım Tarihi', 'MAKİNE ID', 'MAKİNE ADI', 'YAPILAN BAKIM', 'Açıklama / Ölçüm Değeri', 'Kontrol Değeri (OK/RED)', 'BAKIM SÜRESİ DK', '-BAKIM RESM', 'BAKIMI YAPAN']);
    sheet2.getRange('A1:I1').setFontWeight('bold').setBackground('#4cd137').setFontColor('#ffffff');
  }

  // 3. MAKINE_LISTESI (Statik Makine Verileri)
  let sheet3 = ss.getSheetByName('MAKİNE_LİSTESİ');
  if (!sheet3) {
    sheet3 = ss.insertSheet('MAKİNE_LİSTESİ');
    sheet3.appendRow(['Makine Adı', 'Makine ID', 'Bulunduğu Bölüm', 'Bölüm Resmi Linki']);
    sheet3.getRange('A1:D1').setFontWeight('bold').setBackground('#00a8ff').setFontColor('#ffffff');
    sheet3.appendRow(['Kompresör-1', 'KMP-001', 'Kazan Dairesi', '']);
    sheet3.appendRow(['Enjeksiyon-A', 'ENJ-00A', 'Üretim Katı', '']);
  }

  // 4. KULLANICI_BILGILERI (Login ve Yetki Verileri)
  let sheet4 = ss.getSheetByName('KULLANICI_BİLGİLERİ');
  if (!sheet4) {
    sheet4 = ss.insertSheet('KULLANICI_BİLGİLERİ');
    sheet4.appendRow(['Ad Soyad', 'Şifre/PIN', 'Yetki (Admin/Operatör)', 'E-Posta Adresi', 'Telegram Chat ID', 'Telegram Bot Token']);
    sheet4.getRange('A1:F1').setFontWeight('bold').setBackground('#8c7ae6').setFontColor('#ffffff');
    sheet4.appendRow(['Fuat YÖNETİCİ', '1234', 'Admin', 'fuat@ornek.com', '123456789', 'TOKEN_BURAYA']);
    sheet4.appendRow(['Ahmet OPERATÖR', '5555', 'Operatör', 'ahmet@ornek.com', '', '']);
  }

  // Varsayılan sayfa 1 silinir (Eğer boşsa)
  let defaultSheet = ss.getSheetByName('Sayfa1');
  if (defaultSheet) {
    ss.deleteSheet(defaultSheet);
  }
}

/**
 * Google Drive üzerinde "aylık bakım" ana klasörünü ve alt klasörleri oluşturur.
 * Eğer klasörler zaten varsa, yeniden oluşturmaz, mevcut olanların ID'sini kullanır.
 * NOT: Klasörler tamamen Yazarın/Adminin Drive'ında AÇIK ve GÖRÜNÜR (gizli olmayan) standart klasörlerdir.
 */
function driveKlasorYapilanlandir() {
  const anaKlasorAdi = "aylık bakım";
  const altKlasor1Adi = "istenen foto";
  const altKlasor2Adi = "yapılack iş foto";

  let anaKlasor;
  const anaKlasorArama = DriveApp.getFoldersByName(anaKlasorAdi);
  
  if (anaKlasorArama.hasNext()) {
    anaKlasor = anaKlasorArama.next();
  } else {
    // Ana klasör yoksa oluştur (Açık ve görünür)
    anaKlasor = DriveApp.createFolder(anaKlasorAdi);
  }

  // İstenen İş Foto alt klasörü
  let altKlasor1Id = null;
  const alt1Arama = anaKlasor.getFoldersByName(altKlasor1Adi);
  if (alt1Arama.hasNext()) {
    altKlasor1Id = alt1Arama.next().getId();
  } else {
    altKlasor1Id = anaKlasor.createFolder(altKlasor1Adi).getId();
  }

  // Yapılan İş Foto alt klasörü
  let altKlasor2Id = null;
  const alt2Arama = anaKlasor.getFoldersByName(altKlasor2Adi);
  if (alt2Arama.hasNext()) {
    altKlasor2Id = alt2Arama.next().getId();
  } else {
    altKlasor2Id = anaKlasor.createFolder(altKlasor2Adi).getId();
  }

  // Klasör ID'lerini geri döndür (Diğer fonksiyonlarda resim yüklerken kullanacağız)
  return {
    ana: anaKlasor.getId(),
    istenen: altKlasor1Id,
    yapilan: altKlasor2Id
  };
}

// ==============================================================================
// 1. ADMIN ARAYÜZÜ İÇİN VERİ ÇEKME FONKSİYONLARI
// ==============================================================================

/**
 * Admin Panelindeki "Makine Listesi" ve "Sorumlu Operatör Listesi"ni döndürür.
 * Aynı zamanda Sayfa 1'de (Bakım Planları) halihazırda planı olanları da belirler.
 */
function getAdminPanelVerileri() {
  const result = { makineler: [], operatorler: [], planliMakineler: [], birimler: [], error: null };
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    // A) Makine Listesi (Sayfa 3)
    try {
      const sheetMakine = ss.getSheetByName('MAKİNE_LİSTESİ');
      if (sheetMakine) {
        const makineData = sheetMakine.getDataRange().getValues();
        for (let i = 1; i < makineData.length; i++) {
          if (makineData[i][0]) {
            result.makineler.push({
              ad: makineData[i][0],
              id: makineData[i][1] || "",
              bolum: makineData[i][1] || "BİLİNMEYEN",
              vSutunu: makineData[i][21] || 0
            });
          }
        }
      }
    } catch(e) { console.error("Makine listesi hatası: " + e.message); }

    // B) Sorumlu Operatör Listesi ve Birim Listesi (Sayfa 4)
    try {
      const sheetKullanici = ss.getSheetByName('KULLANICI_BİLGİLERİ');
      if (sheetKullanici) {
        const kullaniciData = sheetKullanici.getDataRange().getValues();
        for (let i = 1; i < kullaniciData.length; i++) {
          if (kullaniciData[i][0]) result.operatorler.push(kullaniciData[i][0]);
          if (kullaniciData[i][12]) {
            const b = kullaniciData[i][12].toString().trim();
            if (result.birimler.indexOf(b) === -1) result.birimler.push(b);
          }
        }
      }
    } catch(e) { console.error("Kullanıcı listesi hatası: " + e.message); }

    // C) Halihazırda Planı Olan Makineler (Sayfa 1)
    try {
      const sheetPlan = ss.getSheetByName('BAKIM_PLANLARI');
      if (sheetPlan) {
        const planData = sheetPlan.getDataRange().getValues();
        for (let i = 1; i < planData.length; i++) {
          if (planData[i][0]) {
            result.planliMakineler.push({
              satirNo: i + 1,
              ad: planData[i][0].toString().trim(),
              parca: planData[i][1] || "",
              bakim: planData[i][2] || "",
              deger: planData[i][3] || "",
              fotoZorunlu: planData[i][4] || "HAYIR",
              resimUrl: planData[i][5] || "",
              sorumlu: planData[i][6] ? planData[i][6].toString().trim() : "TÜMÜ",
              birim: planData[i][7] || ""
            });
          }
        }
      }
    } catch(e) { console.error("Plan listesi hatası: " + e.message); }

    // D) RED Analiz
    try {
      const sheetYapilan = ss.getSheetByName('YAPILAN_BAKIMLAR');
      if (sheetYapilan) {
        const yapilanData = sheetYapilan.getDataRange().getValues();
        const redMakineler = new Set();
        const bugun = new Date();
        for (let i = yapilanData.length - 1; i >= 1; i--) {
          const islemTarihi = new Date(yapilanData[i][0]);
          if (isNaN(islemTarihi.getTime())) continue;
          if ((bugun - islemTarihi) / (1000 * 3600 * 24) > 7) continue; 
          if (yapilanData[i][5] === "RED") {
            redMakineler.add(yapilanData[i][2] ? yapilanData[i][2].toString().trim() : "");
          }
        }
        result.makineler.forEach(m => {
          m.hasRed = redMakineler.has(m.ad ? m.ad.toString().trim() : "");
        });
      }
    } catch(e) { console.error("RED analiz hatası: " + e.message); }

  } catch(globalError) {
    result.error = globalError.message;
  }
  
  return JSON.stringify(result);
}

/**
 * Son 30 gün içindeki tüm RED (Hatalı) kayıtları makine bazlı gruplayarak döndürür.
 * Hem Admin hem de Operatör ekranında analiz için kullanılacaktır.
 */
function getRedAnalizVerileri() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetYapilan = ss.getSheetByName('YAPILAN_BAKIMLAR');
    const yapilanData = sheetYapilan.getDataRange().getValues();
    
    const analizResult = {};
    const bugun = new Date();
    
    for (let i = yapilanData.length - 1; i >= 1; i--) {
      const islemTarihi = new Date(yapilanData[i][0]);
      if (isNaN(islemTarihi.getTime())) continue;
      
      const farkGun = (bugun.getTime() - islemTarihi.getTime()) / (1000 * 3600 * 24);
      if (farkGun > 30) continue; 
      
      if (yapilanData[i][5] === "RED") {
        const makineAdi = yapilanData[i][2] ? yapilanData[i][2].toString().trim() : "BİLİNMEYEN";
        if (!analizResult[makineAdi]) analizResult[makineAdi] = [];
        
        analizResult[makineAdi].push({
          satirNo: i + 1,
          tarih: yapilanData[i][0],
          is: yapilanData[i][3],
          aciklama: yapilanData[i][4],
          yapan: yapilanData[i][8],
          resim: yapilanData[i][7]
        });
      }
    }
    return JSON.stringify(analizResult);
  } catch(e) {
    return JSON.stringify({ hata: e.toString() });
  }
}

/**
 * Belirtilen satırdaki RED kaydını OK olarak günceller.
 */
function setRedOk(satirNo) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetYapilan = ss.getSheetByName('YAPILAN_BAKIMLAR');
    const satir = parseInt(satirNo, 10);
    
    if (satir > 1) {
      // 6. sütun (Index 5) Kontrol Değeri (OK/RED)
      sheetYapilan.getRange(satir, 6).setValue("OK");
      // İsteğe bağlı: Tarihi de o anki tarihle güncelleyebiliriz (1. sütun)
      // sheetYapilan.getRange(satir, 1).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm"));
      
      return "Kayıt başarıyla 'OK' olarak güncellendi.";
    }
    return "Hata: Geçersiz satır numarası.";
  } catch (e) {
    return "Hata: " + e.toString();
  }
}

// ==============================================================================
// 2. OPERATÖR (KULLANICI) ARAYÜZÜ İÇİN VERİ ÇEKME FONKSİYONU
// ==============================================================================

/**
 * Sisteme giren operatöre sadece V Sütunu = 1 olan ve "BU HAFTA İÇİNDE SAYFA 2'YE YAZILMAMIŞ"
 * olan kendisine ait işleri döndürür.
 */
function getOperatorGorevleri(operatorAdi) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // 1. O hafta yapılmış olanları tespit et (Sayfa 2 - YAPILAN_BAKIMLAR)
  const sheetYapilan = ss.getSheetByName('YAPILAN_BAKIMLAR');
  const yapilanData = sheetYapilan.getDataRange().getValues();
  
  // Mevcut Haftayı hesapla
  const islerTarihcesi = [];
  const bugun = new Date();
  const currentWeek = getISOWeek(bugun);
  const currentMonthIdx = bugun.getMonth(); // 0-11
  
  for (let i = 1; i < yapilanData.length; i++) {
    const islemTarihi = new Date(yapilanData[i][0]);
    if (isNaN(islemTarihi.getTime())) continue;

    // Bu hafta (Son 7 gün de olabilir ama hafta numarası daha kesin)
    if (getISOWeek(islemTarihi) === currentWeek && islemTarihi.getFullYear() === bugun.getFullYear()) { 
      const makineAdiDB = yapilanData[i][2] ? yapilanData[i][2].toString().trim() : "";
      const yapilanIsDB = yapilanData[i][3] ? yapilanData[i][3].toString().trim() : "";
      const sonucDB = yapilanData[i][5] ? yapilanData[i][5].toString().trim() : "";
      const aciklamaDB = yapilanData[i][4] ? yapilanData[i][4].toString().trim() : "";
      const resimUrlDB = yapilanData[i][7] ? yapilanData[i][7].toString().trim() : "";
      islerTarihcesi.push({ 
        ad: makineAdiDB, 
        is: yapilanIsDB, 
        sonuc: sonucDB, 
        aciklama: aciklamaDB, 
        resimUrl: resimUrlDB,
        zamanMs: islemTarihi.getTime(),
        satirNo: i + 1
      });
    }
  }

  // 2. Zamanı Gelen Makine/Müşterileri Tespit Et (Sayfa 3 - MAKİNE_LİSTESİ)
  const sheetMakine = ss.getSheetByName('MAKİNE_LİSTESİ');
  const makineData = sheetMakine.getDataRange().getValues();
  
  // 3. Planları (Admin'in atadığı görevleri) Sayfa 1'den Oku
  const sheetPlan = ss.getSheetByName('BAKIM_PLANLARI');
  const planData = sheetPlan.getDataRange().getValues();
  
  const zamaniGelenMakineler = []; 

  for (let i = 1; i < makineData.length; i++) {
    const makAdi = makineData[i][0] ? makineData[i][0].toString().trim() : "";
    const makID = makineData[i][1] ? makineData[i][1].toString().trim() : ("TANIMSIZ-" + i);
    
    // Resime göre haftayı bul: C-N sütunları (indeks 2-13) ayları temsil eder (A1-A12)
    // Mevcut ayın sütunundaki değer ile mevcut hafta numarasını karşılaştırıyoruz.
    const planliHafta = makineData[i][2 + currentMonthIdx]; 
    const vDegeri = makineData[i][21]; // Manuel Zorunlu Tutma (V Sütunu)

    // SADECE BU HAFTANIN MAKİNELERİ:
    // 1. Plandaki hafta numarası şu anki hafta numarasına eşitse
    // 2. Veya V sütunu zorunlu olarak 1 işaretlenmişse
    // 3. Veya zaten bu hafta içinde bir işlem yapılmışsa (Tarihçe'de varsa)
    const buHaftaYapilmisMi = islerTarihcesi.some(h => h.ad === makAdi);
    const makBolum = makineData[i][1] ? makineData[i][1].toString().trim() : "GENEL";
    
    if (planliHafta == currentWeek || vDegeri == 1 || buHaftaYapilmisMi) {
      zamaniGelenMakineler.push({ ad: makAdi, id: makID, bolum: makBolum });
    }
  }

  const kullanicininIsleri = [];

  for (let j = 0; j < zamaniGelenMakineler.length; j++) {
    const zgMakine = zamaniGelenMakineler[j];

    // Bu makinenin ADMIN tarafından atanmış (Sayfa 1'de) planlarını BUL (Hepsi)
    // planData'nın ilk satırı başlık olduğu için slice(1) ile başlıklardan sonraki verilere bakılır.
    // Ancak, planData.filter() zaten tüm satırları kontrol edecektir, bu yüzden slice(1) burada gereksiz olabilir
    // ve eğer başlık satırında makine adı varsa yanlış eşleşmeye neden olabilir.
    // Doğru eşleşme için planData.slice(1) kullanmak daha güvenlidir.
    const makineninPlanlari = planData.slice(1).filter(satir => 
      satir[0] && satir[0].toString().trim() === zgMakine.ad
    );

    if (makineninPlanlari.length > 0) {
      // Makineye ait bütün görevleri sırasıyla ekle
      makineninPlanlari.forEach(planBulan => {
        const pParca = planBulan[1]; // KULLANILACAK PARÇA (B sütunu)
        const pBakim = planBulan[2]; // YAPILACAK BAKIM (C sütunu)
        const pIstenenDeger = planBulan[3]; // İstenen Değer (D sütunu)
        const pFotoIstek = planBulan[4]; // FOTO İSTEK (E sütunu)
        const pIsResmi = planBulan[5]; // YAPILACAK İŞ RESMİ (F sütunu)
        const pSorumlu = planBulan[6] ? planBulan[6].toString().trim() : ""; // SORUMLU OPERATÖR (G sütunu)

        // Bu spesifik iş daha önce 'islerTarihcesi' listesine girmiş mi?
        const bitmisTarihceObj = islerTarihcesi.find(his => his.ad === zgMakine.ad && his.is === (pBakim ? pBakim.toString().trim() : ""));

        kullanicininIsleri.push({
          makineAdi: zgMakine.ad,
          makineID: zgMakine.id,
          makineBolum: zgMakine.bolum,
          planVarMi: true,
          kullanilacakParca: pParca,
          yapilacakBakim: pBakim,
          istenenDeger: pIstenenDeger,
          fotoIstek: pFotoIstek,
          isResmiUrl: pIsResmi, // ADMIN'in Kılavuz Resmi (Conflict Fix: Burası sabit kalmalı)
          sorumlu: pSorumlu,
          kendisineMiAit: (pSorumlu === operatorAdi.trim() || pSorumlu.toUpperCase() === "TÜMÜ" || pSorumlu === ""),
          yapildiMi: !!bitmisTarihceObj,
          sonucDurumu: bitmisTarihceObj ? bitmisTarihceObj.sonuc : "",
          aciklama: bitmisTarihceObj ? bitmisTarihceObj.aciklama : "",
          kanitResmiUrl: bitmisTarihceObj ? bitmisTarihceObj.resimUrl : "", 
          satirNo: bitmisTarihceObj ? bitmisTarihceObj.satirNo : -1, 
          sure: 0,
          zamanMs: bitmisTarihceObj ? bitmisTarihceObj.zamanMs : 0,
          birim: planBulan[7] || "" // H Sütunu
        });
      });
    } else {
      // Admin HİÇ plan YAPMAMIŞ!
      kullanicininIsleri.push({
        makineAdi: zgMakine.ad,
        makineID: zgMakine.id,
        makineBolum: zgMakine.bolum,
        planVarMi: false,
        kullanilacakParca: "-",
        yapilacakBakim: "Admin henüz bu makineye bakım şablonu oluşturmamış! Lütfen yöneticinize şablon açmasını söyleyiniz.",
        istenenDeger: "",
        fotoIstek: "HAYIR",
        isResmiUrl: "",
        sorumlu: "Plan Yok",
        kendisineMiAit: false,
        yapildiMi: false
      });
    }
  }

  return JSON.stringify(kullanicininIsleri);
}

// ==============================================================================
// 3. ADMIN VERİ KAYDETME (Şablon Oluşturma) FONKSİYONU
// ==============================================================================
function kaydetAdminGorevi(veriObj) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetPlan = ss.getSheetByName('BAKIM_PLANLARI');
    
    // Klasörleri al (Resim yüklenmişse)
    const klasorler = driveKlasorYapilanlandir();
    let resimUrl = "";

    if (veriObj.base64Resim) {
      const klasor = DriveApp.getFolderById(klasorler.istenen);
      const resimBlob = Utilities.newBlob(Utilities.base64Decode(veriObj.base64Resim.split(',')[1]), 'image/jpeg', veriObj.makineAdi + "_kilavuz.jpg");
      const dosya = klasor.createFile(resimBlob);
      dosya.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      resimUrl = dosya.getUrl();
    }

    // Güncelleme (Edit) mi Ekleme mi Yapıyoruz?
    const guncellenecekSatir = parseInt(veriObj.hedefSatir, 10);
    const pData = sheetPlan.getDataRange().getValues();

    let resimSutu = "";
    if (resimUrl !== "") {
      resimSutu = resimUrl; // Yeni resim eklendiyse kesinlikle onu al
    } else {
      if (veriObj.resmiSil === true) {
        resimSutu = ""; // Resim yok ve SİL dendi
      } else {
        // Düzenleme ise var olan eski resmi koru
        resimSutu = (guncellenecekSatir > 0 && guncellenecekSatir <= pData.length) ? pData[guncellenecekSatir-1][5] : "";
      }
    }

    const satirDizisi = [
      veriObj.makineAdi,
      veriObj.parca,
      veriObj.bakimTarihi, 
      veriObj.istenenDeger,
      veriObj.fotoZorunluMu ? "EVET" : "HAYIR",
      resimSutu,
      veriObj.sorumluKisi,
      veriObj.bakimBirimi // H Sütunu (Index 7)
    ];

    if (guncellenecekSatir > 0) {
      // MEVCUT OLANI DÜZENLE/GÜNCELLE
      sheetPlan.getRange(guncellenecekSatir, 1, 1, 8).setValues([satirDizisi]);
      return { status: "ok", message: "Plan Başarıyla Düzenlendi!", resimUrl: resimSutu };
    } else {
      // YENİ EKLE
      sheetPlan.appendRow(satirDizisi);
      return { status: "ok", message: "Plan Başarıyla Oluşturuldu!", resimUrl: resimSutu };
    }

  } catch(e) {
    return "Hata: " + e.toString();
  }
}

// ==============================================================================
// 4. OPERATÖR İŞ BİTİRME (KAYDETME) FONKSİYONU
// ==============================================================================
function kaydetOperatorGorevi(veriObj) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetYapilan = ss.getSheetByName('YAPILAN_BAKIMLAR');
    
    // Düzenleme mi yenileme mi?
    const hedefSatir = parseInt(veriObj.hedefSatir, 10);
    const pData = sheetYapilan.getDataRange().getValues();
    
    // Klasörleri al (Suistimal Engelleyici Damgalı Resim)
    const klasorler = driveKlasorYapilanlandir();
    let resimUrl = "-"; // Eğer Yoksa boş koy

    if (veriObj.base64Resim) {
      const klasor = DriveApp.getFolderById(klasorler.yapilan);
      // Frontend JS Canvas tarafında isim-tarih yazılıp gömülerek buraya gelmiş olacak
      const dosyaAdi = veriObj.operatorAdi + "_" + veriObj.makineID + "_" + new Date().getTime() + ".jpg";
      const resimBlob = Utilities.newBlob(Utilities.base64Decode(veriObj.base64Resim.split(',')[1]), 'image/jpeg', dosyaAdi);
      const dosya = klasor.createFile(resimBlob);
      dosya.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      resimUrl = dosya.getUrl();
    } else {
      // Düzenleme yapılıyorsa ve yeni resim yüklenmediyse, eski resmi koru
      if (hedefSatir > 1 && hedefSatir <= pData.length) {
        resimUrl = pData[hedefSatir - 1][7] || "-";
      }
    }

    // ['1Bakım Tarihi', 'MAKİNE ID', 'MAKİNE ADI', 'YAPILAN BAKIM', 'Açıklama / Ölçüm Değeri', 'Kontrol Değeri (OK/RED)', 'BAKIM SÜRESİ DK', '-BAKIM RESM', 'BAKIMI YAPAN']
    const islemTarihi = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy HH:mm");
    
    const satirDizisi = [
      islemTarihi,
      veriObj.makineID,
      veriObj.makineAdi,
      veriObj.yapilanBakim,
      veriObj.aciklamaVeyaDeger,
      veriObj.kontrolOKMu ? "OK" : "RED",
      veriObj.sureDk,
      resimUrl,
      veriObj.operatorAdi
    ];

    if (hedefSatir > 1) {
      // GÜNCELLE
      sheetYapilan.getRange(hedefSatir, 1, 1, 9).setValues([satirDizisi]);
      return "İşlem Başarıyla Güncellendi!";
    } else {
      // YENİ EKLE
      sheetYapilan.appendRow(satirDizisi);
      return "İşlem Başarıyla Kaydedildi!";
    }
  } catch(e) {
    return "Hata: " + e.toString();
  }
}

function operatorTopluRaporGonder(makineAdi, operatorAdi, makineBarkodu, islerText) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetKullanici = ss.getSheetByName('KULLANICI_BİLGİLERİ');
    const kulData = sheetKullanici.getDataRange().getValues();
    
    let aliciMail = "";
    let CHAT_ID = "";
    let BOT_TOKEN = "";
    let opFoto = ""; // YENİ: Operatör Profil Fotoğrafı

    // 1) Operatörün Kendi Satırındaki E-Posta ve Telegram Bilgilerini Bul (Sayfa 4)
    for (let i = 1; i < kulData.length; i++) {
       if (kulData[i][0] && kulData[i][0].toString().trim() === operatorAdi.trim()) {
           aliciMail = kulData[i][3] ? kulData[i][3].toString().trim() : ""; // D Sütunu (İndeks 3)
           CHAT_ID = kulData[i][4] ? kulData[i][4].toString().trim() : "";   // E Sütunu (İndeks 4)
           BOT_TOKEN = kulData[i][5] ? kulData[i][5].toString().trim() : ""; // F Sütunu (İndeks 5)
           opFoto = kulData[i][6] ? kulData[i][6].toString().trim() : "";    // G Sütunu (İndeks 6)
           break;
       }
    }
    
    // Drive linkini thumbnail linkine çevir (Helper Logic)
    function getPdfThumb(url, szParam = "sz=w200") {
      if(!url || !url.includes("drive.google.com")) return url;
      let id = "";
      if (url.includes("/d/")) id = url.split("/d/")[1].split("/")[0];
      else if (url.includes("id=")) id = url.split("id=")[1].split("&")[0];
      return id ? "https://drive.google.com/thumbnail?id=" + id + "&" + szParam : url;
    }
    
    // Rapor (PDF) için ideal ikon boyutları
    const opFotoThumb = opFoto ? getPdfThumb(opFoto, "sz=w200") : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    // Telegram için ideal çözünürlük
    const opFotoTelegram = opFoto ? getPdfThumb(opFoto, "sz=w200") : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

    // PDF Raporu için Base64 Çevrimi (Resmin kesin görünmesi için)
    let opFotoBase64 = "";
    try {
      if (opFoto && opFoto !== "") {
        const res = UrlFetchApp.fetch(opFotoThumb);
        const b = res.getBlob();
        opFotoBase64 = "data:" + b.getContentType() + ";base64," + Utilities.base64Encode(b.getBytes());
      }
    } catch(e) {}
    
    const zamanTxt = new Date().toLocaleString("tr-TR");
    const gunTxt = new Date().toLocaleDateString("tr-TR");

    // 4. Bakım Takip Çizelgesini Güncelle (YAPILAN BAKIMSIRA) - ÖNCE KAYDET Kİ RAPORA GELSİN
    try {
      const sheetSira = ss.getSheetByName('YAPILAN BAKIMSIRA');
      if (sheetSira) {
        const siraData = sheetSira.getDataRange().getValues();
        const d = new Date();
        const currentMonth = d.getMonth() + 1;
        const targetCol = currentMonth + 1;
        
        let machineRow = -1;
        for (let r = 0; r < siraData.length; r++) {
          if (siraData[r][0] && siraData[r][0].toString().trim() === makineAdi.toString().trim()) {
            machineRow = r + 1;
            break;
          }
        }
        
        if (machineRow !== -1) {
          sheetSira.getRange(machineRow, targetCol).setValue(gunTxt);
          SpreadsheetApp.flush(); // Değişikliği anında yansıt
        }
      }
    } catch(e) {
       console.log("Çizelge Güncelleme Hatası: " + e.toString());
    }

    // 5. VERİLERİ TOPLA (Planlı kw ve Gerçekleşenler)
    let planliKw = Array(12).fill("");
    try {
      const sheetMakine = ss.getSheetByName('MAKİNE_LİSTESİ');
      const makineData = sheetMakine.getDataRange().getValues();
      const mRow = makineData.find(r => r[0] && r[0].toString().trim() === makineAdi.toString().trim());
      if (mRow) {
        for (let i = 0; i < 12; i++) {
          let kwVal = mRow[2 + i] || ""; 
          if (kwVal !== "") planliKw[i] = kwVal + " kw";
        }
      }
    } catch(e) {}

    let gerceklesenTarihler = Array(12).fill("");
    try {
      const sheetSira = ss.getSheetByName('YAPILAN BAKIMSIRA');
      const siraData = sheetSira.getDataRange().getValues();
      const sRow = siraData.find(r => r[0] && r[0].toString().trim() === makineAdi.toString().trim());
      if (sRow) {
        for (let i = 1; i <= 12; i++) {
          let val = sRow[i] || "";
          if (val instanceof Date) {
            const dDay = val.getDate().toString().padStart(2, '0');
            const dMon = (val.getMonth() + 1).toString().padStart(2, '0');
            gerceklesenTarihler[i-1] = `${dDay}.${dMon}.${val.getFullYear()}`;
          }
        }
      }
    } catch(e) {}
    
    // Gerekli Başlık Formatı
    const resmiBaslik = `AYLIK BAKIM FORMU / ${gunTxt} / ${makineAdi.toUpperCase()}`;
    
    // 5. REVİZYON VE İMZA BİLGİLERİNİ ÇEK (KULLANICI_BİLGİLERİ H, I, J, K, L)
    let hazHeader = "", onaHeader = "", yayHeader = "", revHeader = "", lHeader = "";
    let hazVal = "", onaVal = "", yayVal = "", revVal = "", lVal = "";
    
    try {
      if (kulData.length > 1) {
        // BAŞLIKLAR (Index 0)
        hazHeader = kulData[0][7] || "HAZIRLAYAN";
        onaHeader = kulData[0][8] || "ONAYLAYAN";
        yayHeader = kulData[0][9] || "YAYIN TARİHİ";
        revHeader = kulData[0][10] || "REVİZYON";
        lHeader = kulData[0][11] || ""; // L Sütunu Başlığı
        
        // VERİLER (Index 1)
        hazVal = kulData[1][7] || ""; 
        onaVal = kulData[1][8] || "";  
        yayVal = kulData[1][9] ? (kulData[1][9] instanceof Date ? Utilities.formatDate(kulData[1][9], Session.getScriptTimeZone(), "dd.MM.yyyy") : kulData[1][9]) : ""; 
        revVal = kulData[1][10] || ""; 
        lVal = kulData[1][11] || ""; // L
      }
    } catch(e) {}
    
    // YENİ OZELLİK: islerText artık "JSON" olarak geliyor. Onu çöz.
    let islerArray = [];
    try {
      islerArray = JSON.parse(islerText);
    } catch(e) {
      // Hata durumu
    }

    // 2. Telegram At
    if (BOT_TOKEN !== "" && CHAT_ID !== "") {
      const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;
      const caption = `📋 *${resmiBaslik}*\n\n👤 *Operatör:* ${operatorAdi}\n📛 *Teyit:* ${makineBarkodu}\n📅 *Zaman:* ${zamanTxt}\n\n✅ Aylık bakım raporu başarıyla sisteme kaydedildi ve e-posta ile gönderildi.`;
      
      try {
        if (opFoto !== "") {
          const fotoBlob = UrlFetchApp.fetch(opFotoTelegram).getBlob();
          UrlFetchApp.fetch(telegramUrl + "/sendPhoto", {
            method: 'post',
            payload: {
              chat_id: CHAT_ID,
              photo: fotoBlob,
              caption: caption,
              parse_mode: 'Markdown'
            }
          });
        } else {
          UrlFetchApp.fetch(telegramUrl + "/sendMessage", {
            method: 'post',
            payload: {
              chat_id: CHAT_ID,
              text: caption,
              parse_mode: 'Markdown'
            }
          });
        }
      } catch(e) {
        // Fallback
        try {
          UrlFetchApp.fetch(telegramUrl + "/sendMessage", {
            method: 'post',
            payload: { chat_id: CHAT_ID, text: caption, parse_mode: 'Markdown' }
          });
        } catch(e2) {}
      }
    }
    
    // 3. Mail At ve PDF Oluştur
    if (aliciMail !== "") {
      
      let htmlTableRowsOK = "";
      let htmlTableRowsRED = "";
      let bitenSayisi = 0;
      let indexNo = 1;
      
      let minZaman = 99999999999999;
      let maxZaman = 0;

      if (islerArray.length > 0) {
        islerArray.forEach(islem => {
          if (islem.yapildiMi) {
            bitenSayisi++;
            
            // Makine için min/max zamani hesapla
            if(islem.zamanMs && islem.zamanMs > 0) {
               if(islem.zamanMs < minZaman) minZaman = islem.zamanMs;
               if(islem.zamanMs > maxZaman) maxZaman = islem.zamanMs;
            }

            let rowBg = islem.sonucDurumu === "RED" ? "background-color: #fee2e2;" : "background-color: #f0fdf4;";
            
            let rowHtml = `
              <tr style="text-align: center;">
                <td style="padding: 3px; ${rowBg}">${indexNo++}</td>
                <td style="padding: 3px; ${rowBg}">${makineAdi}</td>
                <td style="padding: 3px; text-align:left; ${rowBg}; white-space: normal;">${islem.yapilacakBakim}</td>
                <td style="padding: 3px; ${rowBg}">${operatorAdi}</td>
                <td style="padding: 3px; ${rowBg}">-</td>
                <td style="padding: 3px; ${rowBg}">${islem.istenenDeger || "-"}</td>
                <td style="padding: 3px; ${rowBg}; white-space: normal;">${islem.aciklama || "-"}</td>
                <td style="padding: 3px; ${rowBg}">${gunTxt}</td>
                <td class="${islem.sonucDurumu === "OK" ? 'green-cell' : 'red-cell'}" style="padding: 3px; font-weight:bold;">${islem.sonucDurumu}</td>
                <td style="padding: 3px; ${rowBg}">Bakım</td>
                <td style="padding: 3px; ${rowBg}">${islem.kullanilacakParca || "-"}</td>
              </tr>
            `;

            if (islem.sonucDurumu === "OK") {
              htmlTableRowsOK += rowHtml;
            } else {
              htmlTableRowsRED += rowHtml;
            }
          }
        });
      }

      let htmlTableRows = "";
      if (htmlTableRowsRED !== "") {
        htmlTableRows += `<tr><td colspan="11" style="background-color:#fecaca; color:#991b1b; font-weight:bold; font-size:11px; padding:6px; border:0.75pt solid black; text-align:left;">🔴 RAPOR EDİLEN SORUNLAR / HATALI DURUMLAR (RED)</td></tr>` + htmlTableRowsRED;
      }
      if (htmlTableRowsOK !== "") {
        htmlTableRows += `<tr><td colspan="11" style="background-color:#bbf7d0; color:#166534; font-weight:bold; font-size:11px; padding:6px; border:0.75pt solid black; text-align:left;">🟢 BAŞARILI İŞLEMLER (OK)</td></tr>` + htmlTableRowsOK;
      }

      // Toplam Süre String'ini min/max üzerinden hesapla
      let tStr = "0:00:00";
      if (minZaman !== 99999999999999 && maxZaman !== 0) {
         let farkMs = maxZaman - minZaman;
         if (bitenSayisi > 1 && farkMs < 60000) farkMs = 60000; // En az 1 dk
         let s = Math.floor(farkMs / 1000);
         let tHr = Math.floor(s / 3600);
         let tMin = Math.floor((s % 3600) / 60);
         let tSec = s % 60;
         tStr = `${tHr}:${tMin < 10 ? '0' : ''}${tMin}:${tSec < 10 ? '0' : ''}${tSec}`;
      } else if (bitenSayisi === 1) {
         tStr = "0:01:00"; 
      }

      const htmlIcerik = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: A3 landscape; margin: 15mm; }
          body { font-family: Arial, sans-serif; background: white; margin: 0; padding: 0; }
          table { width: 100%; border-collapse: collapse; }
          th { border: 0.75pt solid black; padding: 4px; font-size: 10px; text-transform: uppercase; background-color: #fde047; }
          td { border-left: 0.75pt solid black; border-right: 0.75pt solid black; border-bottom: none; padding: 4px; font-size: 8.5px; white-space: nowrap; }
          tr:nth-child(even) { background-color: #f9fafb; }
          tr:last-child td { border-bottom: 0.75pt solid black; }
          .red-cell { background-color: #ef4444 !important; color: white !important; font-weight: bold; }
          .green-cell { background-color: #10b981 !important; color: white !important; font-weight: bold; }
        </style>
      </head>
      <body>
          <table style="width: 100%; border-collapse: collapse; border: 2px solid black;">
            <!-- ROW 1 -->
            <tr>
              <td rowspan="7" style="width: 10%; border: 0.75pt solid black; text-align: center; vertical-align: middle; padding: 5px;">
                ${opFotoBase64 !== "" ? `<img src="${opFotoBase64}" style="width: 100%; height: auto; display: block; border: 1px solid #000;">` : "-FOTO YOK-"}
              </td>
              <td colspan="5" style="border: 0.75pt solid black; text-align: center; font-size: 24px; font-weight: 900; background: #fff;">
                AYLIK BAKIM FORMU
              </td>
              <td colspan="2" style="border: 0.75pt solid black; text-align: center; padding: 4px; color: #3b82f6; font-weight: 900; font-size: 16px;">
                MAKİNE ADI:
              </td>
              <td colspan="6" style="border: 0.75pt solid black; text-align: center; font-size: 18px; font-weight: 900; vertical-align: middle; text-transform:uppercase;">
                ${makineAdi}
              </td>
            </tr>

            <!-- ROW 2 -->
            <tr>
              <td style="border: 0.75pt solid black; color: #3b82f6; font-weight: bold; font-size: 10px; padding: 4px; text-align: left; width:15%;">BAKIM SORUMLUSU: <span style="color:black; font-size:12px;">${operatorAdi.toUpperCase()}</span></td>
              <td colspan="2" style="border: 0.75pt solid black; color: #3b82f6; font-weight: bold; font-size: 10px; padding: 4px; text-align: left;">BAKIM YAPILDI: <span style="color:black; font-size:12px;">${bitenSayisi} ad</span></td>
              <td colspan="10" style="border: 0.75pt solid black; color: #3b82f6; font-weight: bold; font-size: 10px; padding: 4px; text-align: left;">TOPLAM BAKIM SÜRESİ: <span style="color:black; font-size:12px;">${tStr}</span></td>
            </tr>

            <!-- ROW 3 -->
            <tr>
              <td style="border: 0.75pt solid black; color: #3b82f6; font-weight: bold; font-size: 10px; padding: 4px; text-align: left;">BAKIM KODU: <span style="color:black; font-size:12px;">${makineBarkodu}</span></td>
              <td colspan="12" style="border: 0.75pt solid black; color: #3b82f6; font-weight: bold; font-size: 11px; padding: 2px; text-align: center; background: #fff;">PLANLI BAKIM TARİHLERİ (kw) HAFTA OLARAK</td>
            </tr>

            <!-- ROW 4: Aylar -->
            <tr>
              <td style="border: 0.75pt solid black; color: #3b82f6; font-weight: bold; font-size: 10px; padding: 4px; text-align: left;">BAKIM TARİHİ: <span style="color:black; font-size:12px;">${gunTxt}</span></td>
              ${["OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN", "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"].map(m => `<td style="border: 0.75pt solid black; color: #3b82f6; font-weight: bold; font-size: 8px; text-align: center; padding: 2px; width:6%;">${m}</td>`).join("")}
            </tr>

            <!-- ROW 5: Planlı kw -->
            <tr>
              <td style="border: 0.75pt solid black; background: #fff;">&nbsp;</td>
              ${planliKw.map(kw => `<td style="border: 0.75pt solid black; font-size: 10px; text-align: center; padding: 2px;">${kw || "-"}</td>`).join("")}
            </tr>

            <!-- ROW 6: Gerçekleşen Başlık -->
            <tr>
              <td style="border: 0.75pt solid black; background: #fff;">&nbsp;</td>
              <td colspan="12" style="border: 0.75pt solid black; color: #3b82f6; font-weight: bold; font-size: 11px; text-align: center; padding: 1px;">GERÇEKLEŞEN TARİHLER</td>
            </tr>

            <!-- ROW 7: Gerçekleşenler -->
            <tr>
              <td style="border: 0.75pt solid black; background: #fff;">&nbsp;</td>
              ${gerceklesenTarihler.map(dt => `<td style="border: 0.75pt solid black; font-size: 10px; text-align: center; padding: 2px; font-weight: bold;">${dt || "&nbsp;"}</td>`).join("")}
            </tr>
          </table>

          <!-- DETAYLI İŞ TABLOSU -->
          <table style="width: 100%; border-collapse: collapse; border: 0.75pt solid black; border-top: 0; margin-top: 6px;">
            <tr style="background-color: #fde047; font-size: 9px; font-weight: bold; text-align: center;">
               <th>NO</th>
               <th>MAKİNE ADI</th>
               <th>YAPILACAK BAKIM</th>
               <th>OPERATÖR</th>
               <th>SÜRE</th>
               <th>İSTENEN DEĞER</th>
               <th>Açıklama / Ölçüm Değeri</th>
               <th>BAKIM TARİHİ</th>
               <th>DURUM</th>
               <th>BİRİM</th>
               <th>KULLANILACAK PARÇA</th>
            </tr>
            ${htmlTableRows}
          </table>
          
          <!-- ALT İMZA VE REVİZYON BÖLÜMÜ (5 SÜTUNLU TASARIM) -->
          <table style="width: 100%; border-collapse: collapse; border: 0.75pt solid black; margin-top: 20px; text-align: center; font-size: 9px; font-weight: bold;">
            <tr style="background-color: #ffff00; border: 0.75pt solid black;">
              <td style="border: 0.75pt solid black; padding: 5px; width: 20%;">${hazHeader}</td>
              <td style="border: 0.75pt solid black; padding: 5px; width: 20%;">${onaHeader}</td>
              <td style="border: 0.75pt solid black; padding: 5px; width: 20%;">${yayHeader}</td>
              <td style="border: 0.75pt solid black; padding: 5px; width: 20%;">${revHeader}</td>
              <td style="border: 0.75pt solid black; padding: 5px; width: 20%;">${lHeader}</td>
            </tr>
            <tr>
              <td style="border: 0.75pt solid black; padding: 12px 5px;">${hazVal}</td>
              <td style="border: 0.75pt solid black; padding: 12px 5px;">${onaVal}</td>
              <td style="border: 0.75pt solid black; padding: 12px 5px;">${yayVal}</td>
              <td style="border: 0.75pt solid black; padding: 12px 5px;">${revVal}</td>
              <td style="border: 0.75pt solid black; padding: 12px 5px;">${lVal}</td>
            </tr>
          </table>
          
        </div>
      </body>
      </html>
      `;

      // PDF Dosyası Yarat
      const pdfBlob = Utilities.newBlob(htmlIcerik, MimeType.HTML).setName(resmiBaslik + ".pdf").getAs(MimeType.PDF);

      MailApp.sendEmail({
        to: aliciMail,
        subject: resmiBaslik,
        htmlBody: htmlIcerik, // Body the same as PDF
        attachments: [pdfBlob]
      });
    }

    return "Toplu Rapor Telegram ve E-Posta ile Gönderildi ve Çizelge Güncellendi!";
  } catch(e) {
    return "Raporlama Hatası: " + e.toString();
  }
}

// ==============================================================================
// 5. BİLDİRİM BOTLARI (TELEGRAM VE E-POSTA)
// ==============================================================================

function telegramBildirimiGonder(isim, makine, okMu) {
  // TODO: Buraya kullanıcının Bot Token ve Chat ID'si girilmeli
  const botToken = "BURAYA_TOKEN_YAZ";
  const chatId = "BURAYA_CHAT_ID_YAZ";
  
  if (botToken === "BURAYA_TOKEN_YAZ") return; // Ayarlanmadıysa atla

  const durumEmojisi = okMu ? "🟢 OK (ONAY)" : "🔴 RED (HATA)";
  let mesaj = `🛠️ *Aylık Bakım Tamamlandı!*\n\n`;
  mesaj += `👤 *Operatör:* ${isim}\n`;
  mesaj += `🏭 *Makine:* ${makine}\n`;
  mesaj += `📊 *Sonuç:* ${durumEmojisi}\n`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: mesaj,
    parse_mode: 'Markdown'
  };

  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
  } catch(e) {}
}

function mailRaporGonder(veri, tarih, resimUrl) {
  // TODO: Hangi maile gideceğini müşteri belirleyecek
  const gonderilecekMail = "sabitmail@ornek.com"; 

  if (gonderilecekMail === "sabitmail@ornek.com") return;

  const durum = veri.kontrolOKMu ? "🟢 OK (BAŞARILI)" : "🔴 RED (BAŞARISIZ)";
  
  const konu = `Aylık Bakım Raporu: ${veri.makineAdi} - ${tarih}`;
  let govde = `Aylık bakım işlemi tamamlanmıştır.\n\n`;
  govde += `Tarih: ${tarih}\n`;
  govde += `Makine: ${veri.makineAdi} (ID: ${veri.makineID})\n`;
  govde += `Operatör: ${veri.operatorAdi}\n`;
  govde += `Süre: ${veri.sureDk} Dk\n`;
  govde += `Sonuç: ${durum}\n`;
  govde += `Açıklama/Değer: ${veri.aciklamaVeyaDeger}\n`;
  govde += `\nKanıt Fotoğrafı Linki: ${resimUrl}\n`;

  try {
    MailApp.sendEmail({
      to: gonderilecekMail,
      subject: konu,
      body: govde
    });
  } catch (e) {}
}

// ==============================================================================
// 5. KULLANICI (PERSONEL) YÖNETİMİ API
// ==============================================================================
function getKullanicilar() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('KULLANICI_BİLGİLERİ');
  if(!sheet) return "[]";
  const data = sheet.getDataRange().getValues();
  let liste = [];
  
  for(let i=1; i<data.length; i++) {
     if (data[i][0] && data[i][0].toString().trim() !== "") {
       liste.push({
         satir: i+1,
         ad: data[i][0].toString().trim(),
         sifre: data[i][1] ? data[i][1].toString().trim() : "",
         yetki: data[i][2] ? data[i][2].toString().trim() : "Operator",
         foto: data[i][6] ? data[i][6].toString().trim() : "",
         birim: data[i][12] ? data[i][12].toString().trim() : ""
       });
     }
  }
  return JSON.stringify(liste);
}

function kaydetKullanici(p) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('KULLANICI_BİLGİLERİ');
  const satirNo = parseInt(p.satir, 10);
  
  // Varsa Yetki, Parola, Email vs değiştiriyoruz.
  if (satirNo > 0) {
    sheet.getRange(satirNo, 1).setValue(p.ad);
    sheet.getRange(satirNo, 2).setValue(p.sifre);
    sheet.getRange(satirNo, 3).setValue(p.yetki);
    sheet.getRange(satirNo, 7).setValue(p.foto);
    sheet.getRange(satirNo, 13).setValue(p.birim || ""); // M Sütunu
    return "Mevcut personel güncellendi!";
  } else {
    // Excel'in sonuna yeni kişi (M Sütununa kadar boş değerlerle dolduruyoruz)
    sheet.appendRow([p.ad, p.sifre, p.yetki, "", "", "", p.foto, "", "", "", "", "", p.birim || ""]);
    return "Yeni personel oluşturuldu!";
  }
}

function silKullanici(satirNo) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('KULLANICI_BİLGİLERİ');
  const satir = parseInt(satirNo, 10);
  
  // Yanlışlıkla başlıkları (Satır 1) silmesin diye kontrol ediyoruz
  if(satir > 1) { 
    sheet.deleteRow(satir);
  }
  return "Silindi!";
}

// ----------------------------------------------------
// GERÇEK ŞİFRE KONTROLÜ VE PROFİL RESMİ ÇEKME
// ----------------------------------------------------
function loginKontrol(kAdi, sifre) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('KULLANICI_BİLGİLERİ');
  if(!sheet) return { basarili: false, mesaj: "Kullanıcı veritabanı bulunamadı!" };
  const data = sheet.getDataRange().getValues();
  
  for(let i=1; i<data.length; i++) {
     const adSutun = data[i][0] ? data[i][0].toString().trim() : "";
     const sifreSutun = data[i][1] ? data[i][1].toString().trim() : "";
     
     if (adSutun === kAdi) {
        if (sifreSutun === sifre) {
           return {
             basarili: true,
             ad: adSutun,
             yetki: data[i][2] ? data[i][2].toString().trim() : "Operator",
             foto: data[i][6] ? data[i][6].toString().trim() : ""
           };
        } else {
           return { basarili: false, mesaj: "Hatalı Şifre girdiniz! Lütfen tekrar deneyin." };
        }
     }
  }
  return { basarili: false, mesaj: "Seçilen personel sistemde bulunamadı." };
}

function silBakimPlani(satirNo) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('BAKIM_PLANLARI');
    const satir = parseInt(satirNo, 10);
    
    // Geçerli bir veri satırı mı? (Başlık hariç)
    if (satir > 1) {
      sheet.deleteRow(satir);
      return "Bakım planı (şablon) başarıyla silindi!";
    }
    return "Hata: Geçersiz satır numarası.";
  } catch(e) {
    return "Silme Hatası: " + e.toString();
  }
}
/**
 * Operatörün kendi yaptığı bir bakımı silmesini sağlar.
 */
function silYapilanBakim(satirNo) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('YAPILAN_BAKIMLAR');
    if (satirNo > 1) {
      sheet.deleteRow(satirNo);
      return "Bakım kaydı başarıyla silindi ve iş 'bekliyor' durumuna döndürüldü.";
    }
    return "Hata: Geçersiz satır numarası.";
  } catch (e) {
    return "Silme Hatası: " + e.toString();
  }
}

/**
 * Operatörün bir makineye ait bu haftaki TÜM bakımlarını silmesini sağlar.
 */
function silTumYapilanBakimlar(makineAdi, operatorAdi) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('YAPILAN_BAKIMLAR');
    const data = sheet.getDataRange().getValues();
    const bugun = new Date();
    const currentWeek = getISOWeek(bugun);
    
    const targetMakine = makineAdi.toString().trim().toLowerCase();
    const targetOperator = operatorAdi.toString().trim().toLowerCase();
    
    let silinenSayisi = 0;
    // Sondan başa sil ki indeks kaymasın
    for (let i = data.length - 1; i >= 1; i--) {
      const rowDate = new Date(data[i][0]);
      if (isNaN(rowDate.getTime())) continue;
      
      const mName = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "";
      const opName = data[i][8] ? data[i][8].toString().trim().toLowerCase() : "";
      
      if (mName === targetMakine && opName === targetOperator) {
        // Hafta ve yıl kontrolü (Daha esnek: Aynı yıl ve aynı ISO haftası)
        if (getISOWeek(rowDate) === currentWeek && rowDate.getFullYear() === bugun.getFullYear()) {
          sheet.deleteRow(i + 1);
          silinenSayisi++;
        }
      }
    }
    
    if (silinenSayisi === 0) {
      return "Silinecek uygun kayıt bulunamadı (Filtre: Bu Hafta + Makine + Operatör).";
    }
    return `${silinenSayisi} adet bakım kaydı başarıyla silindi. Makine sıfırlandı.`;
  } catch (e) {
    return "Toplu Silme Hatası: " + e.toString();
  }
}

/**
 * ISO Hafta Numarasını Hesaplar
 */
function getISOWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}
