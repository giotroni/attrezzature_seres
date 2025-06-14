// Costanti e variabili globali
const SHEET_ID = '1efHWyYHqsZpAbPXuUadz7Mg2ScsZ1iXX15Yv8daVhvg';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycby77YAe1Neoyke8JTq3RzkeHLYQHuyTI3V1JzcTEaHAUeyZnMqQFStN33KaZaAqGAfvoA/exec';

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
    console.log('App SERES caricata correttamente');
    
    try {
        showLoadingOverlay('Inizializzazione app...');
        // Prima carica le ubicazioni
        await loadLocations();
        // Poi carica i dati delle attrezzature
        await loadData();
    } catch (error) {
        console.error('Errore durante l\'inizializzazione:', error);
        showError('Errore durante l\'inizializzazione dell\'app');
    } finally {
        hideLoadingOverlay();
    }
    
    // Inizializza gli event listeners
    setupEventListeners();
});

// Setup degli event listeners
function setupEventListeners() {
    document.getElementById('menuToggle')?.addEventListener('click', toggleMenu);
    document.getElementById('menuClose')?.addEventListener('click', closeMenu);
    document.getElementById('menuOverlay')?.addEventListener('click', closeMenu);
    document.getElementById('searchToggle')?.addEventListener('click', toggleSearch);
    document.getElementById('searchClose')?.addEventListener('click', closeSearch);
    document.getElementById('searchOverlay')?.addEventListener('click', closeSearch);
    document.getElementById('searchInput')?.addEventListener('input', filterContent);
    document.getElementById('searchInput')?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            closeSearch();
        }
    });
    document.getElementById('closeDetailModal')?.addEventListener('click', closeDetailModal);
    document.getElementById('moveEquipmentBtn')?.addEventListener('click', moveEquipment);
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

// Funzione per caricare i dati delle attrezzature
async function loadData() {
    try {
        showLoadingOverlay('Caricamento dati in corso...');
        const response = await fetch(`${WEBAPP_URL}?action=getData`);
        if (!response.ok) {
            throw new Error('Errore nella risposta del server');
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Errore nel formato dei dati');
        }
        
        attrezzature = data.data || [];
        filteredData = [...attrezzature];
        
        // Inizializza la vista corrente
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
        const response = await fetch(`${WEBAPP_URL}?action=getLocations`);
        if (!response.ok) {
            throw new Error('Errore nella risposta del server');
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Errore nel formato dei dati delle ubicazioni');
        }
        
        locationsData = data.locations || [];
        console.log('Ubicazioni caricate:', locationsData);
    } catch (error) {
        console.error('Errore nel caricamento delle ubicazioni:', error);
        // Carica le ubicazioni di default in caso di errore
        locationsData = ['Magazzino', 'Officina', 'Laboratorio'];
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
    const container = document.getElementById('viewContent');
    
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
        return '<div class="equipment-card" onclick="showEquipmentDetail(' + item.id + ')">' +
            '<div class="equipment-header">' +
                '<span class="equipment-code">' + item.codice + '</span>' +
                '<span class="equipment-category">' + item.categoria + '</span>' +
            '</div>' +
            '<div class="equipment-title">' + item.tipo + '</div>' +
            '<div class="equipment-brand">' + item.marcaModello + '</div>' +
            '<div class="equipment-location">' +
                '<span class="location-icon"></span>' +
                item.ubicazione +
            '</div>' +
        '</div>';
    }).join('');

    container.innerHTML = backButton + equipmentCards;
}

function showEquipmentDetail(id) {
    const equipment = equipmentData.find(function(item) {
        return item.id === id;
    });
    if (!equipment) return;

    currentEquipmentId = id;
    
    document.getElementById('modalTitle').textContent = equipment.tipo;
    
    const detailsHtml = 
        '<div class="detail-item">' +
            '<div class="detail-label">Codice</div>' +
            '<div class="detail-value">' + equipment.codice + '</div>' +
        '</div>' +
        '<div class="detail-item">' +
            '<div class="detail-label">Categoria</div>' +
            '<div class="detail-value">' + equipment.categoria + '</div>' +
        '</div>' +
        '<div class="detail-item">' +
            '<div class="detail-label">Tipo</div>' +
            '<div class="detail-value">' + equipment.tipo + '</div>' +
        '</div>' +
        '<div class="detail-item">' +
            '<div class="detail-label">Marca/Modello</div>' +
            '<div class="detail-value">' + equipment.marcaModello + '</div>' +
        '</div>' +
        '<div class="detail-item">' +
            '<div class="detail-label">Ubicazione Attuale</div>' +
            '<div class="detail-value">📍 ' + equipment.ubicazione + '</div>' +
        '</div>';
    
    document.getElementById('equipmentDetails').innerHTML = detailsHtml;
    
    const locationSelect = document.getElementById('newLocation');
    locationSelect.innerHTML = '<option value="">Seleziona ubicazione...</option>' +
        locationsData
            .filter(function(loc) { return loc !== equipment.ubicazione; })
            .map(function(loc) { return '<option value="' + loc + '">' + loc + '</option>'; })
            .join('');
    
    showMovementHistory(equipment.codice);
    
    document.getElementById('detailModal').style.display = 'block';
}

function closeDetailModal() {
    document.getElementById('detailModal').style.display = 'none';
    document.getElementById('newLocation').value = '';
    document.getElementById('userName').value = '';
}

function showMovementHistory(codice) {
    const movements = movementLog.filter(function(log) {
        return log.codice === codice;
    });
    const historyContainer = document.getElementById('movementHistory');
    
    if (movements.length === 0) {
        historyContainer.innerHTML = '<p style="color: #666; font-style: italic;">Nessuno spostamento registrato</p>';
        return;
    }
    
    historyContainer.innerHTML = movements
        .sort(function(a, b) {
            return new Date(b.data) - new Date(a.data);
        })
        .map(function(movement) {
            const date = new Date(movement.data);
            return '<div class="history-item">' +
                '<div class="history-date">' + date.toLocaleDateString('it-IT') + ' ' + date.toLocaleTimeString('it-IT', {hour: '2-digit', minute: '2-digit'}) + '</div>' +
                '<div class="history-action">' +
                    '<strong>' + movement.utente + '</strong> ha spostato da ' +
                    '<strong>' + movement.da + '</strong> a <strong>' + movement.a + '</strong>' +
                '</div>' +
            '</div>';
        }).join('');
}

async function updateGoogleSheet(range, values) {
    const API_KEY = 'AIzaSyCc8HZz0QCZ-OtQF_wu4GuBhmeAdTceUWE';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=RAW&key=${API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: values
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del foglio Google:', error);
        throw error;
    }
}

async function appendToGoogleSheet(range, values) {
    const API_KEY = 'AIzaSyCc8HZz0QCZ-OtQF_wu4GuBhmeAdTceUWE';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: values
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Errore durante l\'aggiunta al foglio Google:', error);
        throw error;
    }
}

async function findRowInSheet(codice) {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/attrezzatura!A:E?key=AIzaSyCc8HZz0QCZ-OtQF_wu4GuBhmeAdTceUWE`);
        const data = await response.json();
        const values = data.values || [];
        
        // Trova l'indice della riga con il codice specificato
        for (let i = 0; i < values.length; i++) {
            if (values[i][4] === codice) { // La colonna E (indice 4) contiene il codice
                return i + 1; // +1 perché le righe in Google Sheets iniziano da 1
            }
        }
        return null;
    } catch (error) {
        console.error('Errore durante la ricerca nel foglio Google:', error);
        throw error;
    }
}

async function updateGoogleSheetViaWebApp(action, data) {
    const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyWzNZ91kZBr9D3PhQNO7FLSXypRt1Ret0EvlBMuW_GgIAMKB9r4Ag4GHnvoHCVJCUvsA/exec';
    
    try {
        const response = await fetch(WEBAPP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: action,
                data: data
            })
        });

        // A causa di 'no-cors', non possiamo leggere la risposta
        // Assumiamo che sia andata a buon fine se non ci sono errori
        return true;
    } catch (error) {
        console.error('Errore durante l\'aggiornamento del foglio Google:', error);
        throw error;
    }
}

async function moveEquipment() {
    const newLocation = document.getElementById('newLocation').value;
    const userName = document.getElementById('userName').value.trim();
    
    if (!newLocation || !userName) {
        alert('⚠️ Seleziona una ubicazione e inserisci il tuo nome');
        return;
    }
    
    const equipment = equipmentData.find(function(item) {
        return item.id === currentEquipmentId;
    });
    const oldLocation = equipment.ubicazione;
    
    try {
        showLoading('Spostamento attrezzatura in corso...');

        // Invia i dati all'Apps Script
        await updateGoogleSheetViaWebApp('moveEquipment', {
            codice: equipment.codice,
            newLocation: newLocation,
            userName: userName,
            oldLocation: oldLocation,
            timestamp: new Date().toISOString()
        });

        // Aggiorna i dati locali
        equipment.ubicazione = newLocation;
        movementLog.push({
            codice: equipment.codice,
            data: new Date().toISOString(),
            utente: userName,
            azione: 'Spostamento Ubicazione',
            tabella: 'attrezzatura',
            da: oldLocation,
            a: newLocation
        });
        
        hideLoading();
        closeDetailModal(); // Chiude la scheda di dettaglio
        alert('✅ Attrezzatura ' + equipment.codice + ' spostata da ' + oldLocation + ' a ' + newLocation);
        
        renderCurrentView();
    } catch (error) {
        hideLoading();
        console.error('Errore durante lo spostamento:', error);
        alert('❌ Errore durante lo spostamento: ' + error.message);
    }
}

function filterContent() {
    currentFilter = document.getElementById('searchInput').value.toLowerCase();
    const searchText = document.getElementById('searchText');
    
    if (currentFilter) {
        searchText.textContent = currentFilter;
        searchText.classList.add('active');
    } else {
        searchText.textContent = 'Ricerca';
        searchText.classList.remove('active');
    }
    
    renderCurrentView();
}

function showLoading(message) {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}