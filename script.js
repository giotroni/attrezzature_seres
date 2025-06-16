// Costanti e variabili globali
const SHEET_ID = '1efHWyYHqsZpAbPXuUadz7Mg2ScsZ1iXX15Yv8daVhvg';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxwxGZQtlPsy7S2bzDkzs4GYvbzVqXu7BKP-RLvMnRDbEnH-nvkwvm4wQmn8HP9mRp8sQ/exec';

let currentView = 'ubicazione'; // Inizializzazione della vista predefinita
let currentFilter = ''; // Inizializzazione del filtro di ricerca
let attrezzature = []; // Array per memorizzare i dati delle attrezzature
let filteredData = []; // Array per i dati filtrati dalla ricerca

// Funzioni di utilità per mostrare/nascondere l'overlay di caricamento
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

function showMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'success-message';
    messageElement.textContent = message;
    messageElement.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px; border-radius: 5px; z-index: 9999; box-shadow: 0 2px 5px rgba(0,0,0,0.2);';
    document.body.appendChild(messageElement);
    setTimeout(() => messageElement.remove(), 5000);
}

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 15px; border-radius: 5px; z-index: 9999;';
    document.body.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 5000);
}

// Funzioni di inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    console.log('App SERES caricata correttamente');
    
    // Aggiungi event listener per il checkbox nuova ubicazione
    document.getElementById('isNewLocationCheckbox')?.addEventListener('change', handleNewLocationCheckbox);
    
    // Avvia automaticamente il caricamento da Google Sheets
    loadFromGoogleSheets();
    
    // Event listeners
    document.getElementById('menuToggle').addEventListener('click', toggleMenu);
    document.getElementById('menuClose').addEventListener('click', closeMenu);
    document.getElementById('menuOverlay').addEventListener('click', closeMenu);
    document.getElementById('searchToggle').addEventListener('click', toggleSearch);
    document.getElementById('searchClose').addEventListener('click', closeSearch);
    document.getElementById('searchOverlay').addEventListener('click', function(e) {
        if (e.target === this) closeSearch();
    });
    document.getElementById('searchInput').addEventListener('input', filterContent);
    document.getElementById('searchInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            closeSearch();
        }
    });
    document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);
    document.getElementById('moveEquipmentBtn').addEventListener('click', moveEquipment);
    document.getElementById('btnRefresh').addEventListener('click', loadFromGoogleSheets);
    
    // Navigation eventi
    document.getElementById('navUbicazione').addEventListener('click', function() { switchView('ubicazione'); });
    document.getElementById('navCategoria').addEventListener('click', function() { switchView('categoria'); });
    document.getElementById('navTipo').addEventListener('click', function() { switchView('tipo'); });

    // Chiudi modal cliccando fuori
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('detailModal');
        if (event.target === modal) {
            closeDetailModal();
        }
    });

    // About Modal
    const btnAbout = document.getElementById('btnAbout');
    const aboutModal = document.getElementById('aboutModal');
    const aboutClose = document.getElementById('aboutClose');
    const menuOverlay = document.getElementById('menuOverlay');

    btnAbout.addEventListener('click', function() {
        aboutModal.style.display = 'block';
        menuOverlay.style.display = 'block';
        slideMenu.classList.remove('open');
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

    // Inizializza il modal per la nuova attrezzatura
    setupNewEquipmentModal();
});

async function loadData() {
    try {
        showLoadingOverlay('Caricamento dati in corso...');
        const response = await fetch(WEBAPP_URL + '?action=getData');
        if (!response.ok) {
            throw new Error('Errore nel caricamento dei dati');
        }
        const data = await response.json();
        if (!data || !data.success) {
            throw new Error(data.error || 'Errore nel formato dei dati');
        }
        attrezzature = data.data || [];
        filteredData = [...attrezzature];
        renderCurrentView();
    } catch (error) {
        console.error('Errore nel caricamento:', error);
        showError('Errore nel caricamento dei dati. Carico i dati demo come fallback...');
        // Carica i dati demo come fallback
        loadDemoData();
    } finally {
        hideLoadingOverlay();
    }
}

function loadDemoData() {
    // Dati demo di esempio
    attrezzature = [
        {
            id: 'DEMO1',
            nome: 'Attrezzatura Demo 1',
            categoria: 'Test',
            tipo: 'Demo',
            ubicazione: 'Magazzino',
            stato: 'Disponibile',
            note: 'Attrezzatura di test',
            movimenti: []
        },
        // Aggiungi altri dati demo se necessario
    ];
    filteredData = [...attrezzature];
    renderCurrentView();
}

async function loadFromGoogleSheets() {
    try {
        showLoadingOverlay('Caricamento dati...');
        console.log('Inizio caricamento dati da Google Sheets...');
        
        const response = await fetch(WEBAPP_URL + '?action=getData', {
            method: 'GET',
            mode: 'no-cors' // Aggiunto per gestire CORS
        });

        // Poiché stiamo usando no-cors, dovremo caricare i dati in un altro modo
        // Facciamo una richiesta JSONP utilizzando uno script tag
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const callbackName = 'googleSheetsCallback_' + Math.random().toString(36).substr(2, 9);
            
            window[callbackName] = function(data) {
                console.log('Dati ricevuti:', data);
                if (data && Array.isArray(data.data)) {
                    attrezzature = data.data;
                    updateSelectOptions();
                    filteredData = attrezzature;
                    renderContent();
                    hideLoadingOverlay();
                    showMessage('Dati aggiornati con successo');
                } else {
                    console.error('Formato dati non valido:', data);
                    hideLoadingOverlay();
                    showError('Errore nel formato dei dati ricevuti');
                }
                
                // Pulizia
                delete window[callbackName];
                document.body.removeChild(script);
                resolve();
            };

            script.onerror = function() {
                console.error('Errore nel caricamento dello script');
                hideLoadingOverlay();
                showError('Errore nel caricamento dei dati');
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Script loading failed'));
            };

            script.src = `${WEBAPP_URL}?action=getData&callback=${callbackName}`;
            document.body.appendChild(script);
        });
    } catch (error) {
        console.error('Errore nel caricamento:', error);
        hideLoadingOverlay();
        showError('Errore: ' + error.message);
    }
}

// Dati iniziali per le liste
const defaultData = {
    categorie: ['SICUREZZA', 'UTENSILI', 'MISURA'],
    tipi: ['IMBRAGATURA', 'CHIAVE', 'METRO'],
    ubicazioni: ['MAGAZZINO', 'OFFICINA', 'CASA']
};

// Inizializza le liste con dati di default
function initializeLists() {
    console.log('Inizializzazione liste...');
    
    // Usa i dati di default come fallback
    if (!categorie.size) {
        categorie = new Set(defaultData.categoria);
    }
    if (!tipi.size) {
        tipi = new Set(defaultData.tipi);
    }
    if (!ubicazioni.size) {
        ubicazioni = new Set(defaultData.ubicazioni);
    }

    updateSelectOptions();
}

function updateSelectOptions() {
    console.log('Aggiornamento opzioni select...');
    
    const updateSelect = (selectId, options, defaultValue = '') => {
        const select = document.getElementById(selectId);
        if (!select) {
            console.error(`Select ${selectId} non trovato`);
            return;
        }
        
        // Salva il valore corrente
        const currentValue = select.value;
        
        // Pulisci e aggiungi le opzioni
        select.innerHTML = `<option value="">${defaultValue || 'Seleziona...'}</option>`;
        Array.from(options).sort().forEach(value => {
            const option = new Option(value, value);
            select.add(option);
        });
        
        // Ripristina il valore selezionato se esisteva
        if (currentValue && Array.from(options).includes(currentValue)) {
            select.value = currentValue;
        }

        console.log(`Aggiornato select ${selectId} con ${Array.from(options).length} opzioni`);
    };

    // Aggiorna i select con messaggi appropriati
    updateSelect('categoria', categorie, 'Seleziona categoria...');
    updateSelect('tipo', tipi, 'Seleziona tipo...');
    updateSelect('ubicazione', ubicazioni, 'Seleziona ubicazione...');
}

// Aggiungi l'inizializzazione delle liste al caricamento della pagina
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    initializeLists(); // Inizializza le liste subito
    setupNewEquipmentModal();
});

function setupNewEquipmentModal() {
    const modal = document.getElementById('newEquipmentModal');
    const closeBtn = document.getElementById('newEquipmentClose');
    const cancelBtn = document.getElementById('newEquipmentCancel');
    const form = document.getElementById('newEquipmentForm');
    const addButtons = document.querySelectorAll('.add-option');

    // Event listener per il pulsante "Nuova Attrezzatura" nel menu
    document.getElementById('btnAddEquipment').addEventListener('click', () => {
        console.log('Apertura modal nuova attrezzatura');
        initializeLists(); // Inizializza le liste prima di aprire il modal
        modal.style.display = 'block';
        closeMenu();
    });

    // Chiusura del modal
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    cancelBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Gestione pulsanti "+" per aggiungere nuove opzioni
    addButtons.forEach(button => {
        button.addEventListener('click', function() {
            const target = this.dataset.target;
            const newValue = prompt(`Inserisci nuova ${target}:`);
            
            if (newValue && newValue.trim()) {
                const value = newValue.trim().toUpperCase(); // Converti in maiuscolo
                const select = document.getElementById(target);
                
                // Aggiungi al set appropriato
                switch(target) {
                    case 'categoria':
                        categorie.add(value);
                        break;
                    case 'tipo':
                        tipi.add(value);
                        break;
                    case 'ubicazione':
                        ubicazioni.add(value);
                        break;
                }
                
                // Aggiorna le opzioni del select
                updateSelectOptions();
                
                // Seleziona il nuovo valore
                select.value = value;
            }
        });
    });

    // Gestione submit del form
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            categoria: document.getElementById('categoria').value,
            tipo: document.getElementById('tipo').value,
            marca: document.getElementById('marca').value,
            ubicazione: document.getElementById('ubicazione').value,
            note: document.getElementById('note').value
        };

        if (!formData.categoria || !formData.tipo || !formData.marca || !formData.ubicazione) {
            showError('Compila tutti i campi obbligatori');
            return;
        }

        try {
            const response = await fetch(WEBAPP_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'addEquipment',
                    data: formData
                })
            });

            showMessage('Richiesta inviata. Verifica nel foglio di Google Sheets.');
            modal.style.display = 'none';
            form.reset();
            
            // Ricarica i dati dopo qualche secondo
            setTimeout(() => {
                loadFromGoogleSheets();
            }, 2000);
            
        } catch (error) {
            showError('Errore: ' + error.message);
            console.error('Errore invio dati:', error);
        }
    });
}