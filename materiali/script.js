// ============================================================================
// CONFIGURAZIONE E COSTANTI
// ============================================================================

const CONFIG = {
    API_BASE_URL: '../php/api_materiali.php',
    CACHE_VERSION: Date.now(), // Versione dinamica basata su timestamp
    VIEWS: {
        UBICAZIONE: 'ubicazione',
        CATEGORIA: 'categoria',
        TIPO: 'tipo'
    },
    VIEW_CONFIG: {
        ubicazione: {
            icon: '📍',
            title: 'Vista per Ubicazione',
            description: 'Visualizza i materiali raggruppati per ubicazione fisica'
        },
        categoria: {
            icon: '📂',
            title: 'Vista per Categoria',
            description: 'Visualizza i materiali raggruppati per categoria'
        },
        tipo: {
            icon: '🏷️',
            title: 'Vista per Tipo',
            description: 'Visualizza i materiali raggruppati per tipo'
        }
    }
};

// ============================================================================
// STATO GLOBALE DELL'APPLICAZIONE
// ============================================================================

class AppState {
    constructor() {
        this.currentView = CONFIG.VIEWS.UBICAZIONE;
        this.currentFilter = '';
        this.currentMaterialId = null;
        this.data = {
            materiali: [],
            anagraficaMateriali: [],
            locationsData: []
        };
    }

    setCurrentView(view) {
        this.currentView = view;
        this.currentFilter = '';
    }

    setCurrentFilter(filter) {
        this.currentFilter = filter;
    }

    setCurrentMaterialId(id) {
        this.currentMaterialId = id;
    }

    updateData(key, value) {
        this.data[key] = value;
    }

    getData(key) {
        return this.data[key];
    }
}

// Istanza globale dello stato
const appState = new AppState();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const Utils = {
    formatQuantity(value) {
        if (value === null || value === undefined) return '0.00';
        const num = Number(parseFloat(value).toFixed(2));
        return num.toLocaleString('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },

    formatDateTime(dateTimeStr) {
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
    },

    validateUserName(userName, fieldName = "Nome utente") {
        if (!userName || userName.trim().length === 0) {
            return { valid: false, message: `${fieldName} è obbligatorio` };
        }
        
        const cleanUserName = userName.trim();
        
        if (cleanUserName.length < 4) {
            return { valid: false, message: `${fieldName} deve contenere almeno 4 caratteri` };
        }
        
        return { valid: true, formatted: cleanUserName.toUpperCase() };
    },

    validateQuantity(quantity) {
        if (!quantity || isNaN(quantity) || parseFloat(quantity) < 0) {
            return { valid: false, message: 'La quantità deve essere un numero positivo' };
        }
        return { valid: true, value: parseFloat(quantity) };
    },

    getStatusClass(quantitaAttuale, sogliaMinima) {
        if (quantitaAttuale <= sogliaMinima) return 'stato-critico';
        if (quantitaAttuale <= (sogliaMinima * 1.5)) return 'stato-basso';
        return 'stato-ok';
    }
};

// ============================================================================
// UI HELPERS
// ============================================================================

const UI = {
    showLoadingOverlay(message = 'Caricamento in corso...') {
        const overlay = document.getElementById('loadingOverlay');
        const messageElement = document.getElementById('loadingMessage');
        if (messageElement) messageElement.textContent = message;
        if (overlay) overlay.style.display = 'flex';
    },

    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    },

    showMessage(message, type = 'error') {
        const element = document.createElement('div');
        element.className = `${type}-message`;
        element.textContent = message;
        
        const backgroundColor = {
            'error': '#f44336',
            'success': '#4CAF50',
            'warning': '#FF9800'
        }[type] || '#f44336';
        
        element.style.cssText = `
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
        
        document.body.appendChild(element);
        setTimeout(() => {
            if (element.parentNode) element.remove();
        }, type === 'success' ? 3000 : 5000);
    },

    showError(message) {
        this.showMessage(message, 'error');
    },

    showSuccess(message) {
        this.showMessage(message, 'success');
    },

    showWarning(message) {
        this.showMessage(message, 'warning');
    }
};

// ============================================================================
// API SERVICE
// ============================================================================

class ApiService {
    async request(action, data = null) {
        try {
            const url = `${CONFIG.API_BASE_URL}?action=${action}`;
            const options = {
                method: data ? 'POST' : 'GET'
            };

            if (data) {
                const formData = new FormData();
                Object.entries(data).forEach(([key, value]) => {
                    formData.append(key, value);
                });
                options.body = formData;
            }

            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Errore sconosciuto');
            }

            return result.data;
        } catch (error) {
            console.error(`API Error [${action}]:`, error);
            throw error;
        }
    }

    async getUbicazioni() {
        return this.request('getUbicazioni');
    }

    async getGiacenze() {
        return this.request('getGiacenze');
    }

    async getMateriali() {
        return this.request('getMateriali');
    }

    async getTotaliPerTipo() {
        return this.request('getTotaliPerTipo');
    }

    async getStorico(codiceMateriale, ubicazione) {
        return this.request(`getStorico&codice_materiale=${encodeURIComponent(codiceMateriale)}&ubicazione=${encodeURIComponent(ubicazione)}`);
    }

    async updateGiacenza(codiceMateriale, ubicazione, nuovaQuantita, userName) {
        return this.request('updateGiacenza', {
            codice_materiale: codiceMateriale,
            ubicazione: ubicazione,
            nuova_quantita: nuovaQuantita,
            userName: userName
        });
    }

    async addMateriale(categoria, tipo, unitaMisura, userName, sogliaMinima = 0, note = '') {
        return this.request('addMateriale', {
            categoria: categoria,
            tipo: tipo,
            unita_misura: unitaMisura,
            userName: userName,
            soglia_minima: sogliaMinima,
            note: note
        });
    }

    async spostaMateriale(codiceMateriale, ubicazioneOrigin, ubicazioneDestination, quantitaDaSpostare, userName) {
        return this.request('spostaMateriale', {
            codice_materiale: codiceMateriale,
            ubicazione_origine: ubicazioneOrigin,
            ubicazione_destinazione: ubicazioneDestination,
            quantita_da_spostare: quantitaDaSpostare,
            userName: userName
        });
    }
}

const apiService = new ApiService();

// ============================================================================
// DATA MANAGER
// ============================================================================

class DataManager {
    async loadAllData() {
        try {
            UI.showLoadingOverlay('Caricamento dati in corso...');
            
            // Carica ubicazioni
            const ubicazioni = await apiService.getUbicazioni();
            appState.updateData('locationsData', ubicazioni.map(u => u.nome_ubicazione));
            
            // Carica giacenze
            const giacenze = await apiService.getGiacenze();
            appState.updateData('materiali', giacenze);
            
            // Carica anagrafica se non già caricata
            if (appState.getData('anagraficaMateriali').length === 0) {
                const materiali = await apiService.getMateriali();
                appState.updateData('anagraficaMateriali', materiali);
            }
            
            UI.hideLoadingOverlay();
            return true;
        } catch (error) {
            console.error('Errore nel caricamento dei dati:', error);
            UI.showError('⚠️ Errore nel caricamento dei dati');
            UI.hideLoadingOverlay();
            return false;
        }
    }

    groupByLocation() {
        const materiali = appState.getData('materiali');
        const grouped = {};
        
        materiali.forEach(item => {
            if (!grouped[item.nome_ubicazione]) {
                grouped[item.nome_ubicazione] = {
                    count: 0,
                    materialiCritici: 0,
                    items: []
                };
            }
            grouped[item.nome_ubicazione].count++;
            grouped[item.nome_ubicazione].items.push(item);
            if (item.quantita_attuale <= item.soglia_minima) {
                grouped[item.nome_ubicazione].materialiCritici++;
            }
        });
        
        return grouped;
    }

    groupByCategory() {
        const materiali = appState.getData('materiali');
        const grouped = {};
        
        materiali.forEach(item => {
            if (!grouped[item.categoria]) {
                grouped[item.categoria] = {
                    count: 0,
                    materialiCritici: 0,
                    tipi: new Set(),
                    items: []
                };
            }
            grouped[item.categoria].count++;
            grouped[item.categoria].items.push(item);
            grouped[item.categoria].tipi.add(item.tipo);
            if (item.quantita_attuale <= item.soglia_minima) {
                grouped[item.categoria].materialiCritici++;
            }
        });
        
        return grouped;
    }

    async getTotaliPerTipo() {
        return apiService.getTotaliPerTipo();
    }

    findMaterial(materialId, ubicazione = null) {
        const materiali = appState.getData('materiali');
        
        if (ubicazione) {
            return materiali.find(m => 
                m.codice_materiale === materialId && 
                m.nome_ubicazione === ubicazione
            );
        }
        
        // Se non è specificata l'ubicazione, usa il filtro corrente se disponibile
        if (appState.currentView === CONFIG.VIEWS.UBICAZIONE && appState.currentFilter) {
            return materiali.find(m => 
                m.codice_materiale === materialId && 
                m.nome_ubicazione === appState.currentFilter
            );
        }
        
        return materiali.find(m => m.codice_materiale === materialId);
    }
}

const dataManager = new DataManager();

// ============================================================================
// VIEW RENDERER
// ============================================================================

class ViewRenderer {
    render() {
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) return;

        if (appState.currentFilter) {
            this.renderDetailView(mainContent);
        } else if (appState.currentView) {
            this.renderListView(mainContent);
        } else {
            this.renderMainMenu(mainContent);
        }
    }

    renderMainMenu(container) {
        let html = `
            <div class="view-container">
                <div class="view-header">
                    <h2>📦 Gestione Materiali</h2>
                    <div class="view-stats">
                        ${appState.getData('materiali').length} materiali totali
                    </div>
                </div>
                <div class="view-selection">
        `;

        Object.entries(CONFIG.VIEW_CONFIG).forEach(([viewKey, config]) => {
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

        html += `</div></div>`;
        container.innerHTML = html;

        // Event listeners
        container.querySelectorAll('.view-button').forEach(button => {
            button.addEventListener('click', () => {
                appState.setCurrentView(button.dataset.view);
                this.render();
            });
        });
    }

    renderListView(container) {
        switch(appState.currentView) {
            case CONFIG.VIEWS.UBICAZIONE:
                this.renderLocationsList(container);
                break;
            case CONFIG.VIEWS.CATEGORIA:
                this.renderCategoriesList(container);
                break;
            case CONFIG.VIEWS.TIPO:
                this.renderTipiList(container);
                break;
        }
    }

    renderLocationsList(container) {
        const grouped = dataManager.groupByLocation();
        
        let html = `
            <div class="view-container">
                <div class="view-header">
                    <h2>📍 Ubicazioni</h2>
                    <div class="view-stats">
                        ${Object.keys(grouped).length} ubicazioni totali
                    </div>
                </div>
                <div class="locations-grid">
        `;

        Object.keys(grouped).sort().forEach(ubicazione => {
            const stats = grouped[ubicazione];
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

        html += `</div></div>`;
        container.innerHTML = html;

        // Event listeners
        container.querySelectorAll('.location-card').forEach(card => {
            card.addEventListener('click', () => {
                appState.setCurrentFilter(card.dataset.location);
                this.render();
            });
        });
    }

    renderCategoriesList(container) {
        const grouped = dataManager.groupByCategory();
        
        let html = `
            <div class="view-container">
                <div class="view-header">
                    <h2>📂 Categorie</h2>
                    <div class="view-stats">
                        ${Object.keys(grouped).length} categorie totali
                    </div>
                </div>
                <div class="locations-grid">
        `;

        Object.keys(grouped).sort().forEach(categoria => {
            const stats = grouped[categoria];
            const alertClass = stats.materialiCritici > 0 ? 'location-alert' : '';
            
            html += `
                <div class="location-card ${alertClass}" data-category="${categoria}">
                    <div class="location-content">
                        <div class="location-icon">📂</div>
                        <div class="location-info">
                            <h3>${categoria}</h3>
                            <div class="location-stats">
                                <span class="material-total">${stats.tipi.size} tipi (${stats.count} giacenze)</span>
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

        html += `</div></div>`;
        container.innerHTML = html;

        // Event listeners
        container.querySelectorAll('.location-card').forEach(card => {
            card.addEventListener('click', () => {
                appState.setCurrentFilter(card.dataset.category);
                this.render();
            });
        });
    }

    async renderTipiList(container) {
        try {
            UI.showLoadingOverlay('Caricamento totali per tipo...');
            const totali = await dataManager.getTotaliPerTipo();
            
            // Calcola ubicazioni per tipo
            const ubicazioniPerTipo = {};
            appState.getData('materiali').forEach(m => {
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
                            ${totali.length} tipi totali
                        </div>
                    </div>
                    <div class="locations-grid">
            `;

            totali.sort((a, b) => a.tipo.localeCompare(b.tipo)).forEach(tipo => {
                const primoMateriale = appState.getData('materiali').find(m => m.tipo === tipo.tipo);
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
                                    <span class="material-total">${Utils.formatQuantity(tipo.quantita_totale)} ${unitaMisura}</span>
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

            html += `</div></div>`;
            container.innerHTML = html;
            UI.hideLoadingOverlay();

            // Event listeners
            container.querySelectorAll('.location-card').forEach(card => {
                card.addEventListener('click', () => {
                    appState.setCurrentFilter(card.dataset.tipo);
                    this.render();
                });
            });

        } catch (error) {
            console.error('Errore nel rendering dei tipi:', error);
            UI.showError('⚠️ Errore nel caricamento dei totali per tipo');
            UI.hideLoadingOverlay();
        }
    }

    renderDetailView(container) {
        switch(appState.currentView) {
            case CONFIG.VIEWS.UBICAZIONE:
                this.renderMaterialiUbicazione(container);
                break;
            case CONFIG.VIEWS.CATEGORIA:
                this.renderMaterialiCategoria(container);
                break;
            case CONFIG.VIEWS.TIPO:
                this.renderMaterialiTipo(container);
                break;
        }
    }

    renderMaterialiUbicazione(container) {
        const materialiUbicazione = appState.getData('materiali')
            .filter(m => m.nome_ubicazione === appState.currentFilter);
        
        this.renderMaterialsWithGrouping(
            container,
            materialiUbicazione,
            '📍',
            appState.currentFilter,
            'Torna alle ubicazioni',
            (materiale) => materiale.categoria,
            (materiale) => materiale.nome_ubicazione
        );
    }

    renderMaterialiCategoria(container) {
        const materialiCategoria = appState.getData('materiali')
            .filter(m => m.categoria === appState.currentFilter);
        
        this.renderMaterialsWithGrouping(
            container,
            materialiCategoria,
            '📂',
            appState.currentFilter,
            'Torna alle categorie',
            (materiale) => materiale.tipo,
            (materiale) => materiale.nome_ubicazione,
            true // Group by type with totals
        );
    }

    renderMaterialiTipo(container) {
        const materialiTipo = appState.getData('materiali')
            .filter(m => m.tipo === appState.currentFilter);
        
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
                        <h2>🏷️ ${appState.currentFilter}</h2>
                        <div class="view-stats">${materialiTipo.length} ubicazioni</div>
                    </div>
                </div>
                <div class="tipo-header">
                    ${appState.currentFilter}: ${Utils.formatQuantity(totaleQuantita)} ${unitaMisura}
                </div>
                <div class="materials-list">
        `;

        materialiTipo.sort((a, b) => a.nome_ubicazione.localeCompare(b.nome_ubicazione))
            .forEach(materiale => {
                const statoClasse = Utils.getStatusClass(materiale.quantita_attuale, materiale.soglia_minima);
                html += this.renderMaterialItem(materiale, materiale.nome_ubicazione, statoClasse);
            });

        html += `</div></div>`;
        container.innerHTML = html;
        this.attachMaterialEvents();
    }

    renderMaterialsWithGrouping(container, materiali, icon, title, backText, groupByFn, displayKeyFn, showTotals = false) {
        let html = `
            <div class="view-container">
                <div class="view-header">
                    <div class="back-button" id="backButton">
                        <span class="back-arrow">◀</span>
                        <span>${backText}</span>
                    </div>
                    <div class="location-title">
                        <h2>${icon} ${title}</h2>
                        <div class="view-stats">${materiali.length} materiali presenti</div>
                    </div>
                </div>
                <div class="materials-list">
        `;

        // Group materials
        const grouped = {};
        materiali.forEach(materiale => {
            const key = groupByFn(materiale);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(materiale);
        });

        // Render groups
        Object.keys(grouped).sort().forEach(groupKey => {
            const groupMaterials = grouped[groupKey];
            let headerText = groupKey;
            
            if (showTotals) {
                const totale = groupMaterials.reduce((acc, m) => acc + parseFloat(m.quantita_attuale), 0);
                const unita = groupMaterials[0].unita_misura;
                // Calcola il numero di ubicazioni distinte
                const ubicazioni = new Set(groupMaterials.map(m => m.nome_ubicazione));
                headerText += ` (${Utils.formatQuantity(totale)} ${unita}, ${ubicazioni.size} ubicazioni)`;
            }

            html += `
                <div class="category-section">
                    <h3 class="category-header" data-group="${groupKey}">
                        <span class="category-toggle">▶</span>
                        ${headerText}
                    </h3>
                    <div class="category-items" style="display: none;">
            `;

            groupMaterials.sort((a, b) => displayKeyFn(a).localeCompare(displayKeyFn(b)))
                .forEach(materiale => {
                    const statoClasse = Utils.getStatusClass(materiale.quantita_attuale, materiale.soglia_minima);
                    html += this.renderMaterialItem(materiale, displayKeyFn(materiale), statoClasse);
                });

            html += `</div></div>`;
        });

        html += `</div></div>`;
        container.innerHTML = html;
        this.attachMaterialEvents();
    }

    renderMaterialItem(materiale, displayText, statoClasse) {
        return `
            <div class="material-item" 
                data-id="${materiale.codice_materiale}"
                data-ubicazione="${materiale.nome_ubicazione}">
                <div class="material-info">
                    <div class="material-type">${displayText}</div>
                    <div class="material-details">
                        <span class="material-code">${materiale.tipo}</span>
                        <span class="material-quantity ${statoClasse}">
                            ${Utils.formatQuantity(materiale.quantita_attuale)} ${materiale.unita_misura}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    attachMaterialEvents() {
        // Back button
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', () => {
                appState.setCurrentFilter('');
                this.render();
            });
        }

        // Material items
        document.querySelectorAll('.material-item').forEach(item => {
            item.addEventListener('click', () => {
                const materialId = item.dataset.id;
                const ubicazione = item.dataset.ubicazione;
                materialModal.show(materialId, ubicazione);
            });
        });

        // Category toggles
        document.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', () => {
                const categorySection = header.closest('.category-section');
                const categoryItems = categorySection.querySelector('.category-items');
                const toggle = header.querySelector('.category-toggle');
                
                if (categoryItems.style.display === 'none') {
                    categoryItems.style.display = 'block';
                    toggle.textContent = '▼';
                } else {
                    categoryItems.style.display = 'none';
                    toggle.textContent = '▶';
                }
            });
        });
    }
}

const viewRenderer = new ViewRenderer();

// ============================================================================
// MODAL MANAGER
// ============================================================================

class MaterialModal {
    constructor() {
        this.modal = document.getElementById('materialModal');
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.modal) return;

        // Close button
        const closeBtn = document.getElementById('materialModalClose');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }

        // Click outside to close
        this.modal.onclick = (event) => {
            if (event.target === this.modal) {
                this.hide();
            }
        };

        // Update button
        const updateButton = document.getElementById('updateQuantita');
        if (updateButton) {
            updateButton.onclick = () => this.updateQuantity();
        }

        // Sposta materiale button
        const spostaMaterialeButton = document.getElementById('spostaMateriale');
        if (spostaMaterialeButton) {
            spostaMaterialeButton.onclick = () => this.spostaMateriale();
        }
    }

    show(materialId, ubicazione = null) {
        const materiale = dataManager.findMaterial(materialId, ubicazione);
        if (!materiale) {
            UI.showError('⚠️ Materiale non trovato');
            return;
        }

        appState.setCurrentMaterialId(materialId);
        this.populateModal(materiale);
        this.populateUbicazioniDestinazione(materiale);
        this.loadStorico(materiale.codice_materiale, materiale.nome_ubicazione);
        this.modal.style.display = 'block';
    }

    hide() {
        this.modal.style.display = 'none';
        appState.setCurrentMaterialId(null);
        this.resetForm();
    }

    populateModal(materiale) {
        const elements = {
            materialModalTitle: `${materiale.tipo} (${materiale.codice_materiale})`,
            materialCodice: materiale.codice_materiale,
            materialCategoria: materiale.categoria,
            materialTipo: materiale.tipo,
            materialUbicazione: materiale.nome_ubicazione,
            materialQuantita: `${Utils.formatQuantity(materiale.quantita_attuale)} ${materiale.unita_misura}`
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Update placeholder for quantity update
        const quantityInput = document.getElementById('nuovaQuantita');
        if (quantityInput) {
            quantityInput.placeholder = `Inserisci la nuova quantità (attuale: ${Utils.formatQuantity(materiale.quantita_attuale)})`;
        }

        // Update placeholder and max for quantity to move
        const quantitaDaSpostareInput = document.getElementById('quantitaDaSpostare');
        if (quantitaDaSpostareInput) {
            quantitaDaSpostareInput.placeholder = `Max: ${Utils.formatQuantity(materiale.quantita_attuale)} ${materiale.unita_misura}`;
            quantitaDaSpostareInput.max = materiale.quantita_attuale;
        }
    }

    resetForm() {
        const nuovaQuantitaInput = document.getElementById('nuovaQuantita');
        const userNameInput = document.getElementById('userName');
        const quantitaDaSpostareInput = document.getElementById('quantitaDaSpostare');
        const ubicazioneDestinazioneSelect = document.getElementById('ubicazioneDestinazione');
        const userNameSpostaInput = document.getElementById('userNameSposta');
        
        if (nuovaQuantitaInput) nuovaQuantitaInput.value = '';
        if (userNameInput) userNameInput.value = '';
        if (quantitaDaSpostareInput) quantitaDaSpostareInput.value = '';
        if (ubicazioneDestinazioneSelect) ubicazioneDestinazioneSelect.value = '';
        if (userNameSpostaInput) userNameSpostaInput.value = '';
    }

    async updateQuantity() {
        const nuovaQuantita = document.getElementById('nuovaQuantita').value;
        const userName = document.getElementById('userName').value.trim();

        // Validation
        const quantityValidation = Utils.validateQuantity(nuovaQuantita);
        if (!quantityValidation.valid) {
            UI.showError(`⚠️ ${quantityValidation.message}`);
            return;
        }

        const userValidation = Utils.validateUserName(userName);
        if (!userValidation.valid) {
            UI.showError(`⚠️ ${userValidation.message}`);
            return;
        }

        const materiale = dataManager.findMaterial(appState.currentMaterialId);
        if (!materiale) {
            UI.showError('⚠️ Materiale non trovato');
            return;
        }

        try {
            UI.showLoadingOverlay('Aggiornamento quantità in corso...');
            
            await apiService.updateGiacenza(
                appState.currentMaterialId,
                materiale.nome_ubicazione,
                quantityValidation.value,
                userValidation.formatted
            );

            UI.showSuccess('✅ Quantità aggiornata con successo');
            this.loadStorico(materiale.codice_materiale, materiale.nome_ubicazione);
            this.resetForm();
            await dataManager.loadAllData();
            viewRenderer.render();

        } catch (error) {
            console.error('Errore durante l\'aggiornamento:', error);
            UI.showError(`⚠️ ${error.message || 'Errore durante l\'aggiornamento'}`);
        } finally {
            UI.hideLoadingOverlay();
        }
    }

    async loadStorico(codiceMateriale, ubicazione) {
        const storicoContent = document.querySelector('.storico-content');
        if (!storicoContent) return;

        storicoContent.innerHTML = '<div class="loading-spinner">Caricamento storico...</div>';

        try {
            const storico = await apiService.getStorico(codiceMateriale, ubicazione);
            
            if (storico && storico.length > 0) {
                let html = `
                    <table class="storico-table">
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

                storico.forEach(record => {
                    const dataFormattata = Utils.formatDateTime(record.timestamp);
                    const operatore = record.user_name || 'Non specificato';
                    const quantitaDiff = record.quantita_attuale - record.quantita_precedente;
                    const segno = quantitaDiff >= 0 ? '+' : '';
                    
                    html += `
                        <tr>
                            <td>${dataFormattata}</td>
                            <td class="${quantitaDiff >= 0 ? 'quantita-positiva' : 'quantita-negativa'}">
                                ${segno}${Utils.formatQuantity(quantitaDiff)}
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
        } catch (error) {
            console.error('Errore nel caricamento dello storico:', error);
            storicoContent.innerHTML = '<p class="error-message">⚠️ Errore nel caricamento dello storico</p>';
        }
    }

    async populateUbicazioniDestinazione(materiale) {
        const ubicazioneDestinazioneSelect = document.getElementById('ubicazioneDestinazione');
        if (!ubicazioneDestinazioneSelect) return;

        try {
            // Carica tutte le ubicazioni disponibili
            const response = await fetch(`${CONFIG.API_BASE_URL}?action=getLocations&_t=${CONFIG.CACHE_VERSION}`, { cache: 'no-store' });
            const result = await response.json();
            
            if (result.success) {
                const ubicazioni = result.data.map(u => u.nome_ubicazione)
                    .filter(ub => ub !== materiale.nome_ubicazione) // Escludi l'ubicazione corrente
                    .sort();
                
                ubicazioneDestinazioneSelect.innerHTML = '<option value="">Seleziona ubicazione...</option>';
                ubicazioni.forEach(ubicazione => {
                    const option = document.createElement('option');
                    option.value = ubicazione;
                    option.textContent = ubicazione;
                    ubicazioneDestinazioneSelect.appendChild(option);
                });
            } else {
                throw new Error('Errore nel caricamento ubicazioni');
            }
        } catch (error) {
            console.error('Errore nel caricamento delle ubicazioni:', error);
            // Fallback: usa le ubicazioni dai materiali esistenti
            const ubicazioni = [...new Set(appState.getData('materiali').map(m => m.nome_ubicazione))]
                .filter(ub => ub !== materiale.nome_ubicazione)
                .sort();
            
            ubicazioneDestinazioneSelect.innerHTML = '<option value="">Seleziona ubicazione...</option>';
            ubicazioni.forEach(ubicazione => {
                const option = document.createElement('option');
                option.value = ubicazione;
                option.textContent = ubicazione;
                ubicazioneDestinazioneSelect.appendChild(option);
            });
        }
    }

    async spostaMateriale() {
        const quantitaDaSpostare = document.getElementById('quantitaDaSpostare').value;
        const ubicazioneDestinazione = document.getElementById('ubicazioneDestinazione').value;
        const userName = document.getElementById('userNameSposta').value.trim();

        // Validazione
        const quantityValidation = Utils.validateQuantity(quantitaDaSpostare);
        if (!quantityValidation.valid) {
            UI.showError(`⚠️ ${quantityValidation.message}`);
            return;
        }

        if (!ubicazioneDestinazione) {
            UI.showError('⚠️ Seleziona l\'ubicazione di destinazione');
            return;
        }

        const userValidation = Utils.validateUserName(userName);
        if (!userValidation.valid) {
            UI.showError(`⚠️ ${userValidation.message}`);
            return;
        }

        const materiale = dataManager.findMaterial(appState.currentMaterialId);
        if (!materiale) {
            UI.showError('⚠️ Materiale non trovato');
            return;
        }

        // Verifica che la quantità da spostare non superi quella disponibile
        if (quantityValidation.value > materiale.quantita_attuale) {
            UI.showError(`⚠️ Quantità insufficiente. Disponibile: ${Utils.formatQuantity(materiale.quantita_attuale)} ${materiale.unita_misura}`);
            return;
        }

        try {
            UI.showLoadingOverlay('Spostamento materiale in corso...');
            
            await apiService.spostaMateriale(
                appState.currentMaterialId,
                materiale.nome_ubicazione,
                ubicazioneDestinazione,
                quantityValidation.value,
                userValidation.formatted
            );

            UI.showSuccess(`✅ Materiale spostato con successo: ${Utils.formatQuantity(quantityValidation.value)} ${materiale.unita_misura} da ${materiale.nome_ubicazione} a ${ubicazioneDestinazione}`);
            
            // Reset form campi spostamento
            document.getElementById('quantitaDaSpostare').value = '';
            document.getElementById('ubicazioneDestinazione').value = '';
            document.getElementById('userNameSposta').value = '';
            
            // Ricarica dati e aggiorna vista
            await dataManager.loadAllData();
            viewRenderer.render();
            
            // Ricarica lo storico per mostrare il nuovo movimento
            this.loadStorico(materiale.codice_materiale, materiale.nome_ubicazione);
            
            // Aggiorna il modal con i nuovi dati se il materiale esiste ancora
            const materialeAggiornato = dataManager.findMaterial(appState.currentMaterialId, materiale.nome_ubicazione);
            if (materialeAggiornato) {
                this.populateModal(materialeAggiornato);
                this.populateUbicazioniDestinazione(materialeAggiornato);
            } else {
                // Se il materiale non esiste più in questa ubicazione, chiudi il modal
                this.hide();
            }

        } catch (error) {
            console.error('Errore durante lo spostamento:', error);
            UI.showError(`⚠️ ${error.message || 'Errore durante lo spostamento del materiale'}`);
        } finally {
            UI.hideLoadingOverlay();
        }
    }
}

const materialModal = new MaterialModal();

// ============================================================================
// ASSOCIATION MODAL MANAGER
// ============================================================================

class AssociationModal {
    constructor() {
        this.modal = document.getElementById('associaMaterialeModal');
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.modal) return;

        // Close button
        const closeBtn = document.getElementById('associaMaterialeClose');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }

        // Click outside to close
        this.modal.onclick = (event) => {
            if (event.target === this.modal) {
                this.hide();
            }
        };

        // Save button
        const saveButton = document.getElementById('btnSalvaAssociazione');
        if (saveButton) {
            saveButton.onclick = () => this.saveAssociation();
        }

        // Category change
        const selectCategoria = document.getElementById('selectCategoria');
        if (selectCategoria) {
            selectCategoria.addEventListener('change', (e) => this.handleCategoriaChange(e));
        }

        // Type change
        const selectTipo = document.getElementById('selectTipo');
        if (selectTipo) {
            selectTipo.addEventListener('change', (e) => this.handleTipoChange(e));
        }
    }

    async show() {
        this.resetForm();
        await this.populateSelects();
        this.modal.style.display = 'block';
    }

    hide() {
        this.modal.style.display = 'none';
    }

    resetForm() {
        const elements = [
            'selectCategoria', 'selectTipo', 'selectUbicazione', 
            'nuovaQuantitaAssociazione', 'userNameAssociazione'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
                if (id === 'selectTipo') element.disabled = true;
            }
        });
    }

    async populateSelects() {
        try {
            UI.showLoadingOverlay('Caricamento materiali...');
            
            // Load anagrafica if not already loaded
            if (appState.getData('anagraficaMateriali').length === 0) {
                const materiali = await apiService.getMateriali();
                appState.updateData('anagraficaMateriali', materiali);
            }

            this.populateCategories();
            this.populateLocations();
            
        } catch (error) {
            console.error('Errore durante il caricamento:', error);
            UI.showError('⚠️ Errore nel caricamento delle opzioni');
        } finally {
            UI.hideLoadingOverlay();
        }
    }

    populateCategories() {
        const selectCategoria = document.getElementById('selectCategoria');
        if (!selectCategoria) return;

        const categorie = [...new Set(appState.getData('anagraficaMateriali').map(m => m.categoria))].sort();
        
        selectCategoria.innerHTML = '<option value="">SELEZIONA UNA CATEGORIA...</option>';
        categorie.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            selectCategoria.appendChild(option);
        });
    }

    async populateLocations() {
        const selectUbicazione = document.getElementById('selectUbicazione');
        if (!selectUbicazione) return;

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}?action=getLocations`);
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Errore nel recupero delle ubicazioni');
            }

            const ubicazioni = result.data.map(u => u.nome_ubicazione).sort();
            
            selectUbicazione.innerHTML = '<option value="">Seleziona un\'ubicazione...</option>';
            ubicazioni.forEach(ubicazione => {
                const option = document.createElement('option');
                option.value = ubicazione;
                option.textContent = ubicazione;
                selectUbicazione.appendChild(option);
            });
        } catch (error) {
            console.error('Errore nel caricamento delle ubicazioni:', error);
            UI.showError('⚠️ Errore nel caricamento delle ubicazioni');
            
            // Fallback: carica le ubicazioni dai materiali esistenti
            const ubicazioniFallback = [...new Set(appState.getData('materiali').map(m => m.nome_ubicazione))].sort();
            selectUbicazione.innerHTML = '<option value="">Seleziona un\'ubicazione...</option>';
            ubicazioniFallback.forEach(ubicazione => {
                const option = document.createElement('option');
                option.value = ubicazione;
                option.textContent = ubicazione;
                selectUbicazione.appendChild(option);
            });
        }
    }

    handleCategoriaChange(event) {
        const categoria = event.target.value;
        const selectTipo = document.getElementById('selectTipo');
        const selectUbicazione = document.getElementById('selectUbicazione');
        
        if (!selectTipo || !selectUbicazione) return;

        selectTipo.disabled = !categoria;
        selectTipo.innerHTML = '<option value="">SELEZIONA UN TIPO...</option>';
        selectUbicazione.innerHTML = '<option value="">Seleziona un\'ubicazione...</option>';
        selectUbicazione.disabled = false;
        
        if (categoria) {
            const tipi = [...new Set(
                appState.getData('anagraficaMateriali')
                    .filter(m => m.categoria === categoria)
                    .map(m => m.tipo)
            )].sort();
            
            tipi.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo;
                option.textContent = tipo;
                selectTipo.appendChild(option);
            });
        }
    }

    async handleTipoChange(event) {
        const tipo = event.target.value;
        const categoria = document.getElementById('selectCategoria').value;
        const selectUbicazione = document.getElementById('selectUbicazione');
        
        if (!selectUbicazione || !categoria) return;

        const materiale = appState.getData('anagraficaMateriali')
            .find(m => m.categoria === categoria && m.tipo === tipo);
        
        if (!materiale) {
            UI.showError('⚠️ Combinazione tipo/categoria non trovata');
            return;
        }

        // Show loading state
        selectUbicazione.innerHTML = '<option value="">Caricamento ubicazioni...</option>';
        selectUbicazione.disabled = true;

        // Get locations where this material already exists
        const ubicazioniOccupate = new Set(
            appState.getData('materiali')
                .filter(m => m.codice_materiale === materiale.codice_materiale)
                .map(m => m.nome_ubicazione)
        );

        // Get all available locations from API, then filter out occupied ones
        let tutte_ubicazioni = [];
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}?action=getLocations`);
            const result = await response.json();
            
            if (result.success) {
                tutte_ubicazioni = result.data.map(u => u.nome_ubicazione);
            } else {
                throw new Error('API error');
            }
        } catch (error) {
            console.warn('Fallback to existing materials locations:', error);
            // Fallback: get locations from existing materials
            tutte_ubicazioni = [...new Set(appState.getData('materiali').map(m => m.nome_ubicazione))];
        }

        // Filter out locations where material already exists
        const ubicazioni = tutte_ubicazioni
            .filter(ubicazione => !ubicazioniOccupate.has(ubicazione))
            .sort();
        
        selectUbicazione.innerHTML = '<option value="">Seleziona un\'ubicazione...</option>';
        selectUbicazione.disabled = false;
        
        if (ubicazioni.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Materiale già presente in tutte le ubicazioni";
            option.disabled = true;
            selectUbicazione.appendChild(option);
        } else {
            ubicazioni.forEach(ubicazione => {
                const option = document.createElement('option');
                option.value = ubicazione;
                option.textContent = ubicazione;
                selectUbicazione.appendChild(option);
            });
        }
    }

    async saveAssociation() {
        const categoria = document.getElementById('selectCategoria').value;
        const tipo = document.getElementById('selectTipo').value;
        const ubicazione = document.getElementById('selectUbicazione').value;
        const quantita = document.getElementById('nuovaQuantitaAssociazione').value;
        const userName = document.getElementById('userNameAssociazione').value.trim();

        // Validation
        if (!categoria || !tipo || !ubicazione) {
            UI.showError('⚠️ Seleziona tutti i campi richiesti');
            return;
        }

        const quantityValidation = Utils.validateQuantity(quantita);
        if (!quantityValidation.valid) {
            UI.showError(`⚠️ ${quantityValidation.message}`);
            return;
        }

        const userValidation = Utils.validateUserName(userName);
        if (!userValidation.valid) {
            UI.showError(`⚠️ ${userValidation.message}`);
            return;
        }

        // Find material from anagrafica
        const materiale = appState.getData('anagraficaMateriali')
            .find(m => m.categoria === categoria && m.tipo === tipo);
        
        if (!materiale) {
            UI.showError('⚠️ Combinazione tipo/categoria non trovata');
            return;
        }

        // Check if material already exists in this location
        const materialeEsistente = appState.getData('materiali').find(
            m => m.codice_materiale === materiale.codice_materiale && 
            m.nome_ubicazione === ubicazione
        );
        
        if (materialeEsistente) {
            UI.showError('⚠️ Questo materiale è già presente in questa ubicazione');
            return;
        }

        try {
            UI.showLoadingOverlay('Associazione materiale in corso...');
            
            await apiService.updateGiacenza(
                materiale.codice_materiale,
                ubicazione,
                quantityValidation.value,
                userValidation.formatted
            );

            UI.showSuccess('✅ Materiale associato con successo');
            this.hide();
            await dataManager.loadAllData();
            viewRenderer.render();

        } catch (error) {
            console.error('Errore durante l\'associazione:', error);
            UI.showError(`⚠️ ${error.message || 'Errore durante l\'associazione del materiale'}`);
        } finally {
            UI.hideLoadingOverlay();
        }
    }
}

const associationModal = new AssociationModal();

// ============================================================================
// NEW MATERIAL MODAL MANAGER
// ============================================================================

class NewMaterialModal {
    constructor() {
        this.modal = document.getElementById('newMaterialModal');
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.modal) return;

        // Close button
        const closeBtn = document.getElementById('newMaterialModalClose');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }

        // Click outside to close
        this.modal.onclick = (event) => {
            if (event.target === this.modal) {
                this.hide();
            }
        };

        // Category change
        const selectCategoria = document.getElementById('newMaterialCategoria');
        const altroCategoria = document.getElementById('altroCategoria');
        if (selectCategoria && altroCategoria) {
            selectCategoria.addEventListener('change', (e) => {
                altroCategoria.style.display = e.target.value === 'ALTRO' ? 'block' : 'none';
            });
        }

        // Unit change
        const selectUnitaMisura = document.getElementById('newMaterialUnitaMisura');
        const altraUnitaMisura = document.getElementById('altraUnitaMisura');
        const altraUnitaMisuraGroup = document.getElementById('altraUnitaMisuraGroup');
        if (selectUnitaMisura && altraUnitaMisura && altraUnitaMisuraGroup) {
            selectUnitaMisura.addEventListener('change', (e) => {
                altraUnitaMisuraGroup.style.display = e.target.value === 'ALTRO' ? 'block' : 'none';
            });
        }

        // Save button
        const saveButton = document.getElementById('btnSalvaNuovoMateriale');
        if (saveButton) {
            saveButton.onclick = () => this.saveMaterial();
        }
    }

    async show() {
        this.resetForm();
        await this.populateCategories();
        this.modal.style.display = 'block';
    }

    hide() {
        this.modal.style.display = 'none';
        this.resetForm();
    }

    resetForm() {
        const selectCategoria = document.getElementById('newMaterialCategoria');
        const altroCategoria = document.getElementById('altroCategoria');
        const tipo = document.getElementById('newMaterialTipo');
        const unitaMisura = document.getElementById('newMaterialUnitaMisura');
        const soglia = document.getElementById('newMaterialSoglia');
        const note = document.getElementById('newMaterialNote');
        const userName = document.getElementById('newMaterialUserName');

        if (selectCategoria) selectCategoria.value = '';
        if (altroCategoria) {
            altroCategoria.value = '';
            altroCategoria.style.display = 'none';
        }
        if (tipo) tipo.value = '';
        if (unitaMisura) {
            unitaMisura.value = '';
            const altraUnitaMisura = document.getElementById('altraUnitaMisura');
            const altraUnitaMisuraGroup = document.getElementById('altraUnitaMisuraGroup');
            if (altraUnitaMisura) altraUnitaMisura.value = '';
            if (altraUnitaMisuraGroup) altraUnitaMisuraGroup.style.display = 'none';
        }
        if (soglia) soglia.value = '';
        if (note) note.value = '';
        if (userName) userName.value = '';
    }

    async populateCategories() {
        const selectCategoria = document.getElementById('newMaterialCategoria');
        const altroCategoria = document.getElementById('altroCategoria');
        if (!selectCategoria || !altroCategoria) return;

        try {
            // Load anagrafica if not already loaded
            if (appState.getData('anagraficaMateriali').length === 0) {
                const materiali = await apiService.getMateriali();
                appState.updateData('anagraficaMateriali', materiali);
            }

            const categorie = [...new Set(appState.getData('anagraficaMateriali').map(m => m.categoria))].sort();
            
            selectCategoria.innerHTML = '<option value="">SELEZIONA UNA CATEGORIA...</option>' +
                categorie.map(cat => `<option value="${cat}">${cat}</option>`).join('') +
                '<option value="ALTRO">NUOVA CATEGORIA...</option>';
            
            // Verifica la selezione corrente
            if (selectCategoria.value === 'ALTRO') {
                altroCategoria.style.display = 'block';
            } else {
                altroCategoria.style.display = 'none';
            }

        } catch (error) {
            console.error('Errore durante il caricamento delle categorie:', error);
            UI.showError('⚠️ Errore nel caricamento delle categorie');
        }
    }

    async saveMaterial() {
        const selectCategoria = document.getElementById('newMaterialCategoria');
        const altroCategoria = document.getElementById('altroCategoria');
        const tipo = document.getElementById('newMaterialTipo');
        const unitaMisura = document.getElementById('newMaterialUnitaMisura');
        const soglia = document.getElementById('newMaterialSoglia');
        const note = document.getElementById('newMaterialNote');
        const userName = document.getElementById('newMaterialUserName');

        // Validazione
        if (!selectCategoria.value) {
            UI.showError('⚠️ Seleziona una categoria');
            return;
        }

        if (!tipo.value.trim()) {
            UI.showError('⚠️ Inserisci il tipo');
            return;
        }

        if (!unitaMisura.value.trim()) {
            UI.showError('⚠️ Inserisci l\'unità di misura');
            return;
        }

        const userValidation = Utils.validateUserName(userName.value);
        if (!userValidation.valid) {
            UI.showError(`⚠️ ${userValidation.message}`);
            return;
        }

        // Verifica unità di misura
        const unitaMisuraValue = unitaMisura.value;
        if (unitaMisuraValue === 'ALTRO') {
            const altraUnitaMisura = document.getElementById('altraUnitaMisura');
            if (!altraUnitaMisura || !altraUnitaMisura.value.trim()) {
                UI.showError('⚠️ Inserisci la nuova unità di misura');
                return;
            }
        }

        // Prepara i dati
        const categoria = selectCategoria.value === 'ALTRO' ? altroCategoria.value.trim().toUpperCase() : selectCategoria.value;
        const tipoValue = tipo.value.trim().toUpperCase();
        const unitaMisuraFinal = unitaMisuraValue === 'ALTRO' ? 
            document.getElementById('altraUnitaMisura').value.trim().toUpperCase() : 
            unitaMisuraValue;

        // Verifica che il tipo non esista già per questa categoria
        const tipoEsistente = appState.getData('anagraficaMateriali').find(
            m => m.categoria === categoria && m.tipo === tipoValue
        );

        if (tipoEsistente) {
            UI.showError('⚠️ Questo tipo esiste già per questa categoria');
            return;
        }

        try {
            UI.showLoadingOverlay('Creazione nuovo materiale in corso...');
            
            try {
                UI.showLoadingOverlay('Creazione nuovo materiale in corso...');
                
                const response = await fetch(`${CONFIG.API_BASE_URL}?action=addMateriale`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        categoria: categoria,
                        tipo: tipoValue,
                        unita_misura: unitaMisuraFinal,
                        soglia_minima: soglia.value || '0',
                        note: note.value.trim(),
                        userName: userValidation.formatted
                    })
                });

                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error || 'Errore durante la creazione del materiale');
                }

                // Ricarica tutti i dati, inclusa l'anagrafica materiali
                const materiali = await apiService.getMateriali();
                appState.updateData('anagraficaMateriali', materiali);
                await dataManager.loadAllData();
                
                UI.showSuccess('✅ Materiale creato con successo');
                this.hide();
                viewRenderer.render();

            } finally {
                UI.hideLoadingOverlay();
            }

        } catch (error) {
            console.error('Errore durante la creazione del materiale:', error);
            UI.showError(`⚠️ ${error.message || 'Errore durante la creazione del materiale'}`);
        } finally {
            UI.hideLoadingOverlay();
        }
    }
}

const newMaterialModal = new NewMaterialModal();

// ============================================================================
// NAVIGATION MANAGER
// ============================================================================

class NavigationManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Bottom navigation
        document.querySelectorAll('.nav-button').forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveNavButton(button);
                appState.setCurrentView(button.dataset.view);
                viewRenderer.render();
            });
        });

        // Set initial active button
        const activeButton = document.querySelector(`.nav-button[data-view="${appState.currentView}"]`);
        if (activeButton) {
            this.setActiveNavButton(activeButton);
        }
    }

    setActiveNavButton(activeButton) {
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
    }
}

// ============================================================================
// MENU MANAGER
// ============================================================================

class MenuManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Menu toggle
        const menuToggle = document.getElementById('menuToggle');
        const slideMenu = document.getElementById('slideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        const menuClose = document.getElementById('menuClose');
        
        if (menuToggle && slideMenu && menuOverlay && menuClose) {
            menuToggle.addEventListener('click', () => this.openMenu());
            menuClose.addEventListener('click', () => this.closeMenu());
            menuOverlay.addEventListener('click', () => this.closeMenu());
        }

        // Menu items
        const refreshBtn = document.getElementById('btnRefresh');
        const aboutBtn = document.getElementById('btnAbout');
        const addMaterialBtn = document.getElementById('btnAddMaterial');
        const newMaterialBtn = document.getElementById('btnNewMaterial');
        const mainMenuBtn = document.getElementById('btnMainMenu');

        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', () => {
                window.location.href = '../index.html';
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.closeMenu();
                this.refreshData();
            });
        }

        if (aboutBtn) {
            aboutBtn.addEventListener('click', () => {
                this.closeMenu();
                this.showAbout();
            });
        }

        if (addMaterialBtn) {
            addMaterialBtn.addEventListener('click', () => {
                this.closeMenu();
                associationModal.show();
            });
        }

        if (newMaterialBtn) {
            newMaterialBtn.addEventListener('click', () => {
                this.closeMenu();
                newMaterialModal.show();
            });
        }

        // About modal
        const aboutModal = document.getElementById('aboutModal');
        const aboutClose = document.getElementById('aboutClose');
        
        if (aboutModal && aboutClose) {
            aboutClose.addEventListener('click', () => {
                aboutModal.style.display = 'none';
            });
        }
    }

    openMenu() {
        const slideMenu = document.getElementById('slideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        
        if (slideMenu && menuOverlay) {
            slideMenu.classList.add('active');
            menuOverlay.classList.add('active');
        }
    }

    closeMenu() {
        const slideMenu = document.getElementById('slideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        
        if (slideMenu && menuOverlay) {
            slideMenu.classList.remove('active');
            menuOverlay.classList.remove('active');
        }
    }

    async refreshData() {
        const success = await dataManager.loadAllData();
        if (success) {
            viewRenderer.render();
            UI.showSuccess('✅ Dati aggiornati con successo');
        }
    }

    showAbout() {
        const aboutModal = document.getElementById('aboutModal');
        if (aboutModal) {
            aboutModal.style.display = 'block';
        }
    }
}

// ============================================================================
// SEARCH MANAGER
// ============================================================================

class SearchManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const searchToggle = document.getElementById('searchToggle');
        const searchOverlay = document.getElementById('searchOverlay');
        const searchClose = document.getElementById('searchClose');
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const clearSearchButton = document.getElementById('clearSearchButton');
        
        if (searchToggle && searchOverlay && searchClose && searchInput) {
            searchToggle.addEventListener('click', () => this.openSearch());
            searchClose.addEventListener('click', () => this.closeSearch());
            
            searchOverlay.addEventListener('click', (e) => {
                if (e.target === searchOverlay) {
                    this.closeSearch();
                }
            });

            // Aggiunto event listener per il pulsante di ricerca
            if (searchButton) {
                searchButton.addEventListener('click', () => {
                    if (searchInput.value.trim()) {
                        this.performSearch(searchInput.value);
                    }
                });
            }

            // Aggiunto event listener per il pulsante di cancellazione
            if (clearSearchButton) {
                clearSearchButton.addEventListener('click', () => {
                    searchInput.value = '';
                    searchInput.focus();
                    this.performSearch('');
                });
            }

            // Mantengo la ricerca in tempo reale ma aggiungo la ricerca con invio
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(e.target.value);
                }
            });

            searchInput.addEventListener('input', (e) => {
                this.performSearch(e.target.value);
                // Mostra/nascondi il pulsante di cancellazione in base al contenuto
                if (clearSearchButton) {
                    clearSearchButton.style.display = e.target.value ? 'block' : 'none';
                }
            });
        }
    }

    openSearch() {
        const searchOverlay = document.getElementById('searchOverlay');
        const searchInput = document.getElementById('searchInput');
        
        if (searchOverlay && searchInput) {
            searchOverlay.classList.add('active');
            searchInput.value = '';
            searchInput.focus();
        }
    }

    closeSearch() {
        const searchOverlay = document.getElementById('searchOverlay');
        const searchInput = document.getElementById('searchInput');
        
        if (searchOverlay && searchInput) {
            searchOverlay.classList.remove('active');
            searchInput.value = '';
            this.performSearch(''); // Resetta i risultati della ricerca
        }
    }

    performSearch(query) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;

        if (!query.trim()) {
            searchResults.innerHTML = '';
            return;
        }

        const searchTerm = query.toLowerCase().trim();
        let results = [];

        switch (appState.currentView) {
            case CONFIG.VIEWS.UBICAZIONE:
                results = this.searchLocations(searchTerm);
                break;
            case CONFIG.VIEWS.CATEGORIA:
                results = this.searchCategories(searchTerm);
                break;
            case CONFIG.VIEWS.TIPO:
                results = this.searchTypes(searchTerm);
                break;
            default:
                results = this.searchAll(searchTerm);
                break;
        }

        this.displayResults(results);
    }

    searchLocations(query) {
        const materiali = appState.getData('materiali');
        const ubicazioni = [...new Set(materiali.map(m => m.nome_ubicazione))];
        
        return ubicazioni
            .filter(ubicazione => ubicazione.toLowerCase().includes(query))
            .map(ubicazione => ({
                type: 'ubicazione',
                text: ubicazione,
                icon: '📍'
            }));
    }

    searchCategories(query) {
        const materiali = appState.getData('materiali');
        const categorie = [...new Set(materiali.map(m => m.categoria))];
        
        return categorie
            .filter(categoria => categoria.toLowerCase().includes(query))
            .map(categoria => ({
                type: 'categoria',
                text: categoria,
                icon: '📂'
            }));
    }

    searchTypes(query) {
        const materiali = appState.getData('materiali');
        const tipi = [...new Set(materiali.map(m => m.tipo))];
        
        return tipi
            .filter(tipo => tipo.toLowerCase().includes(query))
            .map(tipo => ({
                type: 'tipo',
                text: tipo,
                icon: '🏷️'
            }));
    }

    searchAll(query) {
        return [
            ...this.searchLocations(query),
            ...this.searchCategories(query),
            ...this.searchTypes(query)
        ];
    }

    displayResults(results) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) return;

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">NESSUN RISULTATO TROVATO</div>';
            return;
        }

        let html = '<div class="search-results-list">';
        results.forEach(result => {
            html += `
                <div class="search-result-item" data-type="${result.type}" data-value="${result.text}">
                    <span class="search-result-icon">${result.icon}</span>
                    <span class="search-result-text">${result.text}</span>
                </div>
            `;
        });
        html += '</div>';
        searchResults.innerHTML = html;

        // Aggiungi event listeners ai risultati
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                const value = item.dataset.value;
                
                // Imposta la vista appropriata e il filtro
                if (type !== appState.currentView) {
                    appState.setCurrentView(type);
                }
                appState.setCurrentFilter(value);
                
                // Chiudi la ricerca e aggiorna la vista
                this.closeSearch();
                viewRenderer.render();
            });
        });
    }
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

class App {
    constructor() {
        this.navigationManager = new NavigationManager();
        this.menuManager = new MenuManager();
        this.searchManager = new SearchManager();
    }

    async init() {
        try {
            const success = await dataManager.loadAllData();
            if (success) {
                viewRenderer.render();
            } else {
                // Show error state
                const mainContent = document.getElementById('mainContent');
                if (mainContent) {
                    mainContent.innerHTML = `
                        <div class="error-state">
                            <h2>⚠️ Errore nel caricamento</h2>
                            <p>Non è stato possibile caricare i dati. Riprova più tardi.</p>
                            <button onclick="app.init()" class="update-button">🔄 Riprova</button>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Errore durante l\'inizializzazione:', error);
            UI.showError('⚠️ Errore durante l\'inizializzazione dell\'applicazione');
        }
    }
}

// ============================================================================
// APPLICATION STARTUP
// ============================================================================

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new App();
    app.init();

    // Gestione del menu laterale
    const btnMainMenu = document.getElementById('btnMainMenu');
    if (btnMainMenu) {
        btnMainMenu.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }
});