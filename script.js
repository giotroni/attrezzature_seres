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
    });

    // About Modal
    initializeAboutModal();

    // Gestione Modal Nuova Attrezzatura
    const newEquipmentModal = document.getElementById('newEquipmentModal');
    const btnAddEquipment = document.getElementById('btnAddEquipment');
    const newEquipmentClose = document.getElementById('newEquipmentClose');
    const newEquipmentCancel = document.getElementById('newEquipmentCancel');
    const newEquipmentForm = document.getElementById('newEquipmentForm');

    // Apri il modal
    if (btnAddEquipment) {
        btnAddEquipment.addEventListener('click', () => {
            newEquipmentModal.style.display = 'block';
            document.getElementById('categoria').focus();
        });
    }

    // Chiudi il modal
    function closeNewEquipmentModal() {
        newEquipmentModal.style.display = 'none';
        newEquipmentForm.reset();
    }

    if (newEquipmentClose) newEquipmentClose.addEventListener('click', closeNewEquipmentModal);
    if (newEquipmentCancel) newEquipmentCancel.addEventListener('click', closeNewEquipmentModal);

    // Chiudi il modal se si clicca fuori
    window.addEventListener('click', (event) => {
        if (event.target === newEquipmentModal) {
            closeNewEquipmentModal();
        }
    });

    // Gestione del form
    if (newEquipmentForm) {
        newEquipmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(newEquipmentForm);
            const data = Object.fromEntries(formData.entries());

            // Converti in maiuscolo i campi richiesti
            data.categoria = data.categoria.toUpperCase();
            data.tipo = data.tipo.toUpperCase();
            data.ubicazione = data.ubicazione.toUpperCase();
            data.userName = data.userName.toUpperCase();

            try {
                // Costruisci l'URL con i parametri
                const params = new URLSearchParams(data);
                const response = await fetch(`php/api.php?action=createEquipment&${params.toString()}`);
                const result = await response.json();

                if (result.success) {
                    // Mostra un messaggio di successo
                    alert(`Attrezzatura creata con successo!\nCodice assegnato: ${result.codice}`);
                    closeNewEquipmentModal();
                    // Aggiorna la vista
                    if (typeof loadData === 'function') {
                        loadData();
                    }
                } else {
                    throw new Error(result.message || 'Errore durante la creazione dell\'attrezzatura');
                }
            } catch (error) {
                alert(error.message);
            }
        });
    }
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

async function loadNotesHistory(codice) {
    try {
        console.log('[DEBUG] Chiamata API getNotesHistory per codice:', codice);
        
        const response = await fetch(`${API_BASE_URL}?action=getNotesHistory&codice=${encodeURIComponent(codice)}`, {
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
            throw new Error(data.message || 'Errore nel caricamento dello storico note');
        }

        // Visualizza lo storico delle note
        displayNotesHistory(data.data || []);
        
    } catch (error) {
        console.error('Errore nel caricamento dello storico note:', error);
        
        // Mostra messaggio di errore nel container dello storico note
        const notesHistoryContainer = document.getElementById('notesHistory');
        if (notesHistoryContainer) {
            notesHistoryContainer.innerHTML = '<p style="color: #ff4444;">Errore nel caricamento dello storico note: ' + error.message + '</p>';
        }
    }
}

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

function showEquipmentDetail(codice) {
    // Cerca l'attrezzatura nell'array delle attrezzature usando il codice
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
        }

        // Ricarica lo storico note e movimenti per vedere le modifiche
        if (typeof window.fixedLoadNotesHistory === 'function') {
            await window.fixedLoadNotesHistory(currentEquipmentId);
        }
        await loadMovementHistory(currentEquipmentId);

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
    const isNewLocation = document.getElementById('isNewLocationCheckbox')?.checked || false;
    const newLocationSelect = document.getElementById('newLocation');
    
    if (!newLocationSelect) return;
    
    if (isNewLocation) {
        // Converti il select in un input text
        const parent = newLocationSelect.parentNode;
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.id = 'newLocation';
        newInput.className = 'form-input new-location';
        newInput.placeholder = 'Inserisci nuova ubicazione (max 20 caratteri)';
        newInput.maxLength = '20';
        newInput.required = true;
        
        // Auto-uppercase per consistenza
        newInput.addEventListener('input', function(e) {
            this.value = this.value.toUpperCase();
        });
        
        parent.replaceChild(newInput, newLocationSelect);
        
        // Focus sul nuovo input
        setTimeout(() => newInput.focus(), 100);
    } else {
        // Ripristina il select con le ubicazioni esistenti
        const parent = newLocationSelect.parentNode;
        const newSelect = document.createElement('select');
        newSelect.id = 'newLocation';
        newSelect.className = 'form-select';
        newSelect.required = true;
        
        // Aggiungi opzione di default
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleziona ubicazione...';
        newSelect.appendChild(defaultOption);
        
        // Aggiungi ubicazioni esistenti (escludi quella corrente se presente)
        const currentLocation = document.getElementById('currentLocation')?.value;
        locationsData
            .filter(location => location !== currentLocation)
            .forEach(location => {
                const option = document.createElement('option');
                option.value = location;
                option.textContent = location;
                newSelect.appendChild(option);
            });
        
        parent.replaceChild(newSelect, newLocationSelect);
    }
}

function updateLocationSelect(equipment) {
    const select = document.getElementById('newLocation');
    if (!select) {
        console.error('Select ubicazione non trovato');
        return;
    }

    // Resetta il checkbox di nuova ubicazione
    const checkbox = document.getElementById('isNewLocationCheckbox');
    if (checkbox) checkbox.checked = false;

    // Se è un input (nuova ubicazione), riconvertilo in select
    if (select.tagName.toLowerCase() === 'input') {
        handleNewLocationCheckbox(); // Questo lo riconvertirà in select
        // Richiama la funzione per popolare il select
        setTimeout(() => updateLocationSelect(equipment), 100);
        return;
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

// ============================================================================
// GLOBAL FUNCTIONS (per onclick negli HTML generati dinamicamente)
// ============================================================================

// Queste funzioni devono essere globali per essere chiamate dagli onclick
window.showLocationEquipment = showLocationEquipment;
window.showCategoryEquipment = showCategoryEquipment;
window.showTypeEquipment = showTypeEquipment;
window.renderCurrentView = renderCurrentView;
window.closeDetailModal = closeDetailModal;

// ============================================================================
// ADDITIONAL UTILITY FUNCTIONS
// ============================================================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Funzione di debug per verificare lo stato dell'applicazione
function debugApp() {
    console.log('=== DEBUG APP STATE ===');
    console.log('Current View:', currentView);
    console.log('Current Filter:', currentFilter);
    console.log('Current Equipment ID:', currentEquipmentId);
    console.log('Attrezzature loaded:', attrezzature.length);
    console.log('Equipment Data:', equipmentData.length);
    console.log('Locations Data:', locationsData.length);
    console.log('API Base URL:', API_BASE_URL);
    console.log('========================');
}

// Esponi la funzione di debug globalmente per test
window.debugApp = debugApp;

// ============================================================================
// ERROR HANDLING E RECOVERY
// ============================================================================

// Gestione errori globale per promesse non catturate
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showError('Si è verificato un errore imprevisto. Prova a ricaricare la pagina.');
    event.preventDefault();
});

// Gestione errori JavaScript globali
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showError('Si è verificato un errore. Alcune funzionalità potrebbero non funzionare correttamente.');
});

// ============================================================================
// INITIALIZATION COMPLETE
// ============================================================================

console.log('Script SERES inizializzato correttamente');

// Espone alcune funzioni utili per debugging
window.SERES_DEBUG = {
    loadData,
    debugApp,
    currentState: () => ({
        currentView,
        currentFilter,
        currentEquipmentId,
        attrezzature: attrezzature.length,
        equipmentData: equipmentData.length,
        locationsData: locationsData.length
    })
};

// ============================================================================
// FUNZIONI NOTE CHE FUNZIONANO
// ============================================================================

// Funzione semplificata e sicura per visualizzare le note
window.simpleDisplayNotes = function(data) {
    console.log('=== SIMPLE DISPLAY NOTES ===');
    console.log('Data ricevuta:', data);
    
    const container = document.getElementById('notesHistory');
    if (!container) {
        console.error('Container non trovato!');
        return;
    }
    
    console.log('Container trovato:', container);
    
    if (!data || !data.length) {
        container.innerHTML = '<p style="color: #666; font-style: italic;">Nessuna nota disponibile</p>';
        return;
    }
    
    let html = '';
    data.forEach(note => {
        const noteText = note.nota || 'Nota vuota';
        const author = note.user_name || 'Utente sconosciuto';
        const date = new Date(note.timestamp).toLocaleString('it-IT');
        
        html += `
            <div style="background: white; border: 1px solid #e8e8e8; padding: 15px; margin-bottom: 12px; border-left: 4px solid #2196F3; border-radius: 6px;">
                <div style="font-weight: 500; color: #333; font-size: 1em; line-height: 1.5; margin-bottom: 8px;">${escapeHtml(noteText)}</div>
                <div style="font-size: 0.8em; color: #666; text-align: right; font-style: italic; border-top: 1px solid #f0f0f0; padding-top: 8px;">${escapeHtml(author)} - ${escapeHtml(date)}</div>
            </div>
        `;
    });
    
    // Stili del container
    container.style.maxHeight = '300px';
    container.style.overflowY = 'auto';
    container.style.border = '1px solid #e0e0e0';
    container.style.borderRadius = '8px';
    container.style.padding = '15px';
    container.style.background = '#fafafa';
    
    container.innerHTML = html;
    console.log('HTML inserito:', html.length, 'caratteri');
};

// Versione funzionante di loadNotesHistory
window.fixedLoadNotesHistory = async function(codice) {
    console.log('=== FIXED LOAD NOTES per codice:', codice, '===');
    try {
        const response = await fetch(`${API_BASE_URL}?action=getNotesHistory&codice=${encodeURIComponent(codice)}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dati API ricevuti:', data);
        
        if (data.success) {
            window.simpleDisplayNotes(data.data || []);
        } else {
            console.error('API error:', data.message);
            const container = document.getElementById('notesHistory');
            if (container) {
                container.innerHTML = `<p style="color: #ff4444;">Errore: ${data.message}</p>`;
            }
        }
    } catch (error) {
        console.error('Errore caricamento note:', error);
        const container = document.getElementById('notesHistory');
        if (container) {
            container.innerHTML = `<p style="color: #ff4444;">Errore di connessione: ${error.message}</p>`;
        }
    }
};