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
            showMaterialDetail(materialId);
        });
    });
}
