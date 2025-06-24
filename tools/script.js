// Costanti e variabili globali
const API_BASE_URL = '../php/api.php';
const USE_PHP_API = true;


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

// Funzione per validare il nome utente (minimo 4 caratteri)
function validateUserName(userName, fieldName = "Nome utente") {
    if (!userName || userName.trim().length === 0) {
        return { valid: false, message: `${fieldName} è obbligatorio` };
    }
    
    const cleanUserName = userName.trim();
    
    if (cleanUserName.length < 4) {
        return { valid: false, message: `${fieldName} deve contenere almeno 4 caratteri` };
    }
    
    if (cleanUserName.length > 50) {
        return { valid: false, message: `${fieldName} non può superare i 50 caratteri` };
    }
    
    // Verifica che contenga almeno una lettera (non solo numeri/simboli)
    if (!/[a-zA-Z]/.test(cleanUserName)) {
        return { valid: false, message: `${fieldName} deve contenere almeno una lettera` };
    }
    
    return { valid: true, formatted: cleanUserName.toUpperCase() };
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// DEBUG FUNCTIONS - AGGIUNTE PER RISOLUZIONE PROBLEMI
function debugModalStatus() {
    const modal = document.getElementById('detailModal');
    console.log('[DEBUG MODAL]', {
        exists: !!modal,
        display: modal?.style.display,
        className: modal?.className,
        classList: modal?.classList.toString(),
        visible: modal?.offsetHeight > 0,
        computedStyle: modal ? window.getComputedStyle(modal).display : 'N/A'
    });
}

function testModalOpen() {
    console.log('[DEBUG] Test apertura modal...');
    
    if (attrezzature.length > 0) {
        showEquipmentDetail(attrezzature[0].codice);
    } else {
        console.log('[DEBUG] Nessuna attrezzatura disponibile per test');
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('App SERES caricata correttamente');
    
    // Inizializza tutti gli event listeners
    initializeEventListeners();
    
    // Applica il feedback visivo per la validazione
    addRealTimeFeedback();
    
    // Avvia automaticamente il caricamento dei dati dal database
    loadData();
    
    // Esponi funzioni debug globalmente
    window.debugModal = debugModalStatus;
    window.testModal = testModalOpen;

    // Event listener per il pulsante Gestione Materiali
    const btnGestioneMateriali = document.getElementById('btnGestioneMateriali');
    btnGestioneMateriali.addEventListener('click', () => {
        window.location.href = '../materiali/index.html';
    });
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

    // Modal functionality - FIX PRINCIPALE
    const closeDetailModalBtn = document.getElementById('closeDetailModal');
    if (closeDetailModalBtn) {
        closeDetailModalBtn.addEventListener('click', closeDetailModal);
        console.log('[DEBUG] Event listener per chiusura modal aggiunto');
    } else {
        console.error('[DEBUG] Bottone closeDetailModal non trovato!');
    }

    // Refresh button
    const btnRefresh = document.getElementById('btnRefresh');
    if (btnRefresh) btnRefresh.addEventListener('click', loadData);
    
    // Forms event listeners con validazione
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
    const userNameFields = ['userName', 'noteUserName', 'userNameForm'];
    userNameFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function(e) {
                this.value = this.value.toUpperCase();
            });
        }
    });
    
    // Bottom navigation
    const navUbicazione = document.getElementById('navUbicazione');
    const navCategoria = document.getElementById('navCategoria');
    const navTipo = document.getElementById('navTipo');
    
    if (navUbicazione) navUbicazione.addEventListener('click', () => switchView('ubicazione'));
    if (navCategoria) navCategoria.addEventListener('click', () => switchView('categoria'));
    if (navTipo) navTipo.addEventListener('click', () => switchView('tipo'));

    // Modal close on outside click - FIX PRINCIPALE
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('detailModal');
        if (event.target === modal) {
            console.log('[DEBUG] Click esterno al modal, chiusura...');
            closeDetailModal();
        }
    });
    
    // About Modal
    initializeAboutModal();

    // Gestione Modal Nuova Attrezzatura
    initializeNewEquipmentForm();
    
    // Gestione menu principale
    const btnMainMenu = document.getElementById('btnMainMenu');
    if (btnMainMenu) {
        btnMainMenu.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }

    // Debug elementi modal
    debugModalElements();
    
    console.log('✅ Validazione nome utente e fix mobile applicati');
}

// Debug per verificare che gli elementi esistano
function debugModalElements() {
    const elements = {
        modal: document.getElementById('detailModal'),
        closeBtn: document.getElementById('closeDetailModal'),
        notesHistory: document.getElementById('notesHistory')
    };
    
    console.log('[DEBUG] Elementi modal:', elements);
    
    Object.entries(elements).forEach(([name, element]) => {
        if (!element) {
            console.error(`[DEBUG] Elemento ${name} non trovato!`);
        } else {
            console.log(`[DEBUG] Elemento ${name} trovato:`, element);
        }
    });
}

// Visual feedback in tempo reale per i campi nome utente
function addRealTimeFeedback() {
    const userNameFields = ['userName', 'noteUserName', 'userNameForm'];
    
    userNameFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', function() {
                const validation = validateUserName(this.value, 'Nome');
                
                // Rimuovi classi esistenti
                this.classList.remove('valid', 'invalid');
                
                if (this.value.length > 0) {
                    if (validation.valid) {
                        this.classList.add('valid');
                        this.style.borderColor = '#4CAF50';
                    } else {
                        this.classList.add('invalid');
                        this.style.borderColor = '#f44336';
                    }
                } else {
                    this.style.borderColor = '#e0e0e0';
                }
            });
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
// NEW EQUIPMENT FORM MANAGEMENT
// ============================================================================

function initializeNewEquipmentForm() {
    // Setup Modal Nuova Attrezzatura
    const newEquipmentModal = document.getElementById('newEquipmentModal');
    const btnAddEquipment = document.getElementById('btnAddEquipment');
    const newEquipmentClose = document.getElementById('newEquipmentClose');
    const newEquipmentCancel = document.getElementById('newEquipmentCancel');
    const newEquipmentForm = document.getElementById('newEquipmentForm');
    
    // Gestione submit del form
    if (newEquipmentForm) {
        newEquipmentForm.addEventListener('submit', handleNewEquipmentSubmit);
        console.log('[DEBUG] Event listener per submit del form nuova attrezzatura aggiunto');
    }
    
    const isNewCategoryCheckbox = document.getElementById('isNewCategoryCheckbox');
    const isNewTypeCheckbox = document.getElementById('isNewTypeCheckbox');
    const isNewLocationCheckboxForm = document.getElementById('isNewLocationCheckboxForm');
    const tipoSelect = document.getElementById('tipo');
    const categoriaSelect = document.getElementById('categoria');

    // Gestione click sul tipo senza categoria selezionata
    if (tipoSelect) {
        tipoSelect.addEventListener('click', () => {
            if (!categoriaSelect.value && !isNewCategoryCheckbox.checked) {
                showError('⚠️ Seleziona prima una categoria');
                categoriaSelect.focus();
            }
        });
    }

    // Gestione checkbox categoria
    if (isNewCategoryCheckbox) {
        isNewCategoryCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Se si seleziona nuova categoria, forza nuovo tipo
                isNewTypeCheckbox.checked = true;
                updateTypeSelect();
            }
            updateCategorySelect();
        });
    }
    
    // Gestione checkbox tipo
    if (isNewTypeCheckbox) {
        isNewTypeCheckbox.addEventListener('change', updateTypeSelect);
    }
    
    // Gestione checkbox ubicazione
    if (isNewLocationCheckboxForm) {
        isNewLocationCheckboxForm.addEventListener('change', updateLocationSelectNewEquipment);
    }

    // Gestione cambio categoria
    if (categoriaSelect) {
        categoriaSelect.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            if (selectedCategory && !isNewCategoryCheckbox.checked) {
                updateTypesByCategory(selectedCategory);
                // Reset tipo quando si cambia categoria
                tipoSelect.value = '';
            }
        });
    }

    // Apri il modal
    if (btnAddEquipment) {
        btnAddEquipment.addEventListener('click', () => {
            console.log('[DEBUG] Apertura modal nuova attrezzatura');
            newEquipmentModal.classList.add('show-modal');
            newEquipmentModal.style.display = 'flex';
            document.body.classList.add('modal-open');
            updateCategorySelect();
            updateTypeSelect();
            updateLocationSelectNewEquipment();
        });
    }

    // Chiudi il modal
    if (newEquipmentClose) {
        newEquipmentClose.addEventListener('click', closeNewEquipmentModal);
    }
    
    if (newEquipmentCancel) {
        newEquipmentCancel.addEventListener('click', closeNewEquipmentModal);
    }
}

async function handleNewEquipmentSubmit(e) {
    e.preventDefault();

    // Validazione nome utente
    const userNameRaw = document.getElementById('userNameForm').value;
    const userNameValidation = validateUserName(userNameRaw);
    
    if (!userNameValidation.valid) {
        showError('⚠️ ' + userNameValidation.message);
        document.getElementById('userNameForm').focus();
        return;
    }
    
    const userName = userNameValidation.formatted;

    // Resto della validazione...
    const isNewCategory = document.getElementById('isNewCategoryCheckbox').checked;
    const categoria = isNewCategory 
        ? document.getElementById('newCategoryInput').value.trim()
        : document.getElementById('categoria').value.trim();
    
    if (!categoria) {
        showError('⚠️ La categoria è obbligatoria');
        return;
    }

    const isNewType = document.getElementById('isNewTypeCheckbox').checked;
    const tipo = isNewType 
        ? document.getElementById('newTypeInput').value.trim()
        : document.getElementById('tipo').value.trim();
    
    if (!tipo) {
        showError('⚠️ Il tipo è obbligatorio');
        return;
    }

    const isNewLocation = document.getElementById('isNewLocationCheckboxForm').checked;
    const ubicazione = isNewLocation 
        ? document.getElementById('newLocationInputForm').value.trim()
        : document.getElementById('ubicazione').value.trim();
    
    if (!ubicazione) {
        showError('⚠️ L\'ubicazione è obbligatoria');
        return;
    }

    const marca = document.getElementById('marca').value.trim();
    if (!marca) {
        showError('⚠️ La marca/modello è obbligatoria');
        return;
    }

    const formData = new FormData();
    formData.append('categoria', categoria.toUpperCase());
    formData.append('tipo', tipo.toUpperCase());
    formData.append('marca', marca);
    formData.append('ubicazione', ubicazione.toUpperCase());
    formData.append('userName', userName);    try {
        showLoadingOverlay('Creazione attrezzatura in corso...');
        
        console.log('[DEBUG] Dati form:', {
            categoria: categoria.toUpperCase(),
            tipo: tipo.toUpperCase(),
            marca: marca,
            ubicazione: ubicazione.toUpperCase(),
            userName: userName
        });

        const params = {
            action: 'createEquipment',
            categoria: categoria.toUpperCase(),
            tipo: tipo.toUpperCase(),
            marca: marca,
            ubicazione: ubicazione.toUpperCase(),
            userName: userName
        };

        const queryString = new URLSearchParams(params).toString();
        console.log('[DEBUG] URL API:', `${API_BASE_URL}?${queryString}`);
        
        const response = await fetch(`${API_BASE_URL}?${queryString}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Errore nella richiesta: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[DEBUG] Risposta API:', result);

        if (result.success) {
            showError(`✅ Attrezzatura creata con successo!\nCodice assegnato: ${result.codice}`);
            closeNewEquipmentModal();
            await loadData(); // Ricarica i dati dopo la creazione
        } else {
            throw new Error(result.message || 'Errore durante la creazione dell\'attrezzatura');
        }
    } catch (error) {
        console.error('[ERROR] Creazione attrezzatura:', error);
        showError('❌ ' + error.message);
    } finally {
        hideLoadingOverlay();
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
    const categoriaSelect = document.getElementById('categoria');

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

        // Aggiorna i tipi in base alla categoria selezionata
        const selectedCategory = categoriaSelect.value;
        if (selectedCategory) {
            updateTypesByCategory(selectedCategory);
        } else {
            // Se nessuna categoria è selezionata, mostra tutti i tipi
            populateSelect('tipo', [...new Set(attrezzature.map(item => item.tipo))].sort());
        }
    }
}

// Funzione per aggiornare la select delle ubicazioni nel form nuova attrezzatura
function updateLocationSelectNewEquipment() {
    const isNewLocation = document.getElementById('isNewLocationCheckboxForm').checked;
    const newLocationInput = document.getElementById('newLocationInputForm');
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

function closeNewEquipmentModal() {
    const newEquipmentModal = document.getElementById('newEquipmentModal');
    const newEquipmentForm = document.getElementById('newEquipmentForm');
    
    console.log('[DEBUG] Chiusura modal nuova attrezzatura');
    newEquipmentModal.classList.remove('show-modal');
    newEquipmentModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    newEquipmentForm.reset();

    // Reset dei campi categoria
    document.getElementById('newCategoryInput').style.display = 'none';
    document.getElementById('existingCategoryDiv').style.display = 'block';
    document.getElementById('isNewCategoryCheckbox').checked = false;

    // Reset dei campi tipo
    document.getElementById('newTypeInput').style.display = 'none';
    document.getElementById('existingTypeDiv').style.display = 'block';
    document.getElementById('isNewTypeCheckbox').checked = false;

    // Reset dei campi ubicazione
    document.getElementById('newLocationInputForm').style.display = 'none';
    document.getElementById('existingLocationDiv').style.display = 'block';
    document.getElementById('isNewLocationCheckboxForm').checked = false;
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
            ubicazione: item.nome_ubicazione,
            note: item.note,
            doc: item.doc
        }));
          // Carica le ubicazioni dal database
        const locationsResponse = await fetch(`${API_BASE_URL}?action=getLocations`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!locationsResponse.ok) {
            throw new Error(`Errore nel caricamento delle ubicazioni: ${locationsResponse.status} ${locationsResponse.statusText}`);
        }

        const locationsResult = await locationsResponse.json();
        locationsData = locationsResult.data.map(loc => loc.nome_ubicazione).sort();

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
        console.log('[DEBUG] Chiamata API loadNotesHistory per codice:', codice);
        
        const response = await fetch(`${API_BASE_URL}?action=getNotesHistory&codice=${encodeURIComponent(codice)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('[DEBUG] Response status:', response.status);

        if (!response.ok) {
            throw new Error(`Errore nella richiesta: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('[DEBUG] Dati note ricevuti:', data);
        
        if (!data.success) {
            throw new Error(data.message || 'Errore nel caricamento dello storico note');
        }

        // Aggiorna lo storico delle note
        notesLog = data.data || [];
        console.log('[DEBUG] Note caricate:', notesLog);
        
        // Visualizza lo storico
        displayNotesHistory(notesLog);
        
        return true;
    } catch (error) {
        console.error('[DEBUG] Errore nel caricamento storico note:', error);
        
        // Mostra messaggio di errore nel container
        const notesHistoryContainer = document.getElementById('notesHistory');
        if (notesHistoryContainer) {
            notesHistoryContainer.innerHTML = `<p style="color: #ff4444;">Errore nel caricamento delle note: ${error.message}</p>`;
        }
        
        return false;
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
    console.log('[DEBUG] Attaching equipment card listeners');
    
    document.querySelectorAll('.equipment-card').forEach((card, index) => {
        const codice = card.dataset.codice;
        console.log(`[DEBUG] Card ${index}: codice=${codice}`);
        
        if (!codice) {
            console.warn(`[DEBUG] Card ${index} non ha attributo data-codice`);
            return;
        }
        
        card.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[DEBUG] Click su card con codice:', codice);
            showEquipmentDetail(codice);
        });
    });
}

// FUNZIONE PRINCIPALE CORRETTA - showEquipmentDetail
function showEquipmentDetail(codice) {
    console.log('[DEBUG] Apertura dettaglio per codice:', codice);
    
    // Cerca l'attrezzatura nell'array delle attrezzature usando il codice
    const equipment = attrezzature.find(item => item.codice === codice);
    if (!equipment) {
        console.error('[DEBUG] Attrezzatura non trovata per codice:', codice);
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
    
    // Debug elementi
    console.log('[DEBUG] Elementi DOM trovati:', {
        codice: !!elements.codice,
        categoria: !!elements.categoria,
        tipo: !!elements.tipo,
        marca: !!elements.marca,
        ubicazione: !!elements.ubicazione,
        modal: !!elements.modal
    });
    
    // Controlla che tutti gli elementi essenziali esistano
    const requiredElements = ['codice', 'categoria', 'tipo', 'marca', 'ubicazione', 'modal'];
    const missingElements = requiredElements.filter(key => !elements[key]);
    
    if (missingElements.length > 0) {
        console.error('[DEBUG] Missing DOM elements:', missingElements);
        showError(`Errore: elementi mancanti nel DOM: ${missingElements.join(', ')}`);
        return;
    }

    // Popola i dettagli nel modal    elements.codice.textContent = equipment.codice;
    elements.categoria.textContent = equipment.categoria;
    elements.tipo.textContent = equipment.tipo;
    elements.marca.textContent = equipment.marca;
    elements.ubicazione.textContent = equipment.nome_ubicazione;
    
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
    
    // CORREZIONE PRINCIPALE: Usa le classi CSS invece di solo style.display
    console.log('[DEBUG] Apertura modal...');
    elements.modal.classList.add('show-modal');
    elements.modal.style.display = 'flex';
    elements.modal.style.opacity = '1';
    elements.modal.style.visibility = 'visible';
    document.body.classList.add('modal-open');
    
    // Debug stato modal dopo l'apertura
    console.log('[DEBUG] Modal aperto:', {
        display: elements.modal.style.display,
        classes: elements.modal.className,
        visible: elements.modal.offsetHeight > 0
    });
    
    // Carica lo storico movimenti e note con un piccolo delay per assicurarsi che il modal sia renderizzato
    setTimeout(() => {
        loadMovementHistory(equipment.codice);
        loadNotesHistory(equipment.codice);
    }, 100);
}

// FUNZIONE CORRETTA - closeDetailModal
function closeDetailModal() {
    console.log('[DEBUG] Chiusura modal dettaglio');
    
    const modal = document.getElementById('detailModal');
    if (modal) {
        // CORREZIONE: Rimuovi classe e imposta display
        modal.classList.remove('show-modal');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
        document.body.classList.remove('modal-open');
    }
    
    // Reset della variabile globale
    currentEquipmentId = null;
    
    // Reset dei campi del form se esistono
    const formElements = {
        newLocation: document.getElementById('newLocation'),
        newLocationInput: document.getElementById('newLocationInput'),
        detailNote: document.getElementById('detailNote'),
        userName: document.getElementById('userName'),
        noteUserName: document.getElementById('noteUserName')
    };
    
    // Reset solo degli elementi che esistono
    Object.values(formElements).forEach(element => {
        if (element) {
            element.value = '';
            // Reset anche delle classi di validazione
            element.classList.remove('valid', 'invalid');
            element.style.borderColor = '#e0e0e0';
        }
    });

    // Reset del checkbox e ripristina visualizzazione
    const checkbox = document.getElementById('isNewLocationCheckbox');
    if (checkbox) {
        checkbox.checked = false;
        handleNewLocationCheckbox(); // Ripristina la visualizzazione corretta
    }
}

// ============================================================================
// HISTORY DISPLAY FUNCTIONS - FIXED
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
    if (!notesHistoryContainer) {
        console.error('Container notesHistory non trovato!');
        return;
    }

    console.log('[DEBUG] Visualizzazione storico note:', history);

    if (!history || history.length === 0) {
        notesHistoryContainer.innerHTML = '<p style="color: #666; font-style: italic;">Nessuno storico note disponibile</p>';
        return;
    }

    // Ordina le note per data (più recenti prima)
    const sortedHistory = history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const rows = sortedHistory.map(entry => {
        const date = new Date(entry.timestamp).toLocaleString('it-IT');
        
        // Cerca il contenuto della nota in diversi campi possibili
        const noteContent = entry.nota_nuova || entry.note || entry.nota || entry.contenuto || '';
        
        return `
            <div class="note-entry">
                <div class="note-content">
                    <div class="note-text">${escapeHtml(noteContent)}</div>
                </div>
                <div class="note-metadata">
                    <span class="note-author">📝 ${escapeHtml(entry.user_name || 'Utente sconosciuto')}</span>
                    <span class="note-date">${escapeHtml(date)}</span>
                </div>
            </div>
        `;
    });

    notesHistoryContainer.innerHTML = rows.join('');
}

// ============================================================================
// FORM HANDLING FUNCTIONS - FIXED CON VALIDAZIONE
// ============================================================================

// Funzione FIXED per gestire il checkbox nuova ubicazione nel modal di dettaglio
function handleNewLocationCheckbox() {
    const isNewLocation = document.getElementById('isNewLocationCheckbox').checked;
    const locationSelect = document.getElementById('newLocation');
    const locationInput = document.getElementById('newLocationInput');
    
    console.log('[DEBUG] Checkbox clicked, isNewLocation:', isNewLocation);
    
    if (isNewLocation) {
        // Mostra input, nascondi select
        locationSelect.style.display = 'none';
        locationSelect.required = false;
        locationInput.style.display = 'block';
        locationInput.required = true;
        locationInput.focus();
    } else {
        // Mostra select, nascondi input
        locationSelect.style.display = 'block';
        locationSelect.required = true;
        locationInput.style.display = 'none';
        locationInput.required = false;
        locationInput.value = ''; // Reset dell'input
    }
}

async function moveEquipment() {
    // Verifica che currentEquipmentId sia definito
    if (!currentEquipmentId) {
        showError('⚠️ Errore: nessuna attrezzatura selezionata');
        return;
    }

    const isNewLocation = document.getElementById('isNewLocationCheckbox')?.checked || false;
    let newLocation;
    
    if (isNewLocation) {
        newLocation = document.getElementById('newLocationInput')?.value?.trim();
    } else {
        newLocation = document.getElementById('newLocation')?.value?.trim();
    }
    
    const userNameRaw = document.getElementById('userName')?.value;
    
    // Validazione nome utente
    const userNameValidation = validateUserName(userNameRaw);
    if (!userNameValidation.valid) {
        showError('⚠️ ' + userNameValidation.message);
        const userNameField = document.getElementById('userName');
        if (userNameField) userNameField.focus();
        return;
    }
    
    const userName = userNameValidation.formatted;

    if (!newLocation) {
        showError('⚠️ ' + (isNewLocation ? 'Inserisci una nuova ubicazione' : 'Seleziona una ubicazione'));
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
            newLocationInput: document.getElementById('newLocationInput'),
            userName: document.getElementById('userName'),
            checkbox: document.getElementById('isNewLocationCheckbox')
        };
        
        if (formElements.newLocation) formElements.newLocation.value = '';
        if (formElements.newLocationInput) formElements.newLocationInput.value = '';
        if (formElements.userName) {
            formElements.userName.value = '';
            formElements.userName.classList.remove('valid', 'invalid');
            formElements.userName.style.borderColor = '#e0e0e0';
        }
        if (formElements.checkbox) {
            formElements.checkbox.checked = false;
            handleNewLocationCheckbox(); // Ripristina la visualizzazione corretta
        }

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
    const userNameRaw = document.getElementById('noteUserName')?.value;
    
    // Validazione nome utente
    const userNameValidation = validateUserName(userNameRaw);
    if (!userNameValidation.valid) {
        showError('⚠️ ' + userNameValidation.message);
        const userNameField = document.getElementById('noteUserName');
        if (userNameField) userNameField.focus();
        return;
    }
    
    const userName = userNameValidation.formatted;
    
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
        try {
            await Promise.all([
                loadNotesHistory(currentEquipmentId),
                loadMovementHistory(currentEquipmentId)
            ]);
        } catch (error) {
            console.error('[DEBUG] Errore nel caricamento degli storici:', error);
        }

        // Reset del form note
        const detailNoteField = document.getElementById('detailNote');
        const noteUserNameField = document.getElementById('noteUserName');
        if (detailNoteField) detailNoteField.value = '';
        if (noteUserNameField) {
            noteUserNameField.value = '';
            noteUserNameField.classList.remove('valid', 'invalid');
            noteUserNameField.style.borderColor = '#e0e0e0';
        }

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

// Funzione per aggiornare il select delle ubicazioni nel modal di dettaglio
function updateLocationSelect(equipment) {
    const select = document.getElementById('newLocation');
    if (!select) return;

    // Resetta il checkbox di nuova ubicazione
    const checkbox = document.getElementById('isNewLocationCheckbox');
    if (checkbox) {
        checkbox.checked = false;
        handleNewLocationCheckbox(); // Assicura la visualizzazione corretta
    }

    // Pulisci il select
    select.innerHTML = '<option value="">Seleziona ubicazione...</option>';
    
    // Usa locationsData se disponibile, altrimenti usa le ubicazioni da attrezzature
    const availableLocations = locationsData.length > 0 ? 
        locationsData : 
        Array.from(new Set(attrezzature.map(item => item.ubicazione))).filter(Boolean);

    // Ordina le ubicazioni alfabeticamente
    availableLocations.sort((a, b) => a.localeCompare(b));    // Aggiungi tutte le ubicazioni tranne quella corrente
    const currentLocation = equipment?.ubicazione?.trim().toUpperCase() || '';
    availableLocations
        .filter(loc => {
            const locationName = (loc || '').trim().toUpperCase();
            return locationName !== currentLocation;
        })
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

// Funzione per ottenere tutti i tipi di una specifica categoria
function getTypesForCategory(category) {
    return attrezzature
        .filter(item => item.categoria === category)
        .map(item => item.tipo)
        .filter((value, index, self) => value && self.indexOf(value) === index)
        .sort();
}

// Funzione per aggiornare i tipi in base alla categoria selezionata
function updateTypesByCategory(category) {
    const tipoSelect = document.getElementById('tipo');
    const isNewTypeCheckbox = document.getElementById('isNewTypeCheckbox');
    const newTypeInput = document.getElementById('newTypeInput');
    const existingTypeDiv = document.getElementById('existingTypeDiv');

    // Se è selezionato "nuovo tipo", non aggiorniamo la select
    if (isNewTypeCheckbox.checked) {
        return;
    }

    // Nascondi il campo input e mostra la select
    newTypeInput.style.display = 'none';
    existingTypeDiv.style.display = 'block';

    // Svuota la select
    tipoSelect.innerHTML = '<option value="">Seleziona tipo...</option>';

    if (category) {
        // Ottieni i tipi per la categoria selezionata
        const tipi = getTypesForCategory(category);
        
        // Aggiungi le opzioni alla select
        tipi.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            tipoSelect.appendChild(option);
        });
    }
}