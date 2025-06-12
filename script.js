// Costanti
const SHEET_ID = '1efHWyYHqsZpAbPXuUadz7Mg2ScsZ1iXX15Yv8daVhvg';
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyWzNZ91kZBr9D3PhQNO7FLSXypRt1Ret0EvlBMuW_GgIAMKB9r4Ag4GHnvoHCVJCUvsA/exec';

// Variabili globali
let currentView = 'ubicazione';
let currentEquipmentId = null;
let currentFilter = '';

let equipmentData = [];
let locationsData = [];
let categoriesData = [];
let movementLog = [];

// Funzioni di inizializzazione
document.addEventListener('DOMContentLoaded', function() {
    loadFromGoogleSheets();
});

function loadFromGoogleSheets() {
    showLoading('Caricamento da Google Sheets...');
    
    console.log('Tentativo di caricamento da Google Sheets...');
    console.log('Sheet ID:', SHEET_ID);
    
    const ranges = [
        'attrezzatura!A:E',
        'log!A:G', 
        'elenchi!A:A'
    ];

    const API_KEY = 'AIzaSyCc8HZz0QCZ-OtQF_wu4GuBhmeAdTceUWE';
    
    const promises = ranges.map(range => {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
        console.log('Fetching:', url);
        
        return fetch(url)
            .then(response => {
                console.log('Response status:', response.status);
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}\nResponse: ${text}`);
                    });
                }
                return response.json();
            })
            .catch(error => {
                console.error('Error fetching range', range, ':', error);
                throw error;
            });
    });    Promise.all(promises)
        .then(function(results) {
            console.log('Dati ricevuti:', results);
            
            const attrezzaturaData = results[0];
            const logData = results[1];
            const elenchiData = results[2];

            if (!attrezzaturaData.values || attrezzaturaData.values.length < 2) {
                throw new Error('Nessun dato trovato nel foglio attrezzatura');
            }

            processAttrezzaturaData(attrezzaturaData.values || []);
            processLogData(logData.values || []);
            processElenchiData(elenchiData.values || []);

            console.log('✅ Dati caricati da Google Sheets:', {
                attrezzature: equipmentData.length,
                ubicazioni: locationsData.length,
                movimenti: movementLog.length
            });

            renderCurrentView();
            hideLoading();
        })
        .catch(function(error) {
            console.error('Errore nel caricamento da Google Sheets:', error);
            alert('❌ Errore nel caricamento da Google Sheets:\n' + error.message + '\n\n📋 Verifica che il foglio sia pubblico e abbia le schede corrette\n\n🔄 Carico i dati demo come fallback...');
            loadDemoData();
        });
}

function loadDemoData() {
    equipmentData = [
        {
            id: 1,
            codice: "ATTR0050",
            categoria: "ATTREZZATURE ELETTRICHE",
            tipo: "TRAPANO",
            marcaModello: "MAKITA HP457DWE",
            ubicazione: "MANDELLI"
        },
        // ... altri dati demo ...
    ];

    locationsData = ["MANDELLI", "FRIGERIO", "LABORATORIO", "SALUTE", "PALERMO", "TRIESTE", "VALIER", "ZANAROLI"];
    categoriesData = ["ATTREZZATURE ELETTRICHE", "ATTREZZATURE FRIGORIFERO", "LABORATORIO", "SALUTE", "TRABATELLI E SCALE"];
    
    movementLog = [
        {
            codice: "ATTR0050",
            data: "2025-06-10T14:30:00",
            utente: "Mario Rossi",
            da: "LABORATORIO",
            a: "MANDELLI"
        },
        // ... altri log demo ...
    ];
    
    console.log('Dati demo caricati:', equipmentData.length, 'attrezzature');
    renderCurrentView();
}

// Funzioni di processamento dati
function processAttrezzaturaData(data) {
    if (data.length < 2) return;
    
    equipmentData = [];
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.length >= 5) {
            equipmentData.push({
                id: i,
                categoria: row[0] || '',
                tipo: row[1] || '',
                marcaModello: row[2] || '',
                ubicazione: row[3] || '',
                codice: row[4] || ''
            });
        }
    }
    
    categoriesData = [];
    const cats = new Set();
    equipmentData.forEach(function(item) {
        if (item.categoria) cats.add(item.categoria);
    });
    categoriesData = Array.from(cats);
}

function processLogData(data) {
    if (data.length < 2) return;
    
    movementLog = [];
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.length >= 7) {
            movementLog.push({
                data: row[0] || '',
                utente: row[1] || '',
                azione: row[2] || '',
                tabella: row[3] || '',
                codice: row[4] || '',
                da: row[5] || '',
                a: row[6] || ''
            });
        }
    }
}

function processElenchiData(data) {
    if (data.length < 2) return;
    
    locationsData = [];
    for (let i = 1; i < data.length; i++) {
        if (data[i] && data[i][0]) {
            locationsData.push(data[i][0]);
        }
    }
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
        const searchInput = document.getElementById('searchInput');
        searchInput.focus();
        if (searchInput.value.length > 0) {
            document.getElementById('clearSearch').classList.add('visible');
        }
    }, 300);
}

function closeSearch() {
    document.getElementById('searchOverlay').classList.remove('show');
}

function handleSearchInput(input) {
    const clearButton = document.getElementById('clearSearch');
    if (input.value.length > 0) {
        clearButton.classList.add('visible');
    } else {
        clearButton.classList.remove('visible');
    }
    renderCurrentView();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    document.getElementById('clearSearch').classList.remove('visible');
    renderCurrentView();
}

// Funzioni di rendering
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
    
    const locationCards = locations.map(function(location) {
        const equipmentCount = location.equipment.length;
        const equipmentList = location.equipment
            .map(function(item) { return item.tipo; })
            .join(', ');
        
        return '<div class="location-card" onclick="showLocationEquipment(\'' + location.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">' + location.name + '</div>' +
                '<div class="card-count">' + equipmentCount + '</div>' +
            '</div>' +
            '<div class="card-items">' + equipmentList + '</div>' +
        '</div>';
    }).join('');
    
    container.innerHTML = locationCards;
}

function renderCategoryView(container) {
    const categories = getCategoryGroups();
    
    if (categories.length === 0) {
        container.innerHTML = '<div class="loading"><p>Nessuna categoria trovata</p></div>';
        return;
    }
    
    const categoryCards = categories.map(function(category) {
        const equipmentCount = category.equipment.length;
        const equipmentList = category.equipment
            .map(function(item) { return item.tipo; })
            .join(', ');
        
        return '<div class="category-card" onclick="showCategoryEquipment(\'' + category.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">' + category.name + '</div>' +
                '<div class="card-count">' + equipmentCount + '</div>' +
            '</div>' +
            '<div class="card-items">' + equipmentList + '</div>' +
        '</div>';
    }).join('');
    
    container.innerHTML = categoryCards;
}

function renderTypeView(container) {
    const types = getTypeGroups();
    
    if (types.length === 0) {
        container.innerHTML = '<div class="loading"><p>Nessun tipo trovato</p></div>';
        return;
    }
    
    const typeCards = types.map(function(type) {
        const equipmentCount = type.equipment.length;
        const equipmentList = type.equipment
            .map(function(item) { return item.marcaModello; })
            .join(', ');
        
        return '<div class="type-card" onclick="showTypeEquipment(\'' + type.name + '\')">' +
            '<div class="card-header">' +
                '<div class="card-title">' + type.name + '</div>' +
                '<div class="card-count">' + equipmentCount + '</div>' +
            '</div>' +
            '<div class="card-items">' + equipmentList + '</div>' +
        '</div>';
    }).join('');
    
    container.innerHTML = typeCards;
}

// Funzioni di utilità
function getLocationGroups() {
    const locations = {};
    
    equipmentData.forEach(function(item) {
        if (currentFilter && !matchesFilter(item)) return;
        
        if (!locations[item.ubicazione]) {
            locations[item.ubicazione] = {
                name: item.ubicazione,
                equipment: []
            };
        }
        locations[item.ubicazione].equipment.push(item);
    });
    
    return Object.values(locations).sort((a, b) => a.name.localeCompare(b.name));
}

function getCategoryGroups() {
    const categories = {};
    
    equipmentData.forEach(function(item) {
        if (currentFilter && !matchesFilter(item)) return;
        
        if (!categories[item.categoria]) {
            categories[item.categoria] = {
                name: item.categoria,
                equipment: []
            };
        }
        categories[item.categoria].equipment.push(item);
    });
    
    return Object.values(categories).sort((a, b) => a.name.localeCompare(b.name));
}

function getTypeGroups() {
    const types = {};
    
    equipmentData.forEach(function(item) {
        if (currentFilter && !matchesFilter(item)) return;
        
        if (!types[item.tipo]) {
            types[item.tipo] = {
                name: item.tipo,
                equipment: []
            };
        }
        types[item.tipo].equipment.push(item);
    });
    
    return Object.values(types).sort((a, b) => a.name.localeCompare(b.name));
}

function matchesFilter(item) {
    const filter = currentFilter.toLowerCase();
    return item.codice.toLowerCase().includes(filter) ||
           item.tipo.toLowerCase().includes(filter) ||
           item.categoria.toLowerCase().includes(filter) ||
           item.marcaModello.toLowerCase().includes(filter) ||
           item.ubicazione.toLowerCase().includes(filter);
}

// Funzioni per la gestione dei dettagli
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
        closeDetailModal();
        alert('✅ Attrezzatura ' + equipment.codice + ' spostata da ' + oldLocation + ' a ' + newLocation);
        
        renderCurrentView();
    } catch (error) {
        hideLoading();
        console.error('Errore durante lo spostamento:', error);
        alert('❌ Errore durante lo spostamento: ' + error.message);
    }
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

// Funzioni di integrazione con Google Sheets
async function updateGoogleSheetViaWebApp(action, data) {
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

// Funzioni di loading
function showLoading(message) {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

// Funzioni di ricerca
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
