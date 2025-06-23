// ============================================================================
// CONFIGURAZIONE E COSTANTI
// ============================================================================

const CONFIG = {
    API_BASE_URL: '../php/api_materiali.php',
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
            const url = data ? CONFIG.API_BASE_URL : `${CONFIG.API_BASE_URL}?action=${action}`;
            const options = {
                method: data ? 'POST' : 'GET'
            };

            if (data) {
                const formData = new FormData();
                formData.append('action', action);
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
                        <span class="material-code">${materiale.codice_materiale}</span>
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
    }

    show(materialId, ubicazione = null) {
        const materiale = dataManager.findMaterial(materialId, ubicazione);
        if (!materiale) {
            UI.showError('⚠️ Materiale non trovato');
            return;
        }

        appState.setCurrentMaterialId(materialId);
        this.populateModal(materiale);
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

        // Update placeholder
        const quantityInput = document.getElementById('nuovaQuantita');
        if (quantityInput) {
            quantityInput.placeholder = `Inserisci la nuova quantità (attuale: ${Utils.formatQuantity(materiale.quantita_attuale)})`;
        }
    }

    resetForm() {
        const nuovaQuantitaInput = document.getElementById('nuovaQuantita');
        const userNameInput = document.getElementById('userName');
        
        if (nuovaQuantitaInput) nuovaQuantitaInput.value = '';
        if (userNameInput) userNameInput.value = '';
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
        
        selectCategoria.innerHTML = '<option value="">Seleziona una categoria...</option>';
        categorie.forEach(categoria => {
            const option = document.createElement('option');
            option.value = categoria;
            option.textContent = categoria;
            selectCategoria.appendChild(option);
        });
    }

    populateLocations() {
        const selectUbicazione = document.getElementById('selectUbicazione');
        if (!selectUbicazione) return;

        const ubicazioni = [...new Set(appState.getData('materiali').map(m => m.nome_ubicazione))].sort();
        
        selectUbicazione.innerHTML = '<option value="">Seleziona un\'ubicazione...</option>';
        ubicazioni.forEach(ubicazione => {
            const option = document.createElement('option');
            option.value = ubicazione;
            option.textContent = ubicazione;
            selectUbicazione.appendChild(option);
        });
    }

    handleCategoriaChange(event) {
        const categoria = event.target.value;
        const selectTipo = document.getElementById('selectTipo');
        const selectUbicazione = document.getElementById('selectUbicazione');
        
        if (!selectTipo || !selectUbicazione) return;

        selectTipo.disabled = !categoria;
        selectTipo.innerHTML = '<option value="">Seleziona un tipo...</option>';
        selectUbicazione.value = '';
        
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

    handleTipoChange(event) {
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

        // Get available locations (excluding those where material already exists)
        const ubicazioniOccupate = new Set(
            appState.getData('materiali')
                .filter(m => m.codice_materiale === materiale.codice_materiale)
                .map(m => m.nome_ubicazione)
        );

        const ubicazioni = [...new Set(appState.getData('materiali').map(m => m.nome_ubicazione))]
            .filter(ubicazione => !ubicazioniOccupate.has(ubicazione))
            .sort();
        
        selectUbicazione.innerHTML = '<option value="">Seleziona un\'ubicazione...</option>';
        
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
        
        if (searchToggle && searchOverlay && searchClose && searchInput) {
            searchToggle.addEventListener('click', () => this.openSearch());
            searchClose.addEventListener('click', () => this.closeSearch());
            
            searchOverlay.addEventListener('click', (e) => {
                if (e.target === searchOverlay) {
                    this.closeSearch();
                }
            });

            // TODO: Implement search functionality
            searchInput.addEventListener('input', (e) => {
                // Search implementation would go here
                console.log('Search query:', e.target.value);
            });
        }
    }

    openSearch() {
        const searchOverlay = document.getElementById('searchOverlay');
        const searchInput = document.getElementById('searchInput');
        
        if (searchOverlay && searchInput) {
            searchOverlay.classList.add('active');
            searchInput.focus();
        }
    }

    closeSearch() {
        const searchOverlay = document.getElementById('searchOverlay');
        const searchInput = document.getElementById('searchInput');
        
        if (searchOverlay && searchInput) {
            searchOverlay.classList.remove('active');
            searchInput.value = '';
        }
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
});