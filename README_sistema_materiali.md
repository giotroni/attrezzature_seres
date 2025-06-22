# Sistema di Gestione Materiali

## Introduzione

Il sistema di gestione materiali è un'estensione del sistema di gestione attrezzature esistente, progettato per tracciare le quantità di materiali presenti nelle diverse ubicazioni aziendali.

## Struttura del Database

### Tabelle Principali

#### 1. `anagrafica_materiali`
Contiene le informazioni di base di ogni materiale:
- `codice_materiale`: Identificativo univoco (es. MATE001)
- `categoria`: Categoria del materiale (SOLVENTI, PLASTICHE, etc.)
- `tipo`: Descrizione specifica del materiale
- `unita_misura`: Unità di misura (L, KG, PZ, etc.)
- `soglia_minima`: Soglia per alert di scorta minima
- `note`: Note aggiuntive
- Campi di audit (utente_creazione, utente_modifica, created_at, updated_at)

#### 2. `giacenze_materiali`
Gestisce le quantità per ubicazione:
- `codice_materiale`: Riferimento al materiale
- `ID_ubicazione`: Riferimento all'ubicazione (tabella esistente)
- `quantita_attuale`: Quantità presente
- `quantita_riservata`: Quantità riservata/prenotata
- `quantita_disponibile`: Campo calcolato (attuale - riservata)
- `data_ultimo_inventario`: Data ultimo inventario fisico

#### 3. `LogVariazioniMateriali`
Traccia tutte le modifiche:
- `azione`: Tipo operazione (carico, scarico, trasferimento, etc.)
- `quantita_precedente`, `quantita_variazione`, `quantita_attuale`
- `causale`: Motivo della variazione
- `documento_riferimento`: DDT, fattura, etc.

#### 4. `MovimentiMateriali`
Movimenti strutturati con approvazioni (opzionale):
- `numero_movimento`: Codice progressivo
- `tipo_movimento`: carico, scarico, trasferimento, inventario
- `stato`: bozza, approvato, annullato

#### 5. `AlertMateriali`
Sistema di notifiche per:
- Scorte sotto soglia minima
- Inventari scaduti
- Movimenti anomali

### View e Trigger

- **`view_giacenze_totali`**: Vista riassuntiva per materiale
- **`view_giacenze_per_ubicazione`**: Vista dettagliata per ubicazione
- **Trigger automatici**: Logging automatico delle modifiche alle giacenze

## API Endpoints

Il file `api_materiali.php` fornisce i seguenti endpoint:

### 1. `getMateriali`
Restituisce l'elenco dei materiali con giacenze totali.

**URL:** `api_materiali.php?action=getMateriali`

**Parametri opzionali:**
- `categoria`: Filtra per categoria
- `attivo`: true/false (default: true)
- `stato_giacenza`: OK, BASSO, CRITICO

**Esempio risposta:**
```json
{
  "success": true,
  "count": 25,
  "data": [
    {
      "codice_materiale": "MATE001",
      "categoria": "SOLVENTI",
      "tipo": "Ciclometicone D4",
      "unita_misura": "L",
      "quantita_totale": "15.500",
      "quantita_disponibile_totale": "12.000",
      "stato_giacenza": "OK",
      "numero_ubicazioni": 3
    }
  ]
}
```

### 2. `getGiacenze`
Dettaglio giacenze per ubicazione.

**URL:** `api_materiali.php?action=getGiacenze`

**Parametri opzionali:**
- `codice_materiale`: Filtra per materiale specifico
- `ubicazione`: Filtra per ubicazione
- `solo_positive`: true per mostrare solo giacenze > 0

### 3. `updateGiacenza`
Aggiorna la quantità di un materiale in un'ubicazione.

**Method:** POST
**URL:** `api_materiali.php?action=updateGiacenza`

**Parametri richiesti:**
- `codice_materiale`
- `ubicazione`
- `nuova_quantita`
- `userName`

**Parametri opzionali:**
- `causale`
- `note`

### 4. `movimentoMateriale`
Registra un movimento strutturato (carico/scarico).

**Method:** POST
**URL:** `api_materiali.php?action=movimentoMateriale`

**Parametri richiesti:**
- `codice_materiale`
- `tipo_movimento`: carico, scarico, trasferimento
- `quantita`
- `userName`

**Per carico:**
- `ubicazione_destinazione`

**Per scarico:**
- `ubicazione_origine`

**Parametri opzionali:**
- `causale`
- `documento_riferimento`
- `note`

### 5. `getMaterialeDettaglio`
Dettagli completi di un materiale specifico.

**URL:** `api_materiali.php?action=getMaterialeDettaglio&codice_materiale=MATE001`

### 6. `getStorico`
Storico movimenti.

**URL:** `api_materiali.php?action=getStorico`

**Parametri opzionali:**
- `codice_materiale`
- `azione`
- `data_da`, `data_a`
- `limit`

### 7. `getAlert`
Alert e notifiche del sistema.

**URL:** `api_materiali.php?action=getAlert`

### 8. `createMateriale`
Crea un nuovo materiale.

**Method:** POST
**URL:** `api_materiali.php?action=createMateriale`

### 9. `getCategorie`
Lista delle categorie con conteggi.

### 10. `getUbicazioni`
Lista ubicazioni con statistiche materiali.

## Installazione e Setup

### 1. Inizializzazione Database
```bash
php init_db_materiali.php
```

Questo script:
- Crea tutte le tabelle necessarie
- Imposta le relazioni (foreign key)
- Crea le view di supporto
- Configura i trigger automatici

### 2. Importazione Dati Excel (Opzionale)
Se hai già dati in formato Excel:
```bash
php import_materiali_from_excel.php
```

**Nota:** Richiede la libreria PhpSpreadsheet installata via Composer.

### 3. Configurazione
Assicurati che il file `config.php` contenga le credenziali corrette del database.

## Esempi di Utilizzo

### Carico Materiale
```javascript
fetch('api_materiali.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({
    action: 'movimentoMateriale',
    codice_materiale: 'MATE001',
    tipo_movimento: 'carico',
    quantita: '10.5',
    ubicazione_destinazione: 'LABORATORIO',
    causale: 'Nuovo acquisto',
    documento_riferimento: 'DDT-001',
    userName: 'MARIO.ROSSI'
  })
})
```

### Scarico Materiale
```javascript
fetch('api_materiali.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({
    action: 'movimentoMateriale',
    codice_materiale: 'MATE001',
    tipo_movimento: 'scarico',
    quantita: '2.5',
    ubicazione_origine: 'LABORATORIO',
    causale: 'Utilizzo produzione',
    userName: 'MARIO.ROSSI'
  })
})
```

### Aggiornamento Diretto Giacenza
```javascript
fetch('api_materiali.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({
    action: 'updateGiacenza',
    codice_materiale: 'MATE001',
    ubicazione: 'LABORATORIO',
    nuova_quantita: '15.0',
    causale: 'Inventario fisico',
    userName: 'MARIO.ROSSI'
  })
})
```

## Query SQL Utili

### Giacenze Totali per Categoria
```sql
SELECT 
    categoria,
    COUNT(*) as numero_materiali,
    SUM(quantita_totale) as quantita_totale_categoria
FROM view_giacenze_totali 
GROUP BY categoria;
```

### Materiali con Giacenza Critica
```sql
SELECT * FROM view_giacenze_totali 
WHERE stato_giacenza = 'CRITICO';
```

### Movimenti del Giorno
```sql
SELECT 
    lvm.*,
    am.tipo,
    u.nome_ubicazione
FROM LogVariazioniMateriali lvm
JOIN anagrafica_materiali am ON lvm.codice_materiale = am.codice_materiale
LEFT JOIN ubicazioni u ON lvm.ID_ubicazione_destinazione = u.ID_ubicazione
WHERE DATE(lvm.timestamp) = CURDATE()
ORDER BY lvm.timestamp DESC;
```

### Report Inventario per Ubicazione
```sql
SELECT 
    nome_ubicazione,
    COUNT(*) as numero_materiali,
    SUM(quantita_attuale) as quantita_totale,
    AVG(DATEDIFF(CURDATE(), data_ultimo_inventario)) as giorni_medio_ultimo_inventario
FROM view_giacenze_per_ubicazione
WHERE quantita_attuale > 0
GROUP BY nome_ubicazione, ID_ubicazione;
```

## Sicurezza e Logging

- Tutte le operazioni sono loggate automaticamente
- I trigger del database garantiscono la tracciabilità
- Le API supportano logging tramite la funzione `logApiEvent()` esistente
- Validazione dei parametri su tutti gli endpoint

## Note Tecniche

- Il sistema supporta decimali per le quantità (fino a 3 cifre decimali)
- Le ubicazioni vengono create automaticamente se non esistenti
- I codici materiale sono sempre convertiti in maiuscolo
- Il sistema è compatibile con il database esistente delle attrezzature
- Supporto per transazioni per garantire consistenza dei dati

## Estensioni Future

- Sistema di prenotazioni/riservazioni
- Gestione scadenze materiali
- Integrazione con fornitori
- Report automatici via email
- Dashboard in tempo reale
- App mobile per inventari