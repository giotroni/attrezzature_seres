// Costanti e variabili globali
const API_BASE_URL = './php/api.php';
const USE_PHP_API = true;
const SHEET_ID = '1efHWyYHqsZpAbPXuUadz7Mg2ScsZ1iXX15Yv8daVhvg';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyWzNZ91kZBr9D3PhQNO7FLSXypRt1Ret0EvlBMuW_GgIAMKB9r4Ag4GHnvoHCVJCUvsA/exec';

let currentView = 'ubicazione';
let currentFilter = '';
let attrezzature = [];
let filteredData = [];
let equipmentData = [];
let locationsData = [];
let movementLog = [];
let notesLog = [];
let currentEquipmentId = null; // Variabile per tracciare l'attrezzatura corrente

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showLoadingOverlay(message) {
    const overlay = document.getElementById('loadingOverlay');
    const messageElement = document.getElementById('loadingMessage');
    if (messageElement) messageElement.textContent = message || 'Caricamento in corso...';
    if (overlay) overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    
    // Determina il colore in base al tipo di messaggio
    let backgroundColor = '#f44336'; // Rosso per errori
    if (message.includes('✅') || message.includes('successo')) {
        backgroundColor = '#4CAF50'; // Verde per successo
    } else if (message.includes('⚠️') || message.includes('attenzione')) {
        backgroundColor = '#FF9800'; // Arancione per warning
    }
    
    errorElement.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: ${backgroundColor}; 
        color: white; 
        padding: 15px 20px; 
        border-radius: 8px; 
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 300px;
        word-wrap: break-word;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(errorElement);
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.remove();
        }
    }, 5000);
}

function validateNewLocation(location) {
    if (!location) return { valid: false, message: 'L\'ubicazione non può essere vuota' };
    if (location.length > 20) return { valid: false, message: 'L\'ubicazione non può superare i 20 caratteri' };
    
    // Converti in maiuscolo e rimuovi spazi iniziali/finali
    const formattedLocation = location.trim().toUpperCase();
    
    // Verifica se l'ubicazione esiste già (case insensitive)
    if (locationsData.some(existing => existing.toUpperCase() === formattedLocation)) {
        return { valid: false, message: 'Questa ubicazione esiste già nel sistema' };
    }
    
    // Verifica che non contenga caratteri speciali
    if (!/^[A-Z0-9\s-]+$/.test(formattedLocation)) {
        return { valid: false, message: 'L\'ubicazione può contenere solo lettere, numeri, spazi e trattini' };
    }
    
    return { valid: true, formatted: formattedLocation };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('App SERES caricata correttamente');
    
    // Inizializza tutti gli event listeners
    initializeEventListeners();
    
    // Avvia automaticamente il caricamento dei dati dal database
    loadData();
});

function initializeEventListeners() {
    // Menu navigation
    const menuToggle = document.getElementById('menuToggle');
    const menuClose = document.getElementById('menuClose');
    const menuOverlay = document.getElementById('menuOverlay');
    
    if (menuToggle) menuToggle.addEventListener('click', toggleMenu);
    if (menuClose) menuClose.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);
    
    // Search functionality
    const searchToggle = document.getElementById('searchToggle');
    const searchClose = document.getElementById('searchClose');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchInput = document.getElementById('searchInput');
    
    if (searchToggle) searchToggle.addEventListener('click', toggleSearch);
    if (searchClose) searchClose.addEventListener('click', closeSearch);
    if (searchOverlay) {
        searchOverlay.addEventListener('click', function(e) {
            if (e.target === this) closeSearch();
        });
    }
    if (searchInput) {
        searchInput.addEventListener('input', filterContent);
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                closeSearch();
            }
        });
    }

    // Modal functionality
    const closeDetailModalBtn = document.getElementById('closeDetailModal');
    if (closeDetailModalBtn) closeDetailModalBtn.addEventListener('click', closeDetailModal);

    // Refresh button
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) btnRefresh.addEventListener('click', loadData);
    
    // Forms event listeners
    const moveForm = document.getElementById('moveForm');
    if (moveForm) {
        moveForm.addEventListener('submit', function(e) {
            e.preventDefault();
            moveEquipment();
        });
    }

    const notesForm = document.getElementById('updateNotesForm');
    if (notesForm) {
        notesForm.addEventListener('submit', function(e) {
            e.preventDefault();
            updateEquipmentNotes();
        });
    }

    // Checkbox per nuova ubicazione
    const checkbox = document.getElementById('isNewLocationCheckbox');
    if (checkbox) {
        checkbox.addEventListener('change', handleNewLocationCheckbox);
    }

    // Auto-maiuscolo per i campi nome utente
    const userNameField = document.getElementById('userName');
    const noteUserNameField = document.getElementById('noteUserName');
    
    if (userNameField) {
        userNameField.addEventListener('input', function(e) {
            this.value = this.value.toUpperCase();
        });
    }
    
    if (noteUserNameField) {
        noteUserNameField.addEventListener('input', function(e) {
            this.value = this.value.toUpperCase();
        });
    }
    
    // Bottom navigation
    const navUbicazione = document.getElementById('navUbicazione');
    const navCategoria = document.getElementById('navCategoria');
    const navTipo = document.getElementById('navTipo');
    
    if (navUbicazione) navUbicazione.addEventListener('click', () => switchView('ubicazione'));
    if (navCategoria) navCategoria.addEventListener('click', () => switchView('categoria'));
    if (navTipo) navTipo.addEventListener('click', () => switchView('tipo'));

    // Modal close on outside click
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('detailModal');
        if (event.target === modal) {
            closeDetailModal();
        }
    });    // About Modal
    initializeAboutModal();

    // Gestione Modal Nuova Attrezzatura
    initializeNewEquipmentForm(); // Inizializza il form una volta che il DOM è caricato

    // Setup Modal Nuova Attrezzatura
    const newEquipmentModal = document.getElementById('newEquipmentModal');
    const btnAddEquipment = document.getElementById('btnAddEquipment');
    const newEquipmentClose = document.getElementById('newEquipmentClose');
    const newEquipmentCancel = document.getElementById('newEquipmentCancel');
    const newEquipmentForm = document.getElementById('newEquipmentForm');
    const isNewCategoryCheckbox = document.getElementById('isNewCategoryCheckbox');
    const isNewTypeCheckbox = document.getElementById('isNewTypeCheckbox');    // Apri il modal
    btnAddEquipment.addEventListener('click', () => {
        newEquipmentModal.style.display = 'block';
        updateCategorySelect(); // Popola le categorie esistenti
        updateTypeSelect(); // Popola i tipi esistenti
        updateLocationSelectNewEquipment(); // Popola le ubicazioni esistenti
    });    // Gestione checkbox nuova categoria
    isNewCategoryCheckbox.addEventListener('change', updateCategorySelect);    // Gestione checkbox nuovo tipo e nuova ubicazione
    document.getElementById('isNewTypeCheckbox')?.addEventListener('change', updateTypeSelect);
    document.getElementById('isNewLocationCheckbox')?.addEventListener('change', function() {
        const isNewLocation = this.checked;
        const newLocationInput = document.getElementById('newLocationInput');
        const existingLocationDiv = document.getElementById('existingLocationDiv');
        const ubicazioneSelect = document.getElementById('ubicazione');

        if (isNewLocation) {
            existingLocationDiv.style.display = 'none';
            newLocationInput.style.display = 'block';
            newLocationInput.required = true;
            ubicazioneSelect.required = false;
        } else {
            existingLocationDiv.style.display = 'block';
            newLocationInput.style.display = 'none';
            newLocationInput.required = false;
            ubicazioneSelect.required = true;
            
            // Popola il select con le ubicazioni esistenti
            ubicazioneSelect.innerHTML = '<option value="">Seleziona ubicazione...</option>' +
                locationsData.sort().map(location => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`).join('');
        }
    });

    // Chiudi il modal se si clicca fuori
    window.addEventListener('click', (event) => {
        if (event.target === newEquipmentModal) {
            closeNewEquipmentModal();
        }
    });

    // Gestione del form
    newEquipmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData();
        
        // Gestione categoria (esistente o nuova)
        const isNewCategory = document.getElementById('isNewCategoryCheckbox').checked;
        const categoria = isNewCategory 
            ? document.getElementById('newCategoryInput').value.trim()
            : document.getElementById('categoria').value.trim();
        
        if (!categoria) {
            alert('La categoria è obbligatoria');
            return;
        }

        // Gestione tipo (esistente o nuovo)
        const isNewType = document.getElementById('isNewTypeCheckbox').checked;
        const tipo = isNewType 
            ? document.getElementById('newTypeInput').value.trim()
            : document.getElementById('tipo').value.trim();
        
        if (!tipo) {
            alert('Il tipo è obbligatorio');
            return;
        }        // Gestione ubicazione (esistente o nuova)
        const isNewLocation = document.getElementById('isNewLocationCheckbox').checked;
        const ubicazione = isNewLocation 
            ? document.getElementById('newLocationInput').value.trim()
            : document.getElementById('ubicazione').value.trim();
        
        if (!ubicazione) {
            alert('L\'ubicazione è obbligatoria');
            return;
        }

        formData.append('categoria', categoria.toUpperCase());
        formData.append('tipo', tipo.toUpperCase());
        formData.append('marca', document.getElementById('marca').value);
        formData.append('ubicazione', ubicazione.toUpperCase());
        formData.append('userName', document.getElementById('userName').value.toUpperCase());

        try {
            // Costruisci l'URL con i parametri
            const params = new URLSearchParams(formData);
            const response = await fetch(`php/api.php?action=createEquipment&${params.toString()}`);
            const result = await response.json();

            if (result.success) {
                // Mostra un messaggio di successo
                alert(`Attrezzatura creata con successo!\nCodice assegnato: ${result.codice}`);
                closeNewEquipmentModal();
                // Aggiorna la vista
                loadData();
            } else {
                throw new Error(result.message || 'Errore durante la creazione dell\'attrezzatura');
            }
        } catch (error) {
            alert(error.message);
        }
    });
}

function initializeAboutModal() {
    const btnAbout = document.getElementById('btnAbout');
    const aboutModal = document.getElementById('aboutModal');
    const aboutClose = document.getElementById('aboutClose');
    const menuOverlay = document.getElementById('menuOverlay');

    if (btnAbout && aboutModal && aboutClose && menuOverlay) {
        btnAbout.addEventListener('click', function() {
            aboutModal.style.display = 'block';
            menuOverlay.style.display = 'block';
            const slideMenu = document.getElementById('slideMenu');
            if (slideMenu) slideMenu.classList.remove('open');
        });

        aboutClose.addEventListener('click', function() {
            aboutModal.style.display = 'none';
            menuOverlay.style.display = 'none';
        });

        menuOverlay.addEventListener('click', function() {
            if (aboutModal.style.display === 'block') {
                aboutModal.style.display = 'none';
                menuOverlay.style.display = 'none';
            }
        });
    }
}

// ============================================================================
// FORM MANAGEMENT FUNCTIONS
// ============================================================================

// Funzione per ottenere le categorie esistenti
function getExistingCategories() {
    return [...new Set(attrezzature.map(item => item.categoria))].sort();
}

// Funzione helper per popolare i select
function populateSelect(id, options) {
    const select = document.getElementById(id);
    if (!select) return;
    
    select.innerHTML = `<option value="">Seleziona ${id}...</option>`;
    options.forEach(option => {
        if (option) {
            select.innerHTML += `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`;
        }
    });
}

// Funzione per aggiornare la select delle categorie
function updateCategorySelect() {
    const isNewCategory = document.getElementById('isNewCategoryCheckbox').checked;
    const newCategoryInput = document.getElementById('newCategoryInput');
    const existingCategoryDiv = document.getElementById('existingCategoryDiv');
    const categoriaSelect = document.getElementById('categoria');

    if (isNewCategory) {
        existingCategoryDiv.style.display = 'none';
        newCategoryInput.style.display = 'block';
        newCategoryInput.required = true;
        categoriaSelect.required = false;
    } else {
        existingCategoryDiv.style.display = 'block';
        newCategoryInput.style.display = 'none';
        newCategoryInput.required = false;
        categoriaSelect.required = true;

        // Popola il select con le categorie esistenti
        populateSelect('categoria', getExistingCategories());
    }
}

// Funzione per aggiornare la select dei tipi
function updateTypeSelect() {
    const isNewType = document.getElementById('isNewTypeCheckbox').checked;
    const newTypeInput = document.getElementById('newTypeInput');
    const existingTypeDiv = document.getElementById('existingTypeDiv');
    const tipoSelect = document.getElementById('tipo');

    if (isNewType) {
        existingTypeDiv.style.display = 'none';
        newTypeInput.style.display = 'block';
        newTypeInput.required = true;
        tipoSelect.required = false;
    } else {
        existingTypeDiv.style.display = 'block';
        newTypeInput.style.display = 'none';
        newTypeInput.required = false;
        tipoSelect.required = true;

        // Popola il select con i tipi esistenti
        populateSelect('tipo', [...new Set(attrezzature.map(item => item.tipo))].sort());
    }
}

// Funzione per aggiornare la select delle ubicazioni nel form nuova attrezzatura
function updateLocationSelectNewEquipment() {
    const isNewLocation = document.getElementById('isNewLocationCheckbox').checked;
    const newLocationInput = document.getElementById('newLocationInput');
    const existingLocationDiv = document.getElementById('existingLocationDiv');
    const ubicazioneSelect = document.getElementById('ubicazione');

    if (isNewLocation) {
        existingLocationDiv.style.display = 'none';
        newLocationInput.style.display = 'block';
        newLocationInput.required = true;
        ubicazioneSelect.required = false;
    } else {
        existingLocationDiv.style.display = 'block';
        newLocationInput.style.display = 'none';
        newLocationInput.required = false;
        ubicazioneSelect.required = true;

        // Popola il select con le ubicazioni esistenti
        populateSelect('ubicazione', locationsData.sort());
    }
}

// Funzione per inizializzare i campi del form nuova attrezzatura
function initializeNewEquipmentForm() {
    try {
        console.log('Initializing new equipment form...');
        
        // Reset dei campi
        const newInputs = ['newCategoryInput', 'newTypeInput', 'newLocationInput'];
        const existingDivs = ['existingCategoryDiv', 'existingTypeDiv', 'existingLocationDiv'];
        const checkboxes = ['isNewCategoryCheckbox', 'isNewTypeCheckbox', 'isNewLocationCheckbox'];
        
        newInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        
        existingDivs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'block';
        });
        
        checkboxes.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = false;
        });

        // Popola i select solo se abbiamo i dati
        if (attrezzature && attrezzature.length > 0) {
            updateCategorySelect();
            updateTypeSelect();
            updateLocationSelectNewEquipment();
        } else {
            console.log('Warning: No data available to populate selects');
        }
        
        console.log('Form initialized successfully');
    } catch (error) {
        console.error('Error initializing form:', error);
    }
}

// ============================================================================
// DATA LOADING AND API CALLS
// ============================================================================

async function loadData() {
    try {
        showLoadingOverlay('Caricamento dati dal database...');
        console.log('[DEBUG] Chiamata API a:', `${API_BASE_URL}?action=getData`);
        
        const response = await fetch(`${API_BASE_URL}?action=getData`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Errore nella richiesta: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Errore nel caricamento dei dati');
        }
        
        // Aggiorna l'array attrezzature con i dati dal database
        attrezzature = data.data || [];
        
        // Aggiorna anche equipmentData con il mapping corretto per retrocompatibilità
        equipmentData = attrezzature.map(item => ({
            id: item.id,
            codice: item.codice,
            categoria: item.categoria,
            tipo: item.tipo,
            marca: item.marca,
            marcaModello: item.marca,
            ubicazione: item.ubicazione,
            note: item.note,
            doc: item.doc
        }));
        
        // Estrai le ubicazioni uniche
        const locations = new Set();
        attrezzature.forEach(item => {
            if (item.ubicazione) {
                locations.add(item.ubicazione);
            }
        });
        locationsData = Array.from(locations).sort();
        
        // Aggiorna filteredData
        filteredData = [...attrezzature];
        
        // Aggiorna la vista corrente
        renderCurrentView();
        
        console.log('[DEBUG] Dati caricati:', {
            attrezzature: attrezzature.length,
            equipment: equipmentData.length,
            ubicazioni: locationsData.length
        });
        
        showError('✅ Dati aggiornati con successo');
        
    } catch (error) {
        console.error('[DEBUG] Errore nel caricamento:', error);
        showError('❌ Errore nel caricamento dei dati: ' + error.message);
    } finally {
        hideLoadingOverlay();
    }
}

async function loadMovementHistory(codice) {
    try {
        console.log('[DEBUG] Chiamata API getMovementHistory per codice:', codice);
        
        const response = await fetch(`${API_BASE_URL}?action=getMovementHistory&codice=${encodeURIComponent(codice)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Errore nel caricamento dello storico');
        }

        // Visualizza lo storico
        displayMovementHistory(data.data || []);
        
    } catch (error) {
        console.error('Errore nel caricamento dello storico:', error);
        
        // Mostra messaggio di errore nel container dello storico
        const historyContainer = document.getElementById('movementHistory');
        if (historyContainer) {
            historyContainer.innerHTML = '<p style="color: #ff4444;">Errore nel caricamento dello storico: ' + error.message + '</p>';
        }
    }
}

// ============================================================================
// HISTORY FUNCTIONS
// ============================================================================

async function loadNotesHistory(codice) {
    try {
        console.log('[DEBUG] Chiamata API loadNotesHistory per codice:', codice);
        
        const response = await fetch(`${API_BASE_URL}?action=getNotesHistory&codice=${encodeURIComponent(codice)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Errore nella richiesta: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Errore nel caricamento dello storico note');
        }

        // Aggiorna lo storico delle note
        notesLog = data.data || [];
        
        // Visualizza lo storico
        displayNotesHistory(notesLog);
        
        return true;
    } catch (error) {
        console.error('[DEBUG] Errore nel caricamento storico note:', error);
        showError('❌ ' + error.message);
        return false;
    }
}

// Versione fixed della funzione loadNotesHistory
async function fixedLoadNotesHistory(codice) {
    try {
        await loadNotesHistory(codice);
        return true;
    } catch (error) {
        console.error('[DEBUG] Errore in fixedLoadNotesHistory:', error);
        return false;
    }
}

// Esponi la funzione fixed globalmente
window.fixedLoadNotesHistory = fixedLoadNotesHistory;

// ============================================================================
// UI FUNCTIONS
// ============================================================================

function toggleMenu() {
    const slideMenu = document.getElementById('slideMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    if (slideMenu) slideMenu.classList.add('open');
    if (menuOverlay) menuOverlay.classList.add('show');
}

function closeMenu() {
    const slideMenu = document.getElementById('slideMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    if (slideMenu) slideMenu.classList.remove('open');
    if (menuOverlay) menuOverlay.classList.remove('show');
}

function toggleSearch() {
    const searchOverlay = document.getElementById('searchOverlay');
    if (searchOverlay) {
        searchOverlay.classList.add('show');
        setTimeout(function() {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
        }, 300);
    }
}

function closeSearch() {
    const searchOverlay = document.getElementById('searchOverlay');
    if (searchOverlay) searchOverlay.classList.remove('show');
}

function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.classList.remove('active');
    });
    const activeNav = document.querySelector('[data-view="' + view + '"]');
    if (activeNav) activeNav.classList.add('active');
    
    renderCurrentView();
}

function filterContent() {
    const searchInput = document.getElementById('searchInput');
    const searchText = document.getElementById('searchText');
    
    if (searchInput && searchText) {
        currentFilter = searchInput.value.toLowerCase();
        
        if (currentFilter) {
            searchText.textContent = currentFilter;
            searchText.classList.add('active');
        } else {
            searchText.textContent = 'Ricerca';
            searchText.classList.remove('active');
        }
        
        renderCurrentView();
    }
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

function renderCurrentView() {
    const container = document.getElementById('viewContent');
    if (!container) return;
    
    if (currentView === 'ubicazione') {
        renderLocationView(container);
    } else if (currentView === 'categoria') {
        renderCategoryView(container);
    } else if (currentView === 'tipo') {
        renderTypeView(container);
    }
}

function renderLocationView(container) {
    const locations = getLocationGroups();
    
    if (locations.length === 0) {
        container.innerHTML = '<div class="loading"><p>Nessuna ubicazione trovata</p></div>';
        return;
    }

    container.innerHTML = locations.map(function(location) {
        return '<div class="location-card" onclick="showLocationEquipment(\'' + escapeHtml(location.name) + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">📍 ' + escapeHtml(location.name) + '</div>' +
                '<div class="card-count">' + location.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + location.types.slice(0, 3).map(escapeHtml).join(', ') + (location.types.length > 3 ? '...' : '') + '</div>' +
        '</div>';
    }).join('');
}

function renderCategoryView(container) {
    const categories = getCategoryGroups();
    
    if (categories.length === 0) {
        container.innerHTML = '<div class="loading"><p>Nessuna categoria trovata</p></div>';
        return;
    }

    container.innerHTML = categories.map(function(category) {
        return '<div class="category-card" onclick="showCategoryEquipment(\'' + escapeHtml(category.name) + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">📂 ' + escapeHtml(category.name) + '</div>' +
                '<div class="card-count">' + category.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + category.types.slice(0, 3).map(escapeHtml).join(', ') + (category.types.length > 3 ? '...' : '') + '</div>' +
        '</div>';
    }).join('');
}

function renderTypeView(container) {
    const types = getTypeGroups();
    
    if (types.length === 0) {
        container.innerHTML = '<div class="loading"><p>Nessun tipo trovato</p></div>';
        return;
    }

    container.innerHTML = types.map(function(type) {
        return '<div class="type-card" onclick="showTypeEquipment(\'' + escapeHtml(type.name) + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">🔧 ' + escapeHtml(type.name) + '</div>' +
                '<div class="card-count">' + type.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + type.locations.slice(0, 3).map(escapeHtml).join(', ') + (type.locations.length > 3 ? '...' : '') + '</div>' +
        '</div>';
    }).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// DATA GROUPING FUNCTIONS
// ============================================================================

function getLocationGroups() {
    const filtered = getFilteredEquipment();
    const groups = {};
    
    filtered.forEach(function(item) {
        if (!groups[item.ubicazione]) {
            groups[item.ubicazione] = {
                name: item.ubicazione,
                count: 0,
                types: []
            };
        }
        groups[item.ubicazione].count++;
        if (groups[item.ubicazione].types.indexOf(item.tipo) === -1) {
            groups[item.ubicazione].types.push(item.tipo);
        }
    });

    return Object.values(groups).sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
}

function getCategoryGroups() {
    const filtered = getFilteredEquipment();
    const groups = {};
    
    filtered.forEach(function(item) {
        if (!groups[item.categoria]) {
            groups[item.categoria] = {
                name: item.categoria,
                count: 0,
                types: []
            };
        }
        groups[item.categoria].count++;
        if (groups[item.categoria].types.indexOf(item.tipo) === -1) {
            groups[item.categoria].types.push(item.tipo);
        }
    });

    return Object.values(groups).sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
}

function getTypeGroups() {
    const filtered = getFilteredEquipment();
    const groups = {};
    
    filtered.forEach(function(item) {
        if (!groups[item.tipo]) {
            groups[item.tipo] = {
                name: item.tipo,
                count: 0,
                locations: []
            };
        }
        groups[item.tipo].count++;
        if (groups[item.tipo].locations.indexOf(item.ubicazione) === -1) {
            groups[item.tipo].locations.push(item.ubicazione);
        }
    });

    return Object.values(groups).sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
}

function getFilteredEquipment() {
    if (!currentFilter) return equipmentData;
    
    return equipmentData.filter(function(item) {
        return item.codice.toLowerCase().indexOf(currentFilter) !== -1 ||
                item.tipo.toLowerCase().indexOf(currentFilter) !== -1 ||
                item.marcaModello.toLowerCase().indexOf(currentFilter) !== -1 ||
                item.ubicazione.toLowerCase().indexOf(currentFilter) !== -1 ||
                item.categoria.toLowerCase().indexOf(currentFilter) !== -1;
    });
}

// ============================================================================
// EQUIPMENT LIST AND DETAIL FUNCTIONS
// ============================================================================

function showLocationEquipment(location) {
    showEquipmentList('ubicazione', location);
}

function showCategoryEquipment(category) {
    showEquipmentList('categoria', category);
}

function showTypeEquipment(type) {
    showEquipmentList('tipo', type);
}

function showEquipmentList(filterType, filterValue) {
    const container = document.getElementById('viewContent');
    let filteredEquipment = equipmentData;
    
    if (filterType === 'ubicazione') {
        filteredEquipment = equipmentData.filter(function(item) {
            return item.ubicazione === filterValue;
        });
    } else if (filterType === 'categoria') {
        filteredEquipment = equipmentData.filter(function(item) {
            return item.categoria === filterValue;
        });
    } else if (filterType === 'tipo') {
        filteredEquipment = equipmentData.filter(function(item) {
            return item.tipo === filterValue;
        });
    }
    
    const backButton = '<button class="back-button" onclick="renderCurrentView()">← Torna alla vista ' + currentView + '</button>';
    
    if (filteredEquipment.length === 0) {
        container.innerHTML = backButton + '<div class="loading"><p>Nessuna attrezzatura trovata</p></div>';
        return;
    }

    const equipmentCards = filteredEquipment.map(function(item) {
        return '<div class="equipment-card" data-codice="' + escapeHtml(item.codice) + '">' +
            '<div class="equipment-header">' +
                '<div class="equipment-code">📦 ' + escapeHtml(item.codice) + ' - ' + escapeHtml(item.categoria) + '</div>' +
            '</div>' +
            '<div class="equipment-name">' + escapeHtml(item.tipo) + '</div>' +
            '<div class="equipment-brand">' + escapeHtml(item.marca || '-') + '</div>' +
            '<div class="equipment-location">📍 ' + escapeHtml(item.ubicazione) + '</div>' +
        '</div>';
    }).join('');

    container.innerHTML = backButton + equipmentCards;
    attachEquipmentCardListeners();
}

function attachEquipmentCardListeners() {
    document.querySelectorAll('.equipment-card').forEach(card => {
        card.addEventListener('click', function() {
            const codice = this.dataset.codice;
            if (codice) {
                showEquipmentDetail(codice);
            }
        });
    });
}

function showEquipmentDetail(codice) {    // Cerca l'attrezzatura nell'array delle attrezzature usando il codice
    const equipment = attrezzature.find(item => item.codice === codice);
    if (!equipment) {
        showError('Attrezzatura non trovata');
        return;
    }

    // Imposta la variabile globale
    currentEquipmentId = equipment.codice;
    
    // Ottieni i riferimenti a tutti gli elementi DOM necessari
    const elements = {
        codice: document.getElementById('detailCodice'),
        categoria: document.getElementById('detailCategoria'),
        tipo: document.getElementById('detailTipo'),
        marca: document.getElementById('detailMarca'),
        ubicazione: document.getElementById('detailUbicazione'),
        note: document.getElementById('detailNote'),
        currentLocation: document.getElementById('currentLocation'),
        modal: document.getElementById('detailModal')
    };
    
    // Popola il select delle ubicazioni nel form di spostamento
    updateLocationSelectMove(locationsData);

    // Controlla che tutti gli elementi essenziali esistano
    const requiredElements = ['codice', 'categoria', 'tipo', 'marca', 'ubicazione', 'modal'];
    const missingElements = requiredElements.filter(key => !elements[key]);
    
    if (missingElements.length > 0) {
        showError(`Errore: elementi mancanti nel DOM: ${missingElements.join(', ')}`);
        console.error('Missing DOM elements:', missingElements);
        return;
    }

    // Popola i dettagli nel modal
    elements.codice.textContent = equipment.codice;
    elements.categoria.textContent = equipment.categoria;
    elements.tipo.textContent = equipment.tipo;
    elements.marca.textContent = equipment.marca;
    elements.ubicazione.textContent = equipment.ubicazione;
    
    // Aggiorna il titolo del modal con marca/modello
    const modalTitle = document.querySelector('#detailModal .modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = `Dettaglio Attrezzatura - ${equipment.codice}`;
    }
    
    // Popola note se l'elemento esiste ma NON precompilare il campo
    if (elements.note) {
        elements.note.value = ''; // Campo sempre vuoto per nuove note
    }
    
    // Gestione ubicazione attuale per il form di spostamento
    if (elements.currentLocation) {
        elements.currentLocation.value = equipment.ubicazione;
    }
    
    // Aggiorna la lista delle ubicazioni disponibili per lo spostamento
    updateLocationSelect(equipment);
    
    // Mostra il modal
    elements.modal.style.display = 'block';
    
    // Carica lo storico movimenti e note con un piccolo delay per assicurarsi che il modal sia renderizzato
    setTimeout(() => {
        console.log('[DEBUG] Timeout - Chiamata loadMovementHistory per:', equipment.codice);
        loadMovementHistory(equipment.codice);
        
        console.log('[DEBUG] Timeout - Chiamata FIXED loadNotesHistory per:', equipment.codice);
        // USA LA VERSIONE CHE FUNZIONA
        if (typeof window.fixedLoadNotesHistory === 'function') {
            window.fixedLoadNotesHistory(equipment.codice);
        } else {
            console.error('fixedLoadNotesHistory non trovata!');
        }
    }, 100);
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Reset della variabile globale
    currentEquipmentId = null;
    
    // Reset dei campi del form se esistono
    const formElements = {
        newLocation: document.getElementById('newLocation'),
        detailNote: document.getElementById('detailNote'),
        userName: document.getElementById('userName'),
        noteUserName: document.getElementById('noteUserName')
    };
    
    // Reset solo degli elementi che esistono
    Object.values(formElements).forEach(element => {
        if (element) {
            element.value = '';
        }
    });

    // Reset del checkbox
    const checkbox = document.getElementById('isNewLocationCheckbox');
    if (checkbox) checkbox.checked = false;
}

function closeNewEquipmentModal() {
    const newEquipmentModal = document.getElementById('newEquipmentModal');
    const newEquipmentForm = document.getElementById('newEquipmentForm');
    
    newEquipmentModal.style.display = 'none';
    newEquipmentForm.reset();

    // Reset dei campi categoria
    document.getElementById('newCategoryInput').style.display = 'none';
    document.getElementById('existingCategoryDiv').style.display = 'block';

    // Reset dei campi tipo
    document.getElementById('newTypeInput').style.display = 'none';
    document.getElementById('existingTypeDiv').style.display = 'block';

    // Reset dei campi ubicazione
    document.getElementById('newLocationInput').style.display = 'none';
    document.getElementById('existingLocationDiv').style.display = 'block';

    // Aggiorna i select con i dati esistenti
    updateCategorySelect();
    updateTypeSelect();
    updateLocationSelectNewEquipment();
}

// ============================================================================
// HISTORY DISPLAY FUNCTIONS
// ============================================================================

function displayMovementHistory(history) {
    const historyContainer = document.getElementById('movementHistory');
    if (!historyContainer) return;

    if (!history || history.length === 0) {
        historyContainer.innerHTML = '<p style="color: #666; font-style: italic;">Nessuno storico disponibile</p>';
        return;
    }

    const rows = history.map(entry => {
        const date = new Date(entry.timestamp).toLocaleString('it-IT');
        let details = '';
        
        if (entry.azione === 'spostamento') {
            details = `Spostato da <strong>${escapeHtml(entry.vecchia_ubicazione || '?')}</strong> a <strong>${escapeHtml(entry.nuova_ubicazione)}</strong> da <strong>${escapeHtml(entry.user_name)}</strong>`;
        } else if (entry.azione === 'modifica_note') {
            details = `Note modificate da <strong>${escapeHtml(entry.user_name)}</strong>`;
            if (entry.note_precedenti || entry.note_nuove) {
                details += `<br>Da: "${escapeHtml(entry.note_precedenti || '')}"<br>A: "${escapeHtml(entry.note_nuove || '')}"`;
            }
        }
        
        return `
            <div class="history-entry">
                <div class="history-date">${escapeHtml(date)}</div>
                <div class="history-details">${details}</div>
            </div>
        `;
    });

    historyContainer.innerHTML = rows.join('');
}

function displayNotesHistory(history) {
    const notesHistoryContainer = document.getElementById('notesHistory');
    if (!notesHistoryContainer) return;

    if (!history || history.length === 0) {
        notesHistoryContainer.innerHTML = '<p style="color: #666; font-style: italic;">Nessuno storico note disponibile</p>';
        return;
    }

    const rows = history.map(entry => {
        const date = new Date(entry.timestamp).toLocaleString('it-IT');
        let details = '';
        let icon = '';
        
        switch(entry.azione) {
            case 'creazione':
                icon = '✏️';
                details = `<strong>${escapeHtml(entry.user_name)}</strong> ha aggiunto una nota:<br>"${escapeHtml(entry.nota_nuova || '')}"`;
                break;
            case 'modifica':
                icon = '📝';
                details = `<strong>${escapeHtml(entry.user_name)}</strong> ha modificato una nota:<br>`;
                if (entry.nota_precedente && entry.nota_nuova) {
                    details += `Da: "${escapeHtml(entry.nota_precedente)}"<br>A: "${escapeHtml(entry.nota_nuova)}"`;
                } else if (entry.nota_nuova) {
                    details += `Nuova nota: "${escapeHtml(entry.nota_nuova)}"`;
                }
                break;
            case 'cancellazione':
                icon = '🗑️';
                details = `<strong>${escapeHtml(entry.user_name)}</strong> ha rimosso la nota:<br>"${escapeHtml(entry.nota_precedente || '')}"`;
                break;
            default:
                icon = '📄';
                details = `<strong>${escapeHtml(entry.user_name)}</strong> - ${escapeHtml(entry.azione)}`;
        }
        
        return `
            <div class="history-entry" data-action="${escapeHtml(entry.azione)}">
                <div class="history-date">${icon} ${escapeHtml(date)}</div>
                <div class="history-details">${details}</div>
            </div>
        `;
    });

    notesHistoryContainer.innerHTML = rows.join('');
}

// ============================================================================
// FORM HANDLING FUNCTIONS
// ============================================================================

async function moveEquipment() {
    // Verifica che currentEquipmentId sia definito
    if (!currentEquipmentId) {
        showError('⚠️ Errore: nessuna attrezzatura selezionata');
        return;
    }

    let newLocation = document.getElementById('newLocation')?.value?.trim();
    const userName = document.getElementById('userName')?.value?.trim();
    const isNewLocation = document.getElementById('isNewLocationCheckbox')?.checked || false;
    
    console.log('[DEBUG] Avvio spostamento - codice:', currentEquipmentId, 'nuova ubicazione:', newLocation);
    console.log('[DEBUG] Verifica campi - userName:', userName, 'newLocation:', newLocation);
    
    if (!userName) {
        showError('⚠️ Inserisci il tuo nome');
        const userNameField = document.getElementById('userName');
        if (userNameField) userNameField.focus();
        return;
    }

    if (isNewLocation) {
        // Valida e formatta la nuova ubicazione
        const validation = validateNewLocation(newLocation);
        if (!validation.valid) {
            console.log('[DEBUG] Validazione ubicazione fallita:', validation.message);
            showError('⚠️ ' + validation.message);
            return;
        }
        newLocation = validation.formatted;
        
        // Aggiungi la nuova ubicazione alla lista
        if (!locationsData.includes(newLocation)) {
            locationsData.push(newLocation);
            locationsData.sort();
        }
    } else if (!newLocation) {
        showError('⚠️ Seleziona una ubicazione');
        const locationField = document.getElementById('newLocation');
        if (locationField) locationField.focus();
        return;
    }
    
    try {
        showLoadingOverlay('Spostamento attrezzatura in corso...');
        console.log('[DEBUG] Inizio spostamento - codice:', currentEquipmentId, 'nuova ubicazione:', newLocation, 'utente:', userName);

        const formData = new FormData();
        formData.append('codice', currentEquipmentId);
        formData.append('newLocation', newLocation);
        formData.append('userName', userName);

        console.log('[DEBUG] FormData creato, invio richiesta POST a:', API_BASE_URL + '?action=moveEquipment');

        const response = await fetch(`${API_BASE_URL}?action=moveEquipment`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            },
            body: formData
        });

        console.log('[DEBUG] Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[DEBUG] Response data:', result);

        if (!result.success) {
            throw new Error(result.message || 'Errore durante lo spostamento');
        }

        // Aggiorna i dati in memoria
        const index = attrezzature.findIndex(a => a.codice === currentEquipmentId);
        if (index !== -1) {
            attrezzature[index].ubicazione = newLocation;
            // Aggiorna anche equipmentData per consistenza
            const equipIndex = equipmentData.findIndex(e => e.codice === currentEquipmentId);
            if (equipIndex !== -1) {
                equipmentData[equipIndex].ubicazione = newLocation;
            }
        }

        // Aggiorna la visualizzazione dell'ubicazione attuale nel modal
        const detailUbicazione = document.getElementById('detailUbicazione');
        if (detailUbicazione) {
            detailUbicazione.textContent = newLocation;
        }

        // Ricarica lo storico dei movimenti dopo lo spostamento
        await loadMovementHistory(currentEquipmentId);
        
        // Reset del form spostamento
        const formElements = {
            newLocation: document.getElementById('newLocation'),
            userName: document.getElementById('userName'),
            checkbox: document.getElementById('isNewLocationCheckbox')
        };
        
        if (formElements.newLocation) formElements.newLocation.value = '';
        if (formElements.userName) formElements.userName.value = '';
        if (formElements.checkbox) formElements.checkbox.checked = false;

        // Aggiorna il select delle ubicazioni per riflettere la nuova ubicazione corrente
        const equipment = attrezzature.find(item => item.codice === currentEquipmentId);
        if (equipment) {
            updateLocationSelect(equipment);
        }
        
        showError('✅ Attrezzatura spostata con successo');
        
    } catch (error) {
        console.error('[DEBUG] Errore durante lo spostamento:', error);
        showError('❌ ' + error.message);
    } finally {
        hideLoadingOverlay();
    }
}

async function updateEquipmentNotes() {
    if (!currentEquipmentId) {
        showError('⚠️ Errore: nessuna attrezzatura selezionata');
        return;
    }

    const noteText = document.getElementById('detailNote')?.value || '';
    const userName = document.getElementById('noteUserName')?.value?.trim();
    
    if (!userName) {
        showError('⚠️ Inserisci il tuo nome');
        const userNameField = document.getElementById('noteUserName');
        if (userNameField) userNameField.focus();
        return;
    }
    
    try {
        showLoadingOverlay('Salvataggio note...');
        
        console.log('[DEBUG] Inizio salvataggio note per codice:', currentEquipmentId);
        
        const formData = new FormData();
        formData.append('codice', currentEquipmentId);
        formData.append('note', noteText);
        formData.append('userName', userName);

        console.log('[DEBUG] FormData creato, invio richiesta POST a:', API_BASE_URL + '?action=updateNotes');

        const response = await fetch(`${API_BASE_URL}?action=updateNotes`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            },
            body: formData
        });

        console.log('[DEBUG] Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('[DEBUG] Response data:', result);

        if (!result.success) {
            throw new Error(result.message || 'Errore nel salvataggio delle note');
        }

        // Aggiorna i dati in memoria
        const index = attrezzature.findIndex(a => a.codice === currentEquipmentId);
        if (index !== -1) {
            attrezzature[index].note = noteText;
            // Aggiorna anche equipmentData per consistenza
            const equipIndex = equipmentData.findIndex(e => e.codice === currentEquipmentId);
            if (equipIndex !== -1) {
                equipmentData[equipIndex].note = noteText;
            }
        }        // Ricarica lo storico note e movimenti per vedere le modifiche
        try {
            await Promise.all([
                loadNotesHistory(currentEquipmentId),
                loadMovementHistory(currentEquipmentId)
            ]);
        } catch (error) {
            console.error('[DEBUG] Errore nel caricamento degli storici:', error);
        }

        // Reset del form note
        const noteUserNameField = document.getElementById('noteUserName');
        if (noteUserNameField) noteUserNameField.value = '';

        showError('✅ Note salvate con successo');

    } catch (error) {
        console.error('[DEBUG] Errore nel salvataggio delle note:', error);
        showError('❌ Errore nel salvataggio: ' + error.message);
    } finally {
        hideLoadingOverlay();
    }
}

// ============================================================================
// LOCATION MANAGEMENT FUNCTIONS
// ============================================================================

function handleNewLocationCheckbox() {
    const isNewLocation = document.getElementById('isNewLocationCheckbox').checked;
    const locationContainer = document.getElementById('existingLocationDiv');
    const select = document.getElementById('newLocation');
    
    if (isNewLocation) {
        // Converti il select in input
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'newLocation';
        input.className = 'form-input';
        input.required = true;
        input.placeholder = 'Inserisci nuova ubicazione';
        input.style.textTransform = 'uppercase';
        select.parentNode.replaceChild(input, select);
    } else {
        // Riconverti l'input in select
        const select = document.createElement('select');
        select.id = 'newLocation';
        select.className = 'form-select';
        select.required = true;
        
        const currentInput = document.getElementById('newLocation');
        currentInput.parentNode.replaceChild(select, currentInput);
        
        // Aggiorna il select con le ubicazioni
        updateLocationSelect(attrezzature.find(a => a.codice === currentEquipmentId));
    }
}

// Gestione della selezione ubicazione nel form nuova attrezzatura
function updateLocationSelectNewEquipment() {
    const isNewLocation = document.getElementById('isNewLocationCheckbox').checked;
    const newLocationInput = document.getElementById('newLocationInput');
    const existingLocationDiv = document.getElementById('existingLocationDiv');
    const ubicazioneSelect = document.getElementById('ubicazione');
    
    console.log('updateLocationSelectNewEquipment called, isNewLocation:', isNewLocation);
    
    if (isNewLocation) {
        existingLocationDiv.style.display = 'none';
        newLocationInput.style.display = 'block';
        newLocationInput.required = true;
        ubicazioneSelect.required = false;
    } else {
        existingLocationDiv.style.display = 'block';
        newLocationInput.style.display = 'none';
        newLocationInput.required = false;
        ubicazioneSelect.required = true;
        
        // Popola il select con le ubicazioni esistenti
        ubicazioneSelect.innerHTML = '<option value="">Seleziona ubicazione...</option>';
        if (locationsData && locationsData.length > 0) {
            const locations = locationsData.sort();
            locations.forEach(location => {
                ubicazioneSelect.innerHTML += `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`;
            });
        } else {
            // Fallback sulle ubicazioni delle attrezzature esistenti
            const locations = [...new Set(attrezzature.map(item => item.ubicazione))].sort();
            locations.forEach(location => {
                if (location) {
                    ubicazioneSelect.innerHTML += `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`;
                }
            });
        }
    }
}

// Funzione per aggiornare la select delle ubicazioni nel form di dettaglio
function updateLocationSelect(equipment) {
    const select = document.getElementById('newLocation');
    if (!select) return;

    // Resetta il checkbox di nuova ubicazione
    const checkbox = document.getElementById('isNewLocationCheckbox');
    if (checkbox) checkbox.checked = false;

    // Se è un input (nuova ubicazione), riconvertilo in select
    if (select.tagName.toLowerCase() === 'input') {
        const newSelect = document.createElement('select');
        newSelect.id = 'newLocation';
        newSelect.className = 'form-select';
        newSelect.required = true;
        select.parentNode.replaceChild(newSelect, select);
    }

    // Pulisci il select
    select.innerHTML = '<option value="">Seleziona ubicazione...</option>';
    
    // Usa locationsData se disponibile, altrimenti usa le ubicazioni da attrezzature
    const availableLocations = locationsData.length > 0 ? 
        locationsData : 
        Array.from(new Set(attrezzature.map(item => item.ubicazione))).filter(Boolean);

    // Ordina le ubicazioni alfabeticamente
    availableLocations.sort((a, b) => a.localeCompare(b));

    // Aggiungi tutte le ubicazioni tranne quella corrente
    availableLocations
        .filter(loc => loc !== equipment.ubicazione)
        .forEach(loc => {
            const option = document.createElement('option');
            option.value = loc;
            option.textContent = loc;
            select.appendChild(option);
        });

    // Aggiorna il campo hidden con l'ubicazione corrente
    const currentLocationField = document.getElementById('currentLocation');
    if (currentLocationField) {
        currentLocationField.value = equipment.ubicazione;
    }

    console.log('[DEBUG] Ubicazioni caricate nel select:', select.options.length - 1);
}

// Funzione per aggiornare la select delle ubicazioni nel form di spostamento
function updateLocationSelectMove(existingLocations) {
    const ubicazioneSelect = document.getElementById('moveLocation');
    if (!ubicazioneSelect) return;

    ubicazioneSelect.innerHTML = '<option value="">Seleziona ubicazione...</option>';
    existingLocations.forEach(location => {
        if (location) {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            ubicazioneSelect.appendChild(option);
        }
    });
}