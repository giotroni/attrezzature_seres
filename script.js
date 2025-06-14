// Costanti e variabili globali
const SHEET_ID = '1efHWyYHqsZpAbPXuUadz7Mg2ScsZ1iXX15Yv8daVhvg';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzB5w7uWISpZ31i3JCTf1sGnfG7-4mGVSvPYr9slfbuK_9t5LNZ5tHX7shucPZiJ1xspw/exec';

// Debug flag
const DEBUG = true;

function debugLog(message, data = null) {
    if (DEBUG) {
        if (data) {
            console.log(`[DEBUG] ${message}:`, data);
        } else {
            console.log(`[DEBUG] ${message}`);
        }
    }
}

// Variabili globali
let currentView = 'ubicazione';
let currentFilter = '';
let attrezzature = [];
let filteredData = [];
let locationsData = [];
let currentEquipment = null;

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

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ff4444; color: white; padding: 15px; border-radius: 5px; z-index: 9999;';
    document.body.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 5000);
}

// Funzioni di inizializzazione
document.addEventListener('DOMContentLoaded', async function() {
    debugLog('Inizializzazione applicazione');
      try {
        showLoadingOverlay('Inizializzazione app...');
        debugLog('Impostazione ubicazioni di default...');
        // Usa le ubicazioni di default invece di caricarle
        locationsData = ['Magazzino', 'Officina', 'Laboratorio'];
        
        debugLog('Caricamento dati attrezzature...');
        // Carica i dati delle attrezzature
        await loadData();
        
        debugLog('Setup event listeners...');
        // Inizializza gli event listeners
        setupEventListeners();
        
        debugLog('Inizializzazione completata');
    } catch (error) {
        console.error('Errore durante l\'inizializzazione:', error);
        showError('Errore durante l\'inizializzazione dell\'app');
    } finally {
        hideLoadingOverlay();
    }
});

// Setup degli event listeners
function setupEventListeners() {
    debugLog('Setup event listeners');
    document.getElementById('menuToggle')?.addEventListener('click', toggleMenu);
    document.getElementById('menuClose')?.addEventListener('click', closeMenu);
    document.getElementById('menuOverlay')?.addEventListener('click', closeMenu);
    document.getElementById('searchToggle')?.addEventListener('click', toggleSearch);
    document.getElementById('searchClose')?.addEventListener('click', closeSearch);
    document.getElementById('searchOverlay')?.addEventListener('click', closeSearch);
    document.getElementById('btnRefresh')?.addEventListener('click', loadFromGoogleSheets);
    
    // Navigation eventi
    document.getElementById('navUbicazione')?.addEventListener('click', function() { switchView('ubicazione'); });
    document.getElementById('navCategoria')?.addEventListener('click', function() { switchView('categoria'); });
    document.getElementById('navTipo')?.addEventListener('click', function() { switchView('tipo'); });

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
};

// Funzione helper per le chiamate API
async function callApi(action, data = null) {
    debugLog('Chiamata API:', { action, data });
    
    // Usa GET per operazioni di lettura, POST per operazioni di scrittura
    const isReadOperation = ['getData', 'getLocations'].includes(action);
    const url = new URL(WEBAPP_URL);
    
    if (isReadOperation) {
        // Per le operazioni GET, aggiungi i parametri all'URL
        url.searchParams.append('action', action);
        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }
        
        const options = {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };
        debugLog('GET request:', { url: url.toString(), options });
    } else {
        // Per le operazioni POST, usa il body JSON
        var options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: action,
                data: data
            })
        };
        debugLog('POST request:', { url: url.toString(), options });
    }    try {
        const response = await fetch(isReadOperation ? url.toString() : WEBAPP_URL, options);
        debugLog('Risposta ricevuta:', response);
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        debugLog('Dati ricevuti:', result);
        
        // Non controlliamo più result.success ma verifichiamo che ci sia result.data o result.status
        if (!result.data && !result.status) {
            throw new Error(result.error || 'Errore nella risposta');
        }
        
        return result;
    } catch (error) {
        console.error('Errore nella chiamata API:', error);
        throw error;
    }
}

// Funzione per caricare i dati delle attrezzature
async function loadData() {
    try {
        debugLog('Inizio caricamento dati');
        showLoadingOverlay('Caricamento dati in corso...');
        
        const result = await callApi('getData');
        attrezzature = result.data || [];
        filteredData = [...attrezzature];
        debugLog('Dati processati:', {
            attrezzature: attrezzature.length,
            filteredData: filteredData.length
        });
        
        renderCurrentView();
    } catch (error) {
        console.error('Errore nel caricamento:', error);
        showError('Errore nel caricamento dei dati. Carico i dati demo...');
        loadDemoData();
    } finally {
        hideLoadingOverlay();
    }
}

// Funzione per caricare le ubicazioni
async function loadLocations() {
    try {
        debugLog('Inizio caricamento ubicazioni');
        const result = await callApi('getLocations');
        locationsData = result.locations || [];
        debugLog('Ubicazioni caricate:', locationsData);
    } catch (error) {
        console.error('Errore nel caricamento delle ubicazioni:', error);
        locationsData = ['Magazzino', 'Officina', 'Laboratorio'];
        debugLog('Caricamento ubicazioni di default:', locationsData);
        showError('Errore nel caricamento delle ubicazioni. Uso le ubicazioni di default.');
    }
}

// Funzione per caricare i dati demo
function loadDemoData() {
    attrezzature = [
        {
            id: 'DEMO1',
            codice: 'ATT001',
            tipo: 'Chiave inglese',
            marcaModello: 'Stanley 12"',
            ubicazione: 'Magazzino',
            categoria: 'Utensili manuali',
            stato: 'Disponibile',
            note: 'Attrezzatura demo',
            movimenti: []
        }
    ];
    filteredData = [...attrezzature];
    renderCurrentView();
}

// Funzioni UI
function toggleMenu() {
    document.getElementById('slideMenu').classList.add('open');
    document.getElementById('menuOverlay').classList.add('show');
}

function closeMenu() {
    document.getElementById('slideMenu').classList.remove('open');
    document.getElementById('menuOverlay').classList.remove('show');
}

function toggleSearch() {
    document.getElementById('searchOverlay').classList.add('show');
    setTimeout(function() {
        document.getElementById('searchInput').focus();
    }, 300);
}

function closeSearch() {
    document.getElementById('searchOverlay').classList.remove('show');
}

function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.classList.remove('active');
    });
    document.querySelector('[data-view="' + view + '"]').classList.add('active');
    
    renderCurrentView();
}

function renderCurrentView() {
    debugLog('Rendering vista corrente:', currentView);
    const container = document.querySelector('.container');
    if (!container) {
        console.error('Container non trovato');
        return;
    }

    try {
        switch(currentView) {
            case 'ubicazione':
                renderLocationView();
                break;
            case 'categoria':
                renderCategoryView();
                break;
            case 'tipo':
                renderTypeView();
                break;
            default:
                console.error('Vista non riconosciuta:', currentView);
        }
    } catch (error) {
        console.error('Errore durante il rendering:', error);
        showError('Errore durante la visualizzazione dei dati');
    }
}

function renderLocationView(container) {
    const locations = getLocationGroups();
    
    if (locations.length === 0) {
        container.innerHTML = '<div class="loading"><p>Nessuna ubicazione trovata</p></div>';
        return;
    }

    container.innerHTML = locations.map(function(location) {
        return '<div class="location-card" onclick="showLocationEquipment(\'' + location.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">📍 ' + location.name + '</div>' +
                '<div class="card-count">' + location.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + location.types.slice(0, 3).join(', ') + (location.types.length > 3 ? '...' : '') + '</div>' +
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
        return '<div class="category-card" onclick="showCategoryEquipment(\'' + category.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">📂 ' + category.name + '</div>' +
                '<div class="card-count">' + category.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + category.types.slice(0, 3).join(', ') + (category.types.length > 3 ? '...' : '') + '</div>' +
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
        return '<div class="type-card" onclick="showTypeEquipment(\'' + type.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">🔧 ' + type.name + '</div>' +
                '<div class="card-count">' + type.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + type.locations.slice(0, 3).join(', ') + (type.locations.length > 3 ? '...' : '') + '</div>' +
        '</div>';
    }).join('');
}

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

// Funzione per ricaricare i dati da Google Sheets
async function loadFromGoogleSheets() {
    debugLog('Ricaricamento dati da Google Sheets');
    try {
        showLoadingOverlay('Aggiornamento dati...');
        await loadLocations();
        await loadData();
        showError('Dati aggiornati con successo!');
    } catch (error) {
        console.error('Errore durante il ricaricamento:', error);
        showError('Errore durante l\'aggiornamento dei dati');
    } finally {
        hideLoadingOverlay();
    }
}

// Funzione per filtrare le attrezzature
function getFilteredEquipment() {
    debugLog('Filtraggio attrezzature con filtro:', currentFilter);
    if (!currentFilter) return attrezzature;
    
    return attrezzature.filter(function(item) {
        const searchFields = [
            item.codice,
            item.tipo,
            item.marcaModello,
            item.ubicazione,
            item.categoria
        ].map(field => (field || '').toLowerCase());
        
        return searchFields.some(field => field.includes(currentFilter.toLowerCase()));
    });
}

// Funzione per ottenere una attrezzatura per ID
function getEquipmentById(id) {
    debugLog('Ricerca attrezzatura per ID:', id);
    return attrezzature.find(item => item.id === id);
}

// Funzione per caricare i dati delle attrezzature
async function loadData() {
    try {
        debugLog('Inizio caricamento dati');
        showLoadingOverlay('Caricamento dati in corso...');
        
        const result = await callApi('getData');
        attrezzature = result.data || [];
        filteredData = [...attrezzature];
        debugLog('Dati processati:', {
            attrezzature: attrezzature.length,
            filteredData: filteredData.length
        });
        
        renderCurrentView();
    } catch (error) {
        console.error('Errore nel caricamento:', error);
        showError('Errore nel caricamento dei dati. Carico i dati demo...');
        loadDemoData();
    } finally {
        hideLoadingOverlay();
    }
}

// Funzione per caricare le ubicazioni
async function loadLocations() {
    try {
        debugLog('Inizio caricamento ubicazioni');
        const result = await callApi('getLocations');
        locationsData = result.locations || [];
        debugLog('Ubicazioni caricate:', locationsData);
    } catch (error) {
        console.error('Errore nel caricamento delle ubicazioni:', error);
        locationsData = ['Magazzino', 'Officina', 'Laboratorio'];
        debugLog('Caricamento ubicazioni di default:', locationsData);
        showError('Errore nel caricamento delle ubicazioni. Uso le ubicazioni di default.');
    }
}

// Funzione per caricare i dati demo
function loadDemoData() {
    attrezzature = [
        {
            id: 'DEMO1',
            codice: 'ATT001',
            tipo: 'Chiave inglese',
            marcaModello: 'Stanley 12"',
            ubicazione: 'Magazzino',
            categoria: 'Utensili manuali',
            stato: 'Disponibile',
            note: 'Attrezzatura demo',
            movimenti: []
        }
    ];
    filteredData = [...attrezzature];
    renderCurrentView();
}

// Funzioni UI
function toggleMenu() {
    document.getElementById('slideMenu').classList.add('open');
    document.getElementById('menuOverlay').classList.add('show');
}

function closeMenu() {
    document.getElementById('slideMenu').classList.remove('open');
    document.getElementById('menuOverlay').classList.remove('show');
}

function toggleSearch() {
    document.getElementById('searchOverlay').classList.add('show');
    setTimeout(function() {
        document.getElementById('searchInput').focus();
    }, 300);
}

function closeSearch() {
    document.getElementById('searchOverlay').classList.remove('show');
}

function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.classList.remove('active');
    });
    document.querySelector('[data-view="' + view + '"]').classList.add('active');
    
    renderCurrentView();
}

function renderCurrentView() {
    debugLog('Rendering vista corrente:', currentView);
    const container = document.querySelector('.container');
    if (!container) {
        console.error('Container non trovato');
        return;
    }

    try {
        switch(currentView) {
            case 'ubicazione':
                renderLocationView();
                break;
            case 'categoria':
                renderCategoryView();
                break;
            case 'tipo':
                renderTypeView();
                break;
            default:
                console.error('Vista non riconosciuta:', currentView);
        }
    } catch (error) {
        console.error('Errore durante il rendering:', error);
        showError('Errore durante la visualizzazione dei dati');
    }
}

function renderLocationView(container) {
    const locations = getLocationGroups();
    
    if (locations.length === 0) {
        container.innerHTML = '<div class="loading"><p>Nessuna ubicazione trovata</p></div>';
        return;
    }

    container.innerHTML = locations.map(function(location) {
        return '<div class="location-card" onclick="showLocationEquipment(\'' + location.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">📍 ' + location.name + '</div>' +
                '<div class="card-count">' + location.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + location.types.slice(0, 3).join(', ') + (location.types.length > 3 ? '...' : '') + '</div>' +
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
        return '<div class="category-card" onclick="showCategoryEquipment(\'' + category.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">📂 ' + category.name + '</div>' +
                '<div class="card-count">' + category.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + category.types.slice(0, 3).join(', ') + (category.types.length > 3 ? '...' : '') + '</div>' +
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
        return '<div class="type-card" onclick="showTypeEquipment(\'' + type.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">🔧 ' + type.name + '</div>' +
                '<div class="card-count">' + type.count + '</div>' +
            '</div>' +
            '<div class="card-items">' + type.locations.slice(0, 3).join(', ') + (type.locations.length > 3 ? '...' : '') + '</div>' +
        '</div>';
    }).join('');
}

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

// Funzione per visualizzare le attrezzature di una ubicazione
function showLocationEquipment(location) {
    const equipment = getFilteredEquipment().filter(item => item.ubicazione === location);
    renderEquipmentList(equipment, '📍 ' + location);
}

// Funzione per visualizzare le attrezzature di una categoria
function showCategoryEquipment(category) {
    const equipment = getFilteredEquipment().filter(item => item.categoria === category);
    renderEquipmentList(equipment, '📂 ' + category);
}

// Funzione per visualizzare le attrezzature di un tipo
function showTypeEquipment(type) {
    const equipment = getFilteredEquipment().filter(item => item.tipo === type);
    renderEquipmentList(equipment, '🔧 ' + type);
}

// Funzione per renderizzare la lista delle attrezzature
function renderEquipmentList(equipment, title) {
    const container = document.querySelector('.container');
    if (!container) return;

    let html = '<div class="list-header">';
    html += '<button class="back-button" onclick="renderCurrentView()">←</button>';
    html += '<h2>' + title + '</h2>';
    html += '</div>';
    
    if (equipment.length === 0) {
        html += '<div class="no-items">Nessuna attrezzatura trovata</div>';
    } else {
        html += '<div class="equipment-list">';
        equipment.forEach(function(item) {
            html += '<div class="equipment-card" onclick="showEquipmentDetail(\'' + item.id + '\')">';
            html += '<div class="card-header">';
            html += '<div class="card-title">' + item.tipo + '</div>';
            html += '<div class="card-status">' + item.stato + '</div>';
            html += '</div>';
            html += '<div class="card-details">';
            html += '<div class="detail-row"><strong>Codice:</strong> ' + item.codice + '</div>';
            html += '<div class="detail-row"><strong>Marca/Modello:</strong> ' + item.marcaModello + '</div>';
            html += '<div class="detail-row"><strong>Ubicazione:</strong> ' + item.ubicazione + '</div>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
}

// Funzione per mostrare i dettagli di un'attrezzatura
function showEquipmentDetail(id) {
    const equipment = getEquipmentById(id);
    if (!equipment) {
        showError('Attrezzatura non trovata');
        return;
    }
    
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('detailContent');
    
    let html = '<div class="detail-header">';
    html += '<h2>' + equipment.tipo + '</h2>';
    html += '<div class="detail-status">' + equipment.stato + '</div>';
    html += '</div>';
    
    html += '<div class="detail-body">';
    html += '<div class="detail-section">';
    html += '<div class="detail-row"><strong>Codice:</strong> ' + equipment.codice + '</div>';
    html += '<div class="detail-row"><strong>Marca/Modello:</strong> ' + equipment.marcaModello + '</div>';
    html += '<div class="detail-row"><strong>Categoria:</strong> ' + equipment.categoria + '</div>';
    html += '<div class="detail-row"><strong>Ubicazione:</strong> ' + equipment.ubicazione + '</div>';
    if (equipment.note) {
        html += '<div class="detail-row"><strong>Note:</strong> ' + equipment.note + '</div>';
    }
    html += '</div>';
    
    if (equipment.movimenti && equipment.movimenti.length > 0) {
        html += '<div class="detail-section">';
        html += '<h3>Storico Movimenti</h3>';
        html += '<div class="movement-list">';
        equipment.movimenti.forEach(function(movimento) {
            html += '<div class="movement-item">';
            html += '<div class="movement-date">' + movimento.data + '</div>';
            html += '<div class="movement-details">';
            html += '<div>' + movimento.da + ' → ' + movimento.a + '</div>';
            if (movimento.note) {
                html += '<div class="movement-notes">' + movimento.note + '</div>';
            }
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    }
    html += '</div>';
    
    html += '<div class="detail-actions">';
    html += '<button class="btn" onclick="showMoveEquipmentModal(\'' + equipment.id + '\')">Sposta Attrezzatura</button>';
    html += '</div>';
    
    content.innerHTML = html;
    modal.style.display = 'block';
}

// Funzione per chiudere il modal dei dettagli
function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    modal.style.display = 'none';
}

// Funzione per mostrare il modal di spostamento
async function showMoveEquipmentModal(id) {
    const equipment = getEquipmentById(id);
    if (!equipment) {
        showError('Attrezzatura non trovata');
        return;
    }
    
    currentEquipment = equipment;
    
    const modal = document.getElementById('moveModal');
    const locationSelect = document.getElementById('newLocation');
    
    // Aggiorna la lista delle ubicazioni
    locationSelect.innerHTML = '<option value="">Seleziona ubicazione...</option>' +
        locationsData
            .filter(loc => loc !== equipment.ubicazione) // Esclude l'ubicazione attuale
            .map(loc => `<option value="${loc}">${loc}</option>`)
            .join('');
    
    modal.style.display = 'block';
}

// Funzione per chiudere il modal di spostamento
function closeMoveModal() {
    const modal = document.getElementById('moveModal');
    modal.style.display = 'none';
    document.getElementById('moveForm').reset();
}

// Funzione per gestire lo spostamento dell'attrezzatura
async function moveEquipment(event) {
    event.preventDefault();
    
    if (!currentEquipment) {
        showError('Nessuna attrezzatura selezionata');
        return;
    }
    
    const newLocation = document.getElementById('newLocation').value;
    const notes = document.getElementById('moveNotes').value;
    
    if (!newLocation) {
        showError('Seleziona una nuova ubicazione');
        return;
    }
    
    try {
        showLoadingOverlay('Spostamento in corso...');
        
        // Prepara i dati per l'aggiornamento
        const updateData = {
            id: currentEquipment.id,
            oldLocation: currentEquipment.ubicazione,
            newLocation: newLocation,
            notes: notes
        };
        
        // Invia la richiesta di aggiornamento
        const result = await callApi('moveEquipment', updateData);
        
        // Aggiorna i dati locali
        currentEquipment.ubicazione = newLocation;
        if (!currentEquipment.movimenti) {
            currentEquipment.movimenti = [];
        }
        
        currentEquipment.movimenti.unshift({
            data: new Date().toLocaleString(),
            da: updateData.oldLocation,
            a: newLocation,
            note: notes
        });
        
        // Chiudi i modal e aggiorna la vista
        closeMoveModal();
        closeDetailModal();
        showError('Attrezzatura spostata con successo!');
        renderCurrentView();
        
    } catch (error) {
        console.error('Errore durante lo spostamento:', error);
        showError('Errore durante lo spostamento dell\'attrezzatura');
    } finally {
        hideLoadingOverlay();
    }
}

// Event listener per il form di spostamento
document.getElementById('moveForm')?.addEventListener('submit', moveEquipment);