// Costanti e variabili globali
const API_BASE_URL = '../php/api_materiali.php';

// Viste disponibili
const VIEWS = {
    UBICAZIONE: 'ubicazione',
    CATEGORIA: 'categoria',
    TIPO: 'tipo'
};

let currentView = VIEWS.UBICAZIONE;
let currentFilter = '';
let materiali = [];
let filteredData = [];
let locationsData = [];
let currentMaterialId = null;

// Configurazione viste
const viewConfig = {
    [VIEWS.UBICAZIONE]: {
        icon: '📍',
        title: 'Vista per Ubicazione',
        description: 'Visualizza i materiali raggruppati per ubicazione fisica'
    },
    [VIEWS.CATEGORIA]: {
        icon: '📂',
        title: 'Vista per Categoria',
        description: 'Visualizza i materiali raggruppati per categoria'
    },
    [VIEWS.TIPO]: {
        icon: '🏷️',
        title: 'Vista per Tipo',
        description: 'Visualizza i materiali raggruppati per tipo'
    }
};

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
    
    return { valid: true, formatted: cleanUserName.toUpperCase() };
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize modal events
    initializeModalEvents();
    
    // Menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const slideMenu = document.getElementById('slideMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    const menuClose = document.getElementById('menuClose');
    
    menuToggle.addEventListener('click', () => {
        slideMenu.classList.add('active');
        menuOverlay.classList.add('active');
    });
    
    const closeMenu = () => {
        slideMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
    };
    
    menuClose.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);
    
    // Search toggle
    const searchToggle = document.getElementById('searchToggle');
    const searchOverlay = document.getElementById('searchOverlay');
    const searchClose = document.getElementById('searchClose');
    const searchInput = document.getElementById('searchInput');
    
    searchToggle.addEventListener('click', () => {
        searchOverlay.classList.add('active');
        searchInput.focus();
    });
    
    const closeSearch = () => {
        searchOverlay.classList.remove('active');
        searchInput.value = '';
    };
    
    searchClose.addEventListener('click', closeSearch);
    searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) {
            closeSearch();
        }
    });
    
    // About modal
    const aboutBtn = document.getElementById('btnAbout');
    const aboutModal = document.getElementById('aboutModal');
    const aboutClose = document.getElementById('aboutClose');
    
    aboutBtn.addEventListener('click', () => {
        aboutModal.style.display = 'block';
        closeMenu();
    });
    
    const closeAbout = () => {
        aboutModal.style.display = 'none';
    };
    
    aboutClose.addEventListener('click', closeAbout);
    
    // Refresh button
    const refreshBtn = document.getElementById('btnRefresh');
    refreshBtn.addEventListener('click', () => {
        loadData();
        closeMenu();
    });
    
    // Initial data load
    loadData();

    // Navigation bar
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            // Update current view and render
            currentView = button.dataset.view;
            currentFilter = '';
            renderView();
        });
    });

    // Set initial active button
    const activeButton = document.querySelector(`.nav-button[data-view="${currentView}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
});

// ============================================================================
// DATA LOADING AND RENDERING
// ============================================================================

async function loadData() {
    try {
        showLoadingOverlay('Caricamento dati in corso...');
        
        // Carica le ubicazioni
        const ubicazioniResponse = await fetch(`${API_BASE_URL}?action=getUbicazioni`);
        const ubicazioniData = await ubicazioniResponse.json();
        
        if (!ubicazioniData.success) {
            throw new Error(ubicazioniData.error || 'Errore nel caricamento delle ubicazioni');
        }
        
        locationsData = ubicazioniData.data.map(u => u.nome_ubicazione);

        // Carica le giacenze
        const giacenzeResponse = await fetch(`${API_BASE_URL}?action=getGiacenze`);
        const giacenzeData = await giacenzeResponse.json();
        
        if (!giacenzeData.success) {
            throw new Error(giacenzeData.error || 'Errore nel caricamento delle giacenze');
        }
        
        materiali = giacenzeData.data;
        
        // Aggiorna la vista
        renderView();
        
        hideLoadingOverlay();
    } catch (error) {
        console.error('Errore nel caricamento dei dati:', error);
        showError('⚠️ Errore nel caricamento dei dati');
        hideLoadingOverlay();
    }
}

function renderView() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    // Se c'è un filtro attivo, mostra la vista dettagliata
    if (currentFilter) {
        renderMaterialiUbicazione(mainContent, currentFilter);
        return;
    }

    // Altrimenti, mostra la vista principale con i bottoni di selezione
    if (!currentView) {
        renderMainMenu(mainContent);
        return;
    }

    // Se è selezionata una vista ma non un filtro, mostra la lista appropriata
    switch(currentView) {
        case VIEWS.UBICAZIONE:
            renderUbicazioniList();
            break;
        case VIEWS.CATEGORIA:
            renderCategorieList();
            break;
        case VIEWS.TIPO:
            renderTipiList();
            break;
        default:
            renderMainMenu(mainContent);
    }
}

function renderMainMenu(mainContent) {
    let html = `
        <div class="view-container">
            <div class="view-header">
                <h2>📦 Gestione Materiali</h2>
                <div class="view-stats">
                    ${materiali.length} materiali totali
                </div>
            </div>
            <div class="view-selection">
    `;

    // Genera i bottoni per ogni vista disponibile
    Object.entries(viewConfig).forEach(([viewKey, config]) => {
        html += `
            <div class="view-button" data-view="${viewKey}">
                <div class="view-button-icon">${config.icon}</div>
                <div class="view-button-content">
                    <h3>${config.title}</h3>
                    <p>${config.description}</p>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    mainContent.innerHTML = html;

    // Aggiungi event listeners ai bottoni
    document.querySelectorAll('.view-button').forEach(button => {
        button.addEventListener('click', () => {
            currentView = button.dataset.view;
            renderView();
        });
    });
}

function renderUbicazioniList() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    // Raggruppa i materiali per ubicazione per conteggio
    const materialiPerUbicazione = {};
    materiali.forEach(item => {
        if (!materialiPerUbicazione[item.nome_ubicazione]) {
            materialiPerUbicazione[item.nome_ubicazione] = {
                count: 0,
                materialiCritici: 0
            };
        }
        materialiPerUbicazione[item.nome_ubicazione].count++;
        if (item.quantita_attuale <= item.soglia_minima) {
            materialiPerUbicazione[item.nome_ubicazione].materialiCritici++;
        }
    });

    // Crea l'HTML per la vista delle ubicazioni
    let html = `
        <div class="view-container">
            <div class="view-header">
                <h2>📍 Ubicazioni</h2>
                <div class="view-stats">
                    ${Object.keys(materialiPerUbicazione).length} ubicazioni totali
                </div>
            </div>
            <div class="locations-grid">
    `;

    // Ordina le ubicazioni alfabeticamente
    Object.keys(materialiPerUbicazione).sort().forEach(ubicazione => {
        const stats = materialiPerUbicazione[ubicazione];
        const alertClass = stats.materialiCritici > 0 ? 'location-alert' : '';
        
        html += `
            <div class="location-card ${alertClass}" data-location="${ubicazione}">
                <div class="location-content">
                    <div class="location-icon">📍</div>
                    <div class="location-info">
                        <h3>${ubicazione}</h3>
                        <div class="location-stats">
                            <span class="material-total">${stats.count} materiali</span>
                            ${stats.materialiCritici > 0 ? 
                                `<span class="material-alert">⚠️ ${stats.materialiCritici} sotto scorta</span>` : 
                                ''}
                        </div>
                    </div>
                    <div class="location-arrow">▶</div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    mainContent.innerHTML = html;

    // Aggiungi event listener per i click sulle ubicazioni
    document.querySelectorAll('.location-card').forEach(card => {
        card.addEventListener('click', () => {
            const location = card.dataset.location;
            currentFilter = location;
            renderView();
        });
    });
}

function renderMaterialiUbicazione(mainContent, ubicazione) {
    if (!mainContent) return;
    
    // Filtra i materiali per l'ubicazione selezionata
    const materialiUbicazione = materiali.filter(m => m.nome_ubicazione === ubicazione);
    
    let html = `
        <div class="view-container">
            <div class="view-header">
                <div class="back-button" id="backButton">
                    <span class="back-arrow">◀</span>
                    <span>Torna alle ubicazioni</span>
                </div>
                <div class="location-title">
                    <h2>📍 ${ubicazione}</h2>
                    <div class="view-stats">${materialiUbicazione.length} materiali presenti</div>
                </div>
            </div>
            <div class="materials-list">
    `;

    // Raggruppa per categoria
    const materialiPerCategoria = {};
    materialiUbicazione.forEach(materiale => {
        if (!materialiPerCategoria[materiale.categoria]) {
            materialiPerCategoria[materiale.categoria] = [];
        }
        materialiPerCategoria[materiale.categoria].push(materiale);
    });

    // Ordina le categorie e renderizza i materiali
    Object.keys(materialiPerCategoria).sort().forEach(categoria => {
        html += `
            <div class="category-section">
                <h3 class="category-header">${categoria}</h3>
                <div class="category-items">
        `;

        materialiPerCategoria[categoria].sort((a, b) => a.tipo.localeCompare(b.tipo)).forEach(materiale => {
            const statoClasse = materiale.quantita_attuale <= materiale.soglia_minima ? 'stato-critico' :
                               materiale.quantita_attuale <= (materiale.soglia_minima * 1.5) ? 'stato-basso' : 
                               'stato-ok';

            html += `
                <div class="material-item" data-id="${materiale.codice_materiale}">
                    <div class="material-info">
                        <div class="material-type">${materiale.tipo}</div>
                        <div class="material-details">
                            <span class="material-code">${materiale.codice_materiale}</span>
                            <span class="material-quantity ${statoClasse}">
                                ${materiale.quantita_attuale} ${materiale.unita_misura}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    mainContent.innerHTML = html;

    // Aggiungi event listener per il pulsante indietro
    document.getElementById('backButton').addEventListener('click', () => {
        currentFilter = '';
        renderView();
    });

    // Aggiungi event listener per i click sui materiali
    document.querySelectorAll('.material-item').forEach(item => {
        item.addEventListener('click', () => {
            const materialId = item.dataset.id;
            handleMaterialClick(materialId);
        });
    });
}

function renderCategorieList() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    // Raggruppa i materiali per categoria
    const materialiPerCategoria = {};
    materiali.forEach(item => {
        if (!materialiPerCategoria[item.categoria]) {
            materialiPerCategoria[item.categoria] = {
                count: 0,
                materialiCritici: 0,
                tipi: new Set()
            };
        }
        materialiPerCategoria[item.categoria].count++;
        materialiPerCategoria[item.categoria].tipi.add(item.tipo);
        if (item.quantita_attuale <= item.soglia_minima) {
            materialiPerCategoria[item.categoria].materialiCritici++;
        }
    });

    // Crea l'HTML per la vista delle categorie
    let html = `
        <div class="view-container">
            <div class="view-header">
                <h2>📂 Categorie</h2>
                <div class="view-stats">
                    ${Object.keys(materialiPerCategoria).length} categorie totali
                </div>
            </div>
            <div class="locations-grid">
    `;

    // Ordina le categorie alfabeticamente
    Object.keys(materialiPerCategoria).sort().forEach(categoria => {
        const stats = materialiPerCategoria[categoria];
        const alertClass = stats.materialiCritici > 0 ? 'location-alert' : '';
        
        html += `
            <div class="location-card ${alertClass}" data-category="${categoria}">
                <div class="location-content">
                    <div class="location-icon">📂</div>
                    <div class="location-info">
                        <h3>${categoria}</h3>
                        <div class="location-stats">
                            <span class="material-total">${stats.count} materiali (${stats.tipi.size} tipi)</span>
                            ${stats.materialiCritici > 0 ? 
                                `<span class="material-alert">⚠️ ${stats.materialiCritici} sotto scorta</span>` : 
                                ''}
                        </div>
                    </div>
                    <div class="location-arrow">▶</div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    mainContent.innerHTML = html;

    // Aggiungi event listener per i click sulle categorie
    document.querySelectorAll('.location-card').forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            currentFilter = category;
            renderMaterialiCategoria(mainContent, category);
        });
    });
}

function renderTipiList() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    // Raggruppa i materiali per tipo
    const materialiPerTipo = {};
    materiali.forEach(item => {
        const tipoKey = `${item.categoria}|${item.tipo}`; // Usa combinazione categoria+tipo come chiave
        if (!materialiPerTipo[tipoKey]) {
            materialiPerTipo[tipoKey] = {
                categoria: item.categoria,
                tipo: item.tipo,
                count: 0,
                materialiCritici: 0,
                quantitaTotale: 0
            };
        }
        materialiPerTipo[tipoKey].count++;
        materialiPerTipo[tipoKey].quantitaTotale += parseFloat(item.quantita_attuale) || 0;
        if (item.quantita_attuale <= item.soglia_minima) {
            materialiPerTipo[tipoKey].materialiCritici++;
        }
    });

    // Crea l'HTML per la vista dei tipi
    let html = `
        <div class="view-container">
            <div class="view-header">
                <h2>🏷️ Tipi</h2>
                <div class="view-stats">
                    ${Object.keys(materialiPerTipo).length} tipi totali
                </div>
            </div>
            <div class="locations-grid">
    `;

    // Ordina prima per categoria e poi per tipo
    Object.keys(materialiPerTipo).sort((a, b) => {
        const [catA, tipoA] = a.split('|');
        const [catB, tipoB] = b.split('|');
        if (catA !== catB) return catA.localeCompare(catB);
        return tipoA.localeCompare(tipoB);
    }).forEach(tipoKey => {
        const stats = materialiPerTipo[tipoKey];
        const alertClass = stats.materialiCritici > 0 ? 'location-alert' : '';
        
        html += `
            <div class="location-card ${alertClass}" data-category="${stats.categoria}" data-tipo="${stats.tipo}">
                <div class="location-content">
                    <div class="location-icon">🏷️</div>
                    <div class="location-info">
                        <h3>${stats.tipo}</h3>
                        <div class="categoria-label">${stats.categoria}</div>
                        <div class="location-stats">
                            <span class="material-total">${stats.count} ubicazioni</span>
                            ${stats.materialiCritici > 0 ? 
                                `<span class="material-alert">⚠️ ${stats.materialiCritici} sotto scorta</span>` : 
                                ''}
                        </div>
                    </div>
                    <div class="location-arrow">▶</div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    mainContent.innerHTML = html;

    // Aggiungi event listener per i click sui tipi
    document.querySelectorAll('.location-card').forEach(card => {
        card.addEventListener('click', () => {
            const category = card.dataset.category;
            const tipo = card.dataset.tipo;
            currentFilter = `${category}|${tipo}`;
            renderMaterialiTipo(mainContent, category, tipo);
        });
    });
}

function renderMaterialiCategoria(mainContent, categoria) {
    // Filtra i materiali per la categoria selezionata
    const materialiCategoria = materiali.filter(m => m.categoria === categoria);
    
    let html = `
        <div class="view-container">
            <div class="view-header">
                <div class="back-button" id="backButton">
                    <span class="back-arrow">◀</span>
                    <span>Torna alle categorie</span>
                </div>
                <div class="location-title">
                    <h2>📂 ${categoria}</h2>
                    <div class="view-stats">${materialiCategoria.length} materiali presenti</div>
                </div>
            </div>
            <div class="materials-list">
    `;

    // Raggruppa per tipo
    const materialiPerTipo = {};
    materialiCategoria.forEach(materiale => {
        if (!materialiPerTipo[materiale.tipo]) {
            materialiPerTipo[materiale.tipo] = [];
        }
        materialiPerTipo[materiale.tipo].push(materiale);
    });

    // Ordina i tipi e renderizza i materiali
    Object.keys(materialiPerTipo).sort().forEach(tipo => {
        html += `
            <div class="category-section">
                <h3 class="category-header">${tipo}</h3>
                <div class="category-items">
        `;

        materialiPerTipo[tipo].sort((a, b) => a.nome_ubicazione.localeCompare(b.nome_ubicazione)).forEach(materiale => {
            const statoClasse = materiale.quantita_attuale <= materiale.soglia_minima ? 'stato-critico' :
                               materiale.quantita_attuale <= (materiale.soglia_minima * 1.5) ? 'stato-basso' : 
                               'stato-ok';

            html += `
                <div class="material-item" data-id="${materiale.codice_materiale}">
                    <div class="material-info">
                        <div class="material-type">📍 ${materiale.nome_ubicazione}</div>
                        <div class="material-details">
                            <span class="material-code">${materiale.codice_materiale}</span>
                            <span class="material-quantity ${statoClasse}">
                                ${materiale.quantita_attuale} ${materiale.unita_misura}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    mainContent.innerHTML = html;

    // Aggiungi event listener per il pulsante indietro
    document.getElementById('backButton').addEventListener('click', () => {
        currentFilter = '';
        renderView();
    });

    // Aggiungi event listener per i click sui materiali
    document.querySelectorAll('.material-item').forEach(item => {
        item.addEventListener('click', () => {
            const materialId = item.dataset.id;
            handleMaterialClick(materialId);
        });
    });
}

function renderMaterialiTipo(mainContent, categoria, tipo) {
    // Filtra i materiali per il tipo selezionato
    const materialiTipo = materiali.filter(m => m.categoria === categoria && m.tipo === tipo);
    
    let html = `
        <div class="view-container">
            <div class="view-header">
                <div class="back-button" id="backButton">
                    <span class="back-arrow">◀</span>
                    <span>Torna ai tipi</span>
                </div>
                <div class="location-title">
                    <h2>🏷️ ${tipo}</h2>
                    <div class="view-stats">${materialiTipo.length} ubicazioni</div>
                </div>
            </div>
            <div class="category-section">
                <h3 class="category-header">${categoria}</h3>
                <div class="category-items">
    `;

    // Ordina per ubicazione
    materialiTipo.sort((a, b) => a.nome_ubicazione.localeCompare(b.nome_ubicazione)).forEach(materiale => {
        const statoClasse = materiale.quantita_attuale <= materiale.soglia_minima ? 'stato-critico' :
                           materiale.quantita_attuale <= (materiale.soglia_minima * 1.5) ? 'stato-basso' : 
                           'stato-ok';

        html += `
            <div class="material-item" data-id="${materiale.codice_materiale}">
                <div class="material-info">
                    <div class="material-type">📍 ${materiale.nome_ubicazione}</div>
                    <div class="material-details">
                        <span class="material-code">${materiale.codice_materiale}</span>
                        <span class="material-quantity ${statoClasse}">
                            ${materiale.quantita_attuale} ${materiale.unita_misura}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>
    `;

    mainContent.innerHTML = html;

    // Aggiungi event listener per il pulsante indietro
    document.getElementById('backButton').addEventListener('click', () => {
        currentFilter = '';
        renderView();
    });

    // Aggiungi event listener per i click sui materiali
    document.querySelectorAll('.material-item').forEach(item => {
        item.addEventListener('click', () => {
            const materialId = item.dataset.id;
            handleMaterialClick(materialId);
        });
    });
}

// Funzione per mostrare i materiali in una lista
function renderMaterialsList(materials, parentElement) {
    const list = document.createElement('div');
    list.className = 'materials-list';
    
    materials.forEach(material => {
        const card = document.createElement('div');
        card.className = 'material-card';
        if (material.quantita <= material.soglia_minima) {
            card.classList.add('low-stock');
        }
        
        card.innerHTML = `
            <div class="material-header">
                <h3>${material.nome}</h3>
                <span class="material-code">${material.codice}</span>
            </div>
            <div class="material-body">
                <div class="material-info">
                    <span class="info-label">Quantità:</span>
                    <span class="info-value">${material.quantita}</span>
                </div>
                <div class="material-info">
                    <span class="info-label">Min:</span>
                    <span class="info-value">${material.soglia_minima}</span>
                </div>
                ${currentView !== VIEWS.UBICAZIONE ? 
                    `<div class="material-info">
                        <span class="info-label">Ubicazione:</span>
                        <span class="info-value">${material.ubicazione}</span>
                    </div>` : ''}
                ${currentView !== VIEWS.CATEGORIA ? 
                    `<div class="material-info">
                        <span class="info-label">Categoria:</span>
                        <span class="info-value">${material.categoria}</span>
                    </div>` : ''}
                ${currentView !== VIEWS.TIPO ? 
                    `<div class="material-info">
                        <span class="info-label">Tipo:</span>
                        <span class="info-value">${material.tipo}</span>
                    </div>` : ''}
            </div>
        `;
        
        // Aggiunta dell'event listener per aprire il modal
        card.addEventListener('click', () => showMaterialModal(material));
        
        list.appendChild(card);
    });
    
    parentElement.appendChild(list);
}

// Modal handling
function showMaterialModal(material) {
    if (!material) {
        console.error('No material provided to showMaterialModal');
        return;
    }

    const modal = document.querySelector('.material-modal');
    if (!modal) {
        console.error('Modal element not found');
        return;
    }

    currentMaterialId = material.codice_materiale;
    const header = modal.querySelector('.material-modal-header h2');
    const details = modal.querySelector('.material-details-grid');

    // Set title and details
    header.textContent = material.tipo;
    details.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Codice:</span>
            <span class="detail-value">${material.codice_materiale}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Categoria:</span>
            <span class="detail-value">${material.categoria}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Tipo:</span>
            <span class="detail-value">${material.tipo}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Ubicazione:</span>
            <span class="detail-value">${material.nome_ubicazione}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Quantità:</span>
            <span class="detail-value">${material.quantita_attuale} ${material.unita_misura}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Soglia minima:</span>
            <span class="detail-value">${material.soglia_minima}</span>
        </div>
    `;    // Reset form fields
    const newQuantityInput = document.getElementById('nuovaQuantita');
    const usernameInput = document.getElementById('userName');
    if (newQuantityInput) newQuantityInput.value = '';
    if (usernameInput) usernameInput.value = '';

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal() {
    const modal = document.querySelector('.material-modal');
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
    currentMaterialId = null;
}

async function updateQuantity(event) {
    event.preventDefault();
    
    const newQuantity = document.getElementById('nuovaQuantita').value;
    const username = document.getElementById('userName').value;
    
    if (!newQuantity || !username) {
        alert('Per favore compila tutti i campi');
        return;
    }

    if (isNaN(newQuantity) || parseInt(newQuantity) < 0) {
        alert('La quantità deve essere un numero positivo');
        return;
    }

    // Ottieni il materiale corrente per l'ubicazione
    const material = materiali.find(m => m.codice_materiale === currentMaterialId);
    if (!material) {
        alert('Errore: materiale non trovato');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('action', 'updateGiacenza');
        formData.append('codice_materiale', currentMaterialId);
        formData.append('ubicazione', material.nome_ubicazione);
        formData.append('nuova_quantita', newQuantity);
        formData.append('userName', username);

        const response = await fetch('../php/api_materiali.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Errore nella risposta del server');
        }

        const result = await response.json();
        
        if (result.success) {
            alert('Quantità aggiornata con successo!');
            closeModal();
            loadData(); // Refresh the data
        } else {
            alert('Errore durante l\'aggiornamento: ' + (result.error || 'Errore sconosciuto'));
        }
    } catch (error) {
        console.error('Errore durante l\'aggiornamento:', error);
        alert('Si è verificato un errore durante l\'aggiornamento');
    }
}

// Event Listeners for modal
function initializeModalEvents() {
    const modal = document.querySelector('.material-modal');
    if (!modal) {
        console.error('Modal element not found');
        return;
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Close modal with close button
    const closeButton = modal.querySelector('.modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }    // Form submission
    const updateButton = modal.querySelector('#updateQuantita');    if (updateButton) {
        updateButton.addEventListener('click', updateQuantity);
    }
}

// Helper function per gestire il click sui materiali
function handleMaterialClick(materialId) {
    const material = materiali.find(m => m.codice_materiale === materialId);
    if (material) {
        showMaterialModal(material);
    }
}
