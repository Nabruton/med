// --- State & LocalStorage (GitHub Pages Uyumlu Versiyon) ---
const STORAGE_KEY = 'medward_patients_v4';
let patients = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let sortableInstance = null; // Global instance for D&D

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

function init() {
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // Varsayılan Yatış Tarihini Bugüne Ayarla
    document.getElementById('pAdmissionDate').valueAsDate = new Date();

    setupTabs();
    setupCalculators();
    setupModals();
    renderPatients(); // LocalStorage'den yükle

    // Sürükle Bırak (Drag & Drop) Başlat
    const grid = document.getElementById('patientGrid');
    sortableInstance = new Sortable(grid, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        delay: window.innerWidth < 768 ? 150 : 0, // Mobilde sayfayı kaydırmak için gecikme
        delayOnTouchOnly: true,
        onEnd: function () {
            // Arama filtresi varken sıralamayı kaydetme (hata önler)
            if (document.getElementById('searchInput').value.trim() !== '') return;
            
            // DOM üzerindeki yeni sıraya göre diziyi baştan oluştur
            const newOrder = [];
            document.querySelectorAll('#patientGrid .patient-card').forEach(card => {
                const pId = parseInt(card.getAttribute('data-id'));
                const pObj = patients.find(p => p.id === pId);
                if(pObj) newOrder.push(pObj);
            });
            
            patients = newOrder;
            saveState();
        }
    });
}

function setupTabs() {
    const links = document.querySelectorAll('.nav-menu a, .nav-bottom a');
    const tabs = document.querySelectorAll('.tab-content');
    
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('data-tab');
            if(!target) return; // For backup/restore links

            e.preventDefault();
            
            if (link.classList.contains('active')) {
                // Toggle off if already active (optional)
                // link.classList.remove('active');
                // document.getElementById('tab-' + target).classList.add('hidden');
                return;
            }

            links.forEach(l => l.classList.remove('active'));
            // Activate all links (mobile and desktop) that point to the same tab
            document.querySelectorAll(`[data-tab="${target}"]`).forEach(l => l.classList.add('active'));
            
            tabs.forEach(t => { 
                t.classList.add('hidden');
                t.classList.remove('active');
            });
            document.getElementById('tab-' + target).classList.remove('hidden');
            document.getElementById('tab-' + target).classList.add('active');
        });
    });
}

// --- Dashboard Logic ---
function updateMetrics() {
    document.getElementById('valTotal').innerText = patients.length;
    let actionCount = patients.filter(p => p.tags && p.tags.length > 0 && !p.tags.includes("Taburcu")).length;
    document.getElementById('valAction').innerText = actionCount;
}

function renderPatients(filter = '') {
    const grid = document.getElementById('patientGrid');
    grid.innerHTML = '';
    
    let filtered = patients;
    if (filter) {
        const lowerFilter = filter.toLowerCase();
        filtered = patients.filter(p => 
            p.name.toLowerCase().includes(lowerFilter) || 
            p.diagnosis.toLowerCase().includes(lowerFilter) || 
            p.bed.toLowerCase().includes(lowerFilter)
        );
        // Filtre varken Drag & Drop'u kapat (güvenlik)
        if(sortableInstance) sortableInstance.option("disabled", true);
    } else {
        if(sortableInstance) sortableInstance.option("disabled", false);
    }

    filtered.forEach(p => {
        let tagsHtml = '';
        let cardClass = 'patient-card glass';
        
        if (p.tags) {
            // Triage Renklendirme
            if(p.tags.includes('Riskli')) cardClass += ' card-risk';
            else if(p.tags.includes('Taburcu')) cardClass += ' card-discharge';
            
            tagsHtml = p.tags.map(t => {
                let tagClass = t.split(' ')[0];
                return `<span class="tag-chip tag-${tagClass}">${t}</span>`;
            }).join('');
        }

        // Yatış Gün Sayacı (Dinamik)
        let daysStr = "Bugün";
        if(p.admissionDate) {
            const date1 = new Date(p.admissionDate);
            date1.setHours(0,0,0,0);
            const date2 = new Date();
            date2.setHours(0,0,0,0);
            
            const diffTime = date2 - date1;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if(diffDays === 0) daysStr = "Bugün yattı";
            else if (diffDays === 1) daysStr = "Dün yattı";
            else if (diffDays > 1) daysStr = `Yatış Bölü: ${diffDays}. Gün`;
            else daysStr = "İleri tarih"; // if future date
        }
        
        const card = document.createElement('div');
        card.className = cardClass;
        card.setAttribute('data-id', p.id);
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <span class="p-bed">${p.bed}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted); margin-left:8px; font-weight:600;">🕐 ${daysStr}</span>
                </div>
                <div>
                    <button class="btn-icon" onclick="editPatient(${p.id})" title="Düzenle">✏️</button>
                    <button class="btn-icon" onclick="deletePatient(${p.id})" title="Sil" style="color:var(--danger)">🗑️</button>
                </div>
            </div>
            <div class="p-info">
                <h3>${p.name}</h3>
            </div>
            <div class="p-diagnosis">${p.diagnosis}</div>
            <div class="tags-wrapper">${tagsHtml}</div>
            <div class="p-notes">${p.notes || ''}</div>
            
            <!-- Epikriz Botunu -->
            <button class="btn-epikriz" onclick="copyEpikriz(${p.id}, this)">📋 Epikriz Formatında Kopyala</button>
        `;
        grid.appendChild(card);
    });
    updateMetrics();
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    renderPatients(e.target.value);
});

// --- Modal Functions ---
const modal = document.getElementById('patientModal');
const patientForm = document.getElementById('patientForm');

function setupModals() {
    document.getElementById('btnNewPatient').addEventListener('click', () => {
        document.getElementById('editPatientId').value = '';
        patientForm.reset();
        document.getElementById('pAdmissionDate').valueAsDate = new Date();
        document.getElementById('modalTitle').innerText = 'Yeni Hasta Kaydı';
        modal.classList.add('active');
    });

    document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal').addEventListener('click', () => modal.classList.remove('active'));

    patientForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const editId = document.getElementById('editPatientId').value;
        const checkedTags = [];
        document.querySelectorAll('#tagsSelector input:checked').forEach(chk => checkedTags.push(chk.value));

        const patientData = {
            name: document.getElementById('pName').value,
            bed: document.getElementById('pBed').value,
            admissionDate: document.getElementById('pAdmissionDate').value,
            diagnosis: document.getElementById('pDiagnosis').value,
            notes: document.getElementById('pNotes').value,
            tags: checkedTags
        };

        if (editId) {
            const index = patients.findIndex(p => p.id == editId);
            patients[index] = { ...patients[index], ...patientData, id: patients[index].id };
        } else {
            patientData.id = Date.now();
            patients.push(patientData);
        }

        saveState();
        modal.classList.remove('active');
        renderPatients(document.getElementById('searchInput').value);
    });
}

window.editPatient = function(id) {
    const p = patients.find(p => p.id === id);
    if (!p) return;
    document.getElementById('editPatientId').value = p.id;
    document.getElementById('pName').value = p.name;
    document.getElementById('pBed').value = p.bed;
    document.getElementById('pAdmissionDate').value = p.admissionDate || new Date().toISOString().split('T')[0];
    document.getElementById('pDiagnosis').value = p.diagnosis;
    document.getElementById('pNotes').value = p.notes;
    document.querySelectorAll('#tagsSelector input').forEach(chk => chk.checked = p.tags && p.tags.includes(chk.value));
    document.getElementById('modalTitle').innerText = 'Hasta Bilgilerini Düzenle';
    modal.classList.add('active');
}

window.deletePatient = function(id) {
    if (confirm('Hastayı sistemden kaldırmak istediğinize emin misiniz?')) {
        patients = patients.filter(p => p.id !== id);
        saveState();
        renderPatients(document.getElementById('searchInput').value);
    }
}

// --- Otomasyon Araçları: Not Şablonu Ekleme ---
window.addNoteTemplate = function(text) {
    const textarea = document.getElementById('pNotes');
    if(textarea.value.trim() !== "") {
        textarea.value += "\n" + text;
    } else {
        textarea.value = text;
    }
}

// --- Epikriz Formatında Kopyalama Modülü ---
window.copyEpikriz = function(id, btnElement) {
    const p = patients.find(p => p.id === id);
    if (!p) return;
    
    // Yatış hesabı
    let daysStr = "1";
    if(p.admissionDate) {
        const d1 = new Date(p.admissionDate);
        d1.setHours(0,0,0,0);
        const d2 = new Date();
        d2.setHours(0,0,0,0);
        const diffDays = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
        if(diffDays >= 0) daysStr = String(diffDays + 1);
    }
    
    const text = `Hasta Adı Soyadı: ${p.name}
Serivs Odası: ${p.bed}
Yatış Günü: ${daysStr}. Gün
Tanı: ${p.diagnosis}

*** GÜNLÜK VİZİT NOTU ***
${p.notes || 'Değerlendirme notu bulunmuyor.'}

${p.tags && p.tags.length > 0 ? "[AKTİF İZLEM VE AKSİYONLAR]: " + p.tags.join(', ') : ""}`;

    navigator.clipboard.writeText(text).then(() => {
        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = "✅ Panoya Kopyalandı!";
        btnElement.style.background = "var(--success)";
        btnElement.style.color = "white";
        
        setTimeout(() => {
            btnElement.innerHTML = originalText;
            btnElement.style.background = "#f1f5f9";
            btnElement.style.color = "var(--text-main)";
        }, 2000);
    }).catch(err => {
        alert("Kopyalama başarısız oldu. Tarayıcı izinlerini kontrol edin.");
    });
}

// --- Calculators ---
function setupCalculators() {
    const qBoxes = ['qsofa1', 'qsofa2', 'qsofa3'];
    qBoxes.forEach(id => document.getElementById(id).addEventListener('change', calculateQsofa));
    const gcsSelects = ['gcsE', 'gcsV', 'gcsM'];
    gcsSelects.forEach(id => document.getElementById(id).addEventListener('change', calculateGcs));
    const curbBoxes = ['curbC', 'curbU', 'curbR', 'curbB', 'curb65'];
    curbBoxes.forEach(id => document.getElementById(id).addEventListener('change', calculateCurb));
    const wellsBoxes = ['wells1', 'wells2', 'wells3', 'wells4', 'wells5', 'wells6', 'wells7'];
    wellsBoxes.forEach(id => document.getElementById(id).addEventListener('change', calculateWells));
    
    // YENİ EKLENEN ARAÇLAR
    const sirsBoxes = ['sirs1', 'sirs2', 'sirs3', 'sirs4'];
    sirsBoxes.forEach(id => document.getElementById(id).addEventListener('change', calculateSirs));
    
    const newsSelects = ['nResp', 'nSpo', 'nO2', 'nBp', 'nHr', 'nLoc', 'nTemp'];
    newsSelects.forEach(id => document.getElementById(id).addEventListener('change', calculateNews));
    
    const nihssSelects = ['ni1a', 'ni1b', 'ni1c', 'ni2', 'ni3', 'ni4', 'ni5a', 'ni5b', 'ni6a', 'ni6b', 'ni7', 'ni8', 'ni9', 'ni10', 'ni11'];
    nihssSelects.forEach(id => document.getElementById(id).addEventListener('change', calculateNihss));
}

function calculateQsofa() {
    let score = 0; if(document.getElementById('qsofa1').checked) score++; if(document.getElementById('qsofa2').checked) score++; if(document.getElementById('qsofa3').checked) score++;
    const res = document.getElementById('qsofaResult');
    if (score >= 2) { res.innerHTML = `Skor: ${score} (Yüksek Risk)`; res.style.color = "var(--danger)"; } else { res.innerHTML = `Skor: ${score} (Düşük Risk)`; res.style.color = "var(--primary)"; }
}

function calculateGcs() {
    let total = parseInt(document.getElementById('gcsE').value) + parseInt(document.getElementById('gcsV').value) + parseInt(document.getElementById('gcsM').value);
    const res = document.getElementById('gcsResult');
    res.innerText = `Toplam GKS: ${total} / 15`;
    if(total <= 8) { res.style.color = "var(--danger)"; } else { res.style.color = "var(--primary)"; }
}

function calculateCurb() {
    let score = 0; ['curbC', 'curbU', 'curbR', 'curbB', 'curb65'].forEach(id => { if(document.getElementById(id).checked) score++; });
    const res = document.getElementById('curbResult');
    if(score >= 3) { res.innerHTML = `Skor: ${score} (Ağır - Yoğun Bakım Yatışı)`; res.style.color = "var(--danger)"; } else if (score >= 2) { res.innerHTML = `Skor: ${score} (Orta - Kronik hastalığa göre yakın takip)`; res.style.color = "var(--warning)"; } else { res.innerHTML = `Skor: ${score} (Hafif - Ayaktan Tedavi Planlanabilir)`; res.style.color = "var(--primary)"; }
}

function calculateWells() {
    let score = 0; ['wells1', 'wells2'].forEach(id => { if(document.getElementById(id).checked) score += 3; }); ['wells3', 'wells4', 'wells5'].forEach(id => { if(document.getElementById(id).checked) score += 1.5; }); ['wells6', 'wells7'].forEach(id => { if(document.getElementById(id).checked) score += 1; });
    const res = document.getElementById('wellsResult');
    if(score >= 6) { res.innerHTML = `Skor: ${score} (Yüksek Olasılık >%60)`; res.style.color = "var(--danger)"; } else if (score >= 2) { res.innerHTML = `Skor: ${score} (Orta Olasılık Mümkün)`; res.style.color = "var(--warning)"; } else { res.innerHTML = `Skor: ${score} (Düşük Olasılık <%10)`; res.style.color = "var(--primary)"; }
}

function calculateSirs() {
    let score = 0; ['sirs1', 'sirs2', 'sirs3', 'sirs4'].forEach(id => { if(document.getElementById(id).checked) score++; });
    const res = document.getElementById('sirsResult');
    if(score >= 2) { res.innerHTML = `Skor: ${score} (Ortalama SIRS Kriterlerini Karşılıyor +)`; res.style.color = "var(--danger)"; } else { res.innerHTML = `Skor: ${score} (Kriter Karşılanmıyor)`; res.style.color = "var(--primary)"; }
}

function calculateNews() {
    let score = 0; ['nResp', 'nSpo', 'nO2', 'nBp', 'nHr', 'nLoc', 'nTemp'].forEach(id => { score += parseInt(document.getElementById(id).value); });
    const res = document.getElementById('newsResult');
    if(score >= 7) { res.innerHTML = `Skor: ${score} (Yüksek Klinik Risk - Acil Ekip Başvurusu)`; res.style.color = "var(--danger)"; } 
    else if(score >= 5) { res.innerHTML = `Skor: ${score} (Orta Risk - Acil Değerlendirme)`; res.style.color = "var(--warning)"; } 
    else { res.innerHTML = `Skor: ${score} (Düşük Risk - Servis Takibi)`; res.style.color = "var(--primary)"; }
}

function calculateNihss() {
    let score = 0; ['ni1a', 'ni1b', 'ni1c', 'ni2', 'ni3', 'ni4', 'ni5a', 'ni5b', 'ni6a', 'ni6b', 'ni7', 'ni8', 'ni9', 'ni10', 'ni11'].forEach(id => { score += parseInt(document.getElementById(id).value); });
    const res = document.getElementById('nihssResult');
    if(score >= 21) { res.innerHTML = `NIHSS Skoru: ${score} (Ağır İnme Tablosu)`; res.style.color = "var(--danger)"; } 
    else if(score >= 16) { res.innerHTML = `NIHSS Skoru: ${score} (Orta-Ağır İnme)`; res.style.color = "var(--danger)"; } 
    else if(score >= 5) { res.innerHTML = `NIHSS Skoru: ${score} (Orta İnme)`; res.style.color = "var(--warning)"; } 
    else if(score >= 1) { res.innerHTML = `NIHSS Skoru: ${score} (Hafif İnme)`; res.style.color = "var(--primary)"; }
    else { res.innerHTML = `NIHSS Skoru: 0 (Normal)`; res.style.color = "var(--text-main)"; }
}

// --- Yedekleme Modülü ---
window.exportData = function() {
    const dataStr = JSON.stringify(patients);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'koruyucu_hekim_yedek_' + new Date().toISOString().split('T')[0] + '.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

window.importData = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file,'UTF-8');
        reader.onload = readerEvent => {
            const content = readerEvent.target.result;
            if(confirm('Mevcut veriler silinsin ve yedek dosya yüklensin mi?')) {
                patients = JSON.parse(content);
                saveState();
                renderPatients();
            }
        }
    }
    input.click();
}

// Start
init();
