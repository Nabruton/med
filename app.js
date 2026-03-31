// --- API & State Synchronization ---
const API_URL = '/api/patients';
let patients = [];

// Sunucudan verileri çek
async function fetchPatients() {
    try {
        const response = await fetch(API_URL);
        patients = await response.json();
        renderPatients();
    } catch (error) {
        console.error('Veri çekilirken hata oluştu:', error);
    }
}

// Sunucuya verileri kaydet
async function saveState() {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patients)
        });
    } catch (error) {
        console.error('Veri kaydedilirken hata oluştu:', error);
    }
}

// --- Init & Tab Switching ---
function init() {
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    setupTabs();
    setupCalculators();
    setupModals();
    fetchPatients(); 
}

function setupTabs() {
    const links = document.querySelectorAll('.nav-menu a');
    const tabs = document.querySelectorAll('.tab-content');
    
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-tab');
            
            // Eğer zaten aktif olana tıklandıysa, kapat (Toggle)
            if (link.classList.contains('active')) {
                link.classList.remove('active');
                document.getElementById('tab-' + target).classList.add('hidden');
                document.getElementById('tab-' + target).classList.remove('active');
                return;
            }

            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            tabs.forEach(t => { 
                t.classList.add('hidden');
                t.classList.remove('active');
            });
            document.getElementById('tab-' + target).classList.remove('hidden');
            document.getElementById('tab-' + target).classList.add('active');
        });
    });
}

// --- Patient Dashboard Logic ---
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
    }

    filtered.forEach(p => {
        let tagsHtml = '';
        if (p.tags) {
            tagsHtml = p.tags.map(t => {
                let tagClass = t.split(' ')[0];
                return `<span class="tag-chip tag-${tagClass}">${t}</span>`;
            }).join('');
        }
        
        const card = document.createElement('div');
        card.className = 'patient-card glass';
        card.innerHTML = `
            <div class="card-header">
                <span class="p-bed">${p.bed}</span>
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
        document.getElementById('modalTitle').innerText = 'Yeni Hasta Kaydı';
        modal.classList.add('active');
    });

    document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal').addEventListener('click', () => modal.classList.remove('active'));

    patientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const editId = document.getElementById('editPatientId').value;
        const checkedTags = [];
        document.querySelectorAll('#tagsSelector input:checked').forEach(chk => checkedTags.push(chk.value));

        const patientData = {
            name: document.getElementById('pName').value,
            bed: document.getElementById('pBed').value,
            diagnosis: document.getElementById('pDiagnosis').value,
            notes: document.getElementById('pNotes').value,
            tags: checkedTags
        };

        if (editId) {
            const index = patients.findIndex(p => p.id == editId);
            patients[index] = { ...patients[index], ...patientData };
        } else {
            patientData.id = Date.now();
            patients.push(patientData);
        }

        await saveState(); // Sunucuya kaydet
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
    document.getElementById('pDiagnosis').value = p.diagnosis;
    document.getElementById('pNotes').value = p.notes;
    document.querySelectorAll('#tagsSelector input').forEach(chk => chk.checked = p.tags && p.tags.includes(chk.value));
    document.getElementById('modalTitle').innerText = 'Hasta Bilgilerini Düzenle';
    modal.classList.add('active');
}

window.deletePatient = async function(id) {
    if (confirm('Hastayı sistemden kaldırmak istediğinize emin misiniz?')) {
        patients = patients.filter(p => p.id !== id);
        await saveState(); // Sunucuyla senkronize et
        renderPatients(document.getElementById('searchInput').value);
    }
}

// --- Calculators ---
function setupCalculators() {
    // qSOFA
    const qBoxes = ['qsofa1', 'qsofa2', 'qsofa3'];
    qBoxes.forEach(id => document.getElementById(id).addEventListener('change', calculateQsofa));
    
    // GCS
    const gcsSelects = ['gcsE', 'gcsV', 'gcsM'];
    gcsSelects.forEach(id => document.getElementById(id).addEventListener('change', calculateGcs));
    
    // CURB-65
    const curbBoxes = ['curbC', 'curbU', 'curbR', 'curbB', 'curb65'];
    curbBoxes.forEach(id => document.getElementById(id).addEventListener('change', calculateCurb));
    
    // Wells
    const wellsBoxes = ['wells1', 'wells2', 'wells3', 'wells4', 'wells5', 'wells6', 'wells7'];
    wellsBoxes.forEach(id => document.getElementById(id).addEventListener('change', calculateWells));
}

function calculateQsofa() {
    let score = 0;
    if(document.getElementById('qsofa1').checked) score++;
    if(document.getElementById('qsofa2').checked) score++;
    if(document.getElementById('qsofa3').checked) score++;
    const res = document.getElementById('qsofaResult');
    if (score >= 2) { res.innerHTML = `Skor: ${score} (Yüksek Risk)`; res.style.color = "var(--danger)"; }
    else { res.innerHTML = `Skor: ${score} (Düşük Risk)`; res.style.color = "var(--primary)"; }
}

function calculateGcs() {
    let total = parseInt(document.getElementById('gcsE').value) + parseInt(document.getElementById('gcsV').value) + parseInt(document.getElementById('gcsM').value);
    const res = document.getElementById('gcsResult');
    res.innerText = `Toplam GKS: ${total} / 15`;
    if(total <= 8) { res.style.color = "var(--danger)"; }
    else { res.style.color = "var(--primary)"; }
}

function calculateCurb() {
    let score = 0;
    ['curbC', 'curbU', 'curbR', 'curbB', 'curb65'].forEach(id => {
        if(document.getElementById(id).checked) score++;
    });
    const res = document.getElementById('curbResult');
    if(score >= 3) {
        res.innerHTML = `Skor: ${score} (Ağır - Yoğun Bakım Yatışı)`;
        res.style.color = "var(--danger)";
    } else if (score >= 2) {
        res.innerHTML = `Skor: ${score} (Orta - Kronik hastalığa göre yakın takip)`;
        res.style.color = "var(--warning)";
    } else {
        res.innerHTML = `Skor: ${score} (Hafif - Ayaktan Tedavi Planlanabilir)`;
        res.style.color = "var(--primary)";
    }
}

function calculateWells() {
    let score = 0;
    ['wells1', 'wells2'].forEach(id => { if(document.getElementById(id).checked) score += 3; });
    ['wells3', 'wells4', 'wells5'].forEach(id => { if(document.getElementById(id).checked) score += 1.5; });
    ['wells6', 'wells7'].forEach(id => { if(document.getElementById(id).checked) score += 1; });
    
    const res = document.getElementById('wellsResult');
    if(score > 6) {
        res.innerHTML = `Skor: ${score} (Yüksek Olasılık >%60)`;
        res.style.color = "var(--danger)";
    } else if (score >= 2) {
        res.innerHTML = `Skor: ${score} (Orta Olasılık Mümkün)`;
        res.style.color = "var(--warning)";
    } else {
        res.innerHTML = `Skor: ${score} (Düşük Olasılık <%10)`;
        res.style.color = "var(--primary)";
    }
}

// Start
init();
