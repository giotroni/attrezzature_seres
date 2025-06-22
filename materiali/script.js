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

// Formatta un numero con 2 decimali e separatore corretto
function formatQuantity(value) {
    if (value === null || value === undefined) return '0.00';
    // Converte il valore in numero e arrotonda a 2 decimali
    const num = Number(parseFloat(value).toFixed(2));
    // Usa toLocaleString per formattare con separatore decimale corretto
    return num.toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

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
                                ${formatQuantity(materiale.quantita_attuale)} ${materiale.unita_misura}
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

    showLoadingOverlay('Caricamento totali per tipo...');

    // Usa la nuova API getTotaliPerTipo
    fetch(`${API_BASE_URL}?action=getTotaliPerTipo`)
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Errore nel caricamento dei totali per tipo');
            }

            // Per ogni tipo, conta in quante ubicazioni è presente
            const ubicazioniPerTipo = {};
            materiali.forEach(m => {
                if (!ubicazioniPerTipo[m.tipo]) {
                    ubicazioniPerTipo[m.tipo] = new Set();
                }
                ubicazioniPerTipo[m.tipo].add(m.nome_ubicazione);
            });

            let html = `
                <div class="view-container">
                    <div class="view-header">
                        <h2>🏷️ Tipi di Materiale</h2>
                        <div class="view-stats">
                            ${data.data.length} tipi totali
                        </div>
                    </div>
                    <div class="locations-grid">
            `;

            // Ordina i tipi alfabeticamente
            data.data.sort((a, b) => a.tipo.localeCompare(b.tipo)).forEach(tipo => {
                // Trova l'unità di misura dal primo materiale di questo tipo
                const primoMateriale = materiali.find(m => m.tipo === tipo.tipo);
                const unitaMisura = primoMateriale ? primoMateriale.unita_misura : '';
                const numUbicazioni = ubicazioniPerTipo[tipo.tipo] ? ubicazioniPerTipo[tipo.tipo].size : 0;
                const alertClass = parseFloat(tipo.quantita_totale) <= parseFloat(tipo.soglia_minima) ? 'location-alert' : '';
                
                html += `
                    <div class="location-card ${alertClass}" data-tipo="${tipo.tipo}">
                        <div class="location-content">
                            <div class="location-icon">🏷️</div>
                            <div class="location-info">
                                <h3>${tipo.tipo}</h3>
                                <div class="location-stats">
                                    <span class="material-total">${formatQuantity(tipo.quantita_totale)} ${unitaMisura}</span>
                                    <span class="location-count">(${numUbicazioni} ubicazioni)</span>
                                    ${parseFloat(tipo.quantita_totale) <= parseFloat(tipo.soglia_minima) ? 
                                        `<span class="material-alert">⚠️ Sotto scorta minima</span>` : 
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
            hideLoadingOverlay();

            // Aggiungi event listener per i click sui tipi
            document.querySelectorAll('.location-card').forEach(card => {
                card.addEventListener('click', () => {
                    const tipo = card.dataset.tipo;
                    currentFilter = tipo;
                    renderMaterialiTipo(tipo);
                });
            });
        })
        .catch(error => {
            console.error('Errore nel caricamento dei totali per tipo:', error);
            showError('⚠️ Errore nel caricamento dei totali per tipo');
            hideLoadingOverlay();
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
            materialiPerTipo[materiale.tipo] = {
                materiali: [],
                totale: 0,
                unita_misura: materiale.unita_misura
            };
        }
        materialiPerTipo[materiale.tipo].materiali.push(materiale);
        materialiPerTipo[materiale.tipo].totale += parseFloat(materiale.quantita_attuale);
    });

    // Ordina i tipi e renderizza i materiali
    Object.keys(materialiPerTipo).sort().forEach(tipo => {
        const tipoInfo = materialiPerTipo[tipo];
        html += `
            <div class="category-section">
                <h3 class="category-header">${tipo}: ${formatQuantity(tipoInfo.totale)} ${tipoInfo.unita_misura}</h3>
                <div class="category-items">
        `;

        tipoInfo.materiali.sort((a, b) => a.nome_ubicazione.localeCompare(b.nome_ubicazione)).forEach(materiale => {
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
                                ${formatQuantity(materiale.quantita_attuale)} ${materiale.unita_misura}
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

function renderMaterialiTipo(tipo) {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    
    // Filtra i materiali per il tipo selezionato
    const materialiTipo = materiali.filter(m => m.tipo === tipo);
    const totaleQuantita = materialiTipo.reduce((acc, m) => acc + parseFloat(m.quantita_attuale), 0);
    const unitaMisura = materialiTipo[0]?.unita_misura || '';
    
    let html = `
        <div class="view-container">
            <div class="view-header">
                <div class="back-button" id="backButton">
                    <span class="back-arrow">◀</span>
                    <span>Torna ai tipi</span>
                </div>
                <div class="location-title">
                    <h2>🏷️ ${tipo}</h2>
                    <div class="view-stats">
                        ${materialiTipo.length} ubicazioni
                    </div>
                </div>
            </div>
            <div class="tipo-header">
                ${tipo}: ${formatQuantity(totaleQuantita)} ${unitaMisura}
            </div>
            <div class="materials-list">
    `;

    // Ordina i materiali per ubicazione
    materialiTipo.sort((a, b) => a.nome_ubicazione.localeCompare(b.nome_ubicazione)).forEach(materiale => {
        const statoClasse = materiale.quantita_attuale <= materiale.soglia_minima ? 'stato-critico' :
                           materiale.quantita_attuale <= (materiale.soglia_minima * 1.5) ? 'stato-basso' : 
                           'stato-ok';

        html += `
            <div class="material-item" data-id="${materiale.codice_materiale}">
                <div class="material-info">
                    <div class="material-type">${materiale.nome_ubicazione}</div>
                    <div class="material-details">
                        <span class="material-code">${materiale.codice_materiale}</span>
                        <span class="material-quantity ${statoClasse}">
                            ${formatQuantity(materiale.quantita_attuale)} ${materiale.unita_misura}
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
                <h3>${material.nome}</h3>                <span class="material-code">${material.codice_materiale}</span>
            </div>
            <div class="material-body">
                <div class="material-info">
                    <span class="info-label">Quantità:</span>
                    <span class="info-value">${material.quantita}</span>
                </div>
                <div class="material-info">
                    <span class="info-label">Min:</span>
                    <span class="info-value">${formatQuantity(material.soglia_minima)} ${material.unita_misura}</span>
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
    console.log('showMaterialModal - Materiale ricevuto:', material);
    
    const modal = document.getElementById('materialModal');
    if (!modal) {
        console.error('showMaterialModal - Elemento modal non trovato');
        return;
    }

    // IMPORTANTE: Imposta currentMaterialId
    currentMaterialId = material.codice_materiale;
    console.log('showMaterialModal - currentMaterialId impostato:', currentMaterialId);

    const modalTitle = document.getElementById('materialModalTitle');
    const materialCodice = document.getElementById('materialCodice');
    const materialCategoria = document.getElementById('materialCategoria');
    const materialTipo = document.getElementById('materialTipo');
    const materialUbicazione = document.getElementById('materialUbicazione');
    const materialQuantita = document.getElementById('materialQuantita');

    // Verifica che tutti gli elementi necessari esistano
    if (!modalTitle || !materialCodice || !materialCategoria || !materialTipo || 
        !materialUbicazione || !materialQuantita) {
        console.error('showMaterialModal - Elementi della modal mancanti');
        return;
    }

    console.log(`Mostra modal per materiale: ${material.codice_materiale} (${material.nome_ubicazione})`);
    
    // Popola i dettagli del materiale
    materialCodice.textContent = material.codice_materiale;
    materialCategoria.textContent = material.categoria;
    materialTipo.textContent = material.tipo;
    materialUbicazione.textContent = material.nome_ubicazione;
    materialQuantita.textContent = `${formatQuantity(material.quantita_attuale)} ${material.unita_misura}`;
    
    modalTitle.textContent = `${material.tipo} (${material.codice_materiale})`;
    
    // Resetta e prepara il form di aggiornamento quantità
    const nuovaQuantitaInput = document.getElementById('nuovaQuantita');
    const userNameInput = document.getElementById('userName');
    
    // Reset del campo quantità e aggiunta placeholder
    nuovaQuantitaInput.value = '';
    nuovaQuantitaInput.placeholder = `Inserisci la nuova quantità (attuale: ${formatQuantity(material.quantita_attuale)})`;
    
    // Reset del campo nome utente
    userNameInput.value = '';
    
    // Gestione del click sul pulsante di aggiornamento
    const updateButton = document.getElementById('updateQuantita');
    if (updateButton) {
        updateButton.onclick = async function() {
            const nuovaQuantita = parseFloat(nuovaQuantitaInput.value);
            const userName = userNameInput.value.trim();

            if (isNaN(nuovaQuantita) || nuovaQuantita < 0) {
                showError('⚠️ La quantità deve essere un numero positivo');
                return;
            }
            
            if (userName.length < 4) {
                showError('⚠️ Inserisci un nome di almeno 4 caratteri');
                return;
            }

            try {
                showLoadingOverlay('Aggiornamento quantità in corso...');
                
                const formData = new FormData();
                formData.append('action', 'updateGiacenza');
                formData.append('codice_materiale', material.codice_materiale);
                formData.append('ubicazione', material.nome_ubicazione);
                formData.append('nuova_quantita', nuovaQuantita);
                formData.append('userName', userName);

                console.log('Invio aggiornamento giacenza:', Object.fromEntries(formData));
                
                const response = await fetch('../php/api_materiali.php', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                
                if (result.success) {
                    showSuccess('✅ Quantità aggiornata con successo');
                    
                    // Aggiorna lo storico
                    caricaStorico(material.codice_materiale, material.nome_ubicazione);
                    
                    // Reset form
                    nuovaQuantitaInput.value = '';
                    userNameInput.value = '';
                    
                    // Aggiorna i dati
                    loadData();
                } else {
                    showError(`⚠️ ${result.error || 'Errore durante l\'aggiornamento'}`);
                }
            } catch (error) {
                console.error('Errore durante l\'aggiornamento:', error);
                showError('⚠️ Errore durante l\'aggiornamento');
            } finally {
                hideLoadingOverlay();
            }
        };
    }

    // Carica lo storico dei movimenti
    console.log(`Caricamento storico per codice: ${material.codice_materiale}, ubicazione: ${material.nome_ubicazione}`);
    caricaStorico(material.codice_materiale, material.nome_ubicazione);

    // Mostra la modal
    modal.style.display = 'block';
    
    // Gestione chiusura modal
    const closeBtn = document.getElementById('materialModalClose');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            currentMaterialId = null; // Reset quando si chiude
        };
    }

    // Chiudi la modal se si clicca fuori
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            currentMaterialId = null; // Reset quando si chiude
        }
    };
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
    
    console.log('updateQuantity - Valori inseriti:', { newQuantity, username, currentMaterialId });
    
    if (!newQuantity || !username) {
        console.log('updateQuantity - Campi mancanti');
        alert('Per favore compila tutti i campi');
        return;
    }

    if (isNaN(newQuantity) || parseInt(newQuantity) < 0) {
        console.log('updateQuantity - Quantità non valida:', newQuantity);
        alert('La quantità deve essere un numero positivo');
        return;
    }

    // Ottieni il materiale corrente per l'ubicazione
    const material = materiali.find(m => m.codice_materiale === currentMaterialId);
    console.log('updateQuantity - Materiale trovato:', material);
    
    if (!material) {
        console.error('updateQuantity - Materiale non trovato per ID:', currentMaterialId);
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
        console.log('Invio dati aggiornamento:', {
            codice_materiale: currentMaterialId,
            ubicazione: material.nome_ubicazione,
            nuova_quantita: newQuantity,
            userName: username
        });
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
    console.log('handleMaterialClick - ID ricevuto:', materialId);
    const material = materiali.find(m => m.codice_materiale === materialId);
    console.log('handleMaterialClick - Materiale trovato:', material);
    if (material) {
        showMaterialModal(material);
    } else {
        console.error('handleMaterialClick - Materiale non trovato per ID:', materialId);
    }
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'Data non disponibile';
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return 'Data non disponibile';
    
    return date.toLocaleString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function caricaStorico(codice_materiale, ubicazione) {
    console.log('caricaStorico - Parametri:', { codice_materiale, ubicazione });
    
    const modalBody = document.querySelector('.material-modal-body');
    if (!modalBody) {
        console.error('caricaStorico - Modal body non trovato');
        return;
    }

    // Rimuovi la sezione storico esistente se presente
    const storicoEsistente = modalBody.querySelector('.storico-section');
    if (storicoEsistente) {
        storicoEsistente.remove();
    }

    // Crea la sezione dello storico
    const storicoSection = document.createElement('div');
    storicoSection.className = 'storico-section';
    storicoSection.innerHTML = `
        <h3>Storico Movimenti</h3>
        <div class="storico-content">
            <div class="loading-spinner">Caricamento storico...</div>
        </div>
    `;
    modalBody.appendChild(storicoSection);

    // Carica lo storico dall'API
    const url = `${API_BASE_URL}?action=getStorico&codice_materiale=${encodeURIComponent(codice_materiale)}&ubicazione=${encodeURIComponent(ubicazione)}`;
    console.log('caricaStorico - URL chiamata:', url);
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('caricaStorico - Risposta API:', data);

            if (!data.success) {
                throw new Error(data.error || 'Errore nel caricamento dello storico');
            }

            const storicoContent = storicoSection.querySelector('.storico-content');
            if (data.data && data.data.length > 0) {
                let html = '<table class="storico-table">';
                html += `
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Quantità</th>
                            <th>Operatore</th>
                            <th>Ubicazione</th>
                        </tr>
                    </thead>
                    <tbody>
                `;

                data.data.forEach(record => {
                    const dataFormattata = formatDateTime(record.timestamp);
                    const operatore = record.user_name || 'Non specificato';
                    const quantitaDiff = record.quantita_attuale - record.quantita_precedente;
                    const segno = quantitaDiff >= 0 ? '+' : '';
                    
                    html += `
                        <tr>
                            <td>${dataFormattata}</td>
                            <td class="${quantitaDiff >= 0 ? 'quantita-positiva' : 'quantita-negativa'}">
                                ${segno}${formatQuantity(quantitaDiff)}
                            </td>
                            <td>${operatore}</td>
                            <td>${record.ubicazione_destinazione || 'N/D'}</td>
                        </tr>
                    `;
                });

                html += '</tbody></table>';
                storicoContent.innerHTML = html;
            } else {
                storicoContent.innerHTML = '<p class="no-data">Nessun movimento registrato</p>';
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento dello storico:', error);
            const storicoContent = storicoSection.querySelector('.storico-content');
            storicoContent.innerHTML = '<p class="error-message">⚠️ Errore nel caricamento dello storico</p>';
        });
}
function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'success-message';
    successElement.textContent = message;
    
    successElement.style.cssText = `
        position: fixed; 
        top: 20px; 
        right: 20px; 
        background: #4CAF50; 
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
    
    document.body.appendChild(successElement);
    setTimeout(() => {
        if (successElement.parentNode) {
            successElement.remove();
        }
    }, 3000);
}