<?php
require_once 'config.php';

try {
    $conn = new PDO("mysql:host=" . DB_HOST, DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Seleziona il database (deve già esistere dalla precedente inizializzazione)
    $conn->exec("USE " . DB_NAME);

    echo "Inizializzazione tabelle materiali...\n";

    // 1. Crea tabella anagrafica_materiali
    echo "Creazione tabella anagrafica_materiali...\n";
    $sql = "CREATE TABLE IF NOT EXISTS anagrafica_materiali (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codice_materiale VARCHAR(20) UNIQUE NOT NULL COMMENT 'Codice identificativo del materiale (es. MATE001)',
        categoria VARCHAR(100) NOT NULL COMMENT 'Categoria del materiale (es. SOLVENTI, PLASTICHE, etc.)',
        tipo VARCHAR(200) NOT NULL COMMENT 'Descrizione specifica del materiale',
        unita_misura VARCHAR(10) NOT NULL COMMENT 'Unità di misura (L, KG, PZ, etc.)',
        note TEXT COMMENT 'Note aggiuntive sul materiale',
        scheda_sicurezza VARCHAR(500) COMMENT 'Link o riferimento alla scheda di sicurezza',
        fornitore_principale VARCHAR(200) COMMENT 'Nome del fornitore principale',
        prezzo_ultimo DECIMAL(10,2) COMMENT 'Ultimo prezzo di acquisto',
        data_ultimo_acquisto DATE COMMENT 'Data dell ultimo acquisto',
        soglia_minima DECIMAL(8,2) DEFAULT 0 COMMENT 'Soglia minima di giacenza per alert',
        attivo BOOLEAN DEFAULT TRUE COMMENT 'Se il materiale è ancora utilizzato',
        utente_creazione VARCHAR(100) COMMENT 'Utente che ha creato il record',
        utente_modifica VARCHAR(100) COMMENT 'Ultimo utente che ha modificato il record',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_codice_materiale (codice_materiale),
        INDEX idx_categoria (categoria),
        INDEX idx_tipo (tipo),
        INDEX idx_attivo (attivo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $conn->exec($sql);

    // 2. Crea tabella giacenze_materiali (quantità per ubicazione)
    echo "Creazione tabella giacenze_materiali...\n";
    $sql = "CREATE TABLE IF NOT EXISTS giacenze_materiali (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codice_materiale VARCHAR(20) NOT NULL COMMENT 'Riferimento al materiale',
        ID_ubicazione INT NOT NULL COMMENT 'Riferimento alla ubicazione',
        quantita_attuale DECIMAL(10,2) DEFAULT 0 COMMENT 'Quantità attualmente presente',
        quantita_riservata DECIMAL(10,2) DEFAULT 0 COMMENT 'Quantità riservata/prenotata',
        quantita_disponibile DECIMAL(10,2) GENERATED ALWAYS AS (quantita_attuale - quantita_riservata) STORED COMMENT 'Quantità effettivamente disponibile',
        data_ultimo_inventario DATE COMMENT 'Data dell ultimo inventario fisico',
        note_ubicazione TEXT COMMENT 'Note specifiche per questa ubicazione',
        utente_creazione VARCHAR(100) COMMENT 'Utente che ha creato il record',
        utente_modifica VARCHAR(100) COMMENT 'Ultimo utente che ha modificato il record',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (codice_materiale) REFERENCES anagrafica_materiali(codice_materiale) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (ID_ubicazione) REFERENCES ubicazioni(ID_ubicazione) ON DELETE CASCADE,
        UNIQUE KEY unique_materiale_ubicazione (codice_materiale, ID_ubicazione),
        INDEX idx_codice_materiale (codice_materiale),
        INDEX idx_ubicazione (ID_ubicazione),
        INDEX idx_quantita_attuale (quantita_attuale),
        INDEX idx_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $conn->exec($sql);

    // 3. Crea tabella LogVariazioniMateriali per tracciare tutte le modifiche
    echo "Creazione tabella LogVariazioniMateriali...\n";
    $sql = "CREATE TABLE IF NOT EXISTS LogVariazioniMateriali (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_name VARCHAR(100) NOT NULL COMMENT 'Utente che ha effettuato la variazione',
        azione ENUM('creazione_giacenza', 'eliminazione_giacenza', 'carico', 'scarico', 'inventario', 'trasferimento', 'modifica_anagrafica') NOT NULL COMMENT 'Tipo di operazione',
        codice_materiale VARCHAR(20) NOT NULL COMMENT 'Codice del materiale coinvolto',
        ID_ubicazione_origine INT COMMENT 'Ubicazione di origine (per trasferimenti)',
        ID_ubicazione_destinazione INT COMMENT 'Ubicazione di destinazione',
        quantita_precedente DECIMAL(10,2) COMMENT 'Quantità prima della variazione',
        quantita_variazione DECIMAL(10,2) COMMENT 'Quantità della variazione (+/-)',
        quantita_attuale DECIMAL(10,2) COMMENT 'Quantità dopo la variazione',
        causale VARCHAR(200) COMMENT 'Motivo della variazione (es. produzione, vendita, inventario, etc.)',
        documento_riferimento VARCHAR(100) COMMENT 'Numero documento di riferimento (DDT, fattura, etc.)',
        note TEXT COMMENT 'Note aggiuntive sulla variazione',
        dati_precedenti JSON COMMENT 'Snapshot dei dati precedenti (per modifiche anagrafica)',
        dati_nuovi JSON COMMENT 'Snapshot dei dati nuovi (per modifiche anagrafica)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (codice_materiale) REFERENCES anagrafica_materiali(codice_materiale) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (ID_ubicazione_origine) REFERENCES ubicazioni(ID_ubicazione) ON DELETE SET NULL,
        FOREIGN KEY (ID_ubicazione_destinazione) REFERENCES ubicazioni(ID_ubicazione) ON DELETE SET NULL,
        INDEX idx_timestamp (timestamp),
        INDEX idx_codice_materiale (codice_materiale),
        INDEX idx_azione (azione),
        INDEX idx_user_name (user_name),
        INDEX idx_ubicazione_destinazione (ID_ubicazione_destinazione),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $conn->exec($sql);

    // 4. Crea tabella per gestire i movimenti di materiale (opzionale, per tracking dettagliato)
    echo "Creazione tabella MovimentiMateriali...\n";
    $sql = "CREATE TABLE IF NOT EXISTS MovimentiMateriali (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numero_movimento VARCHAR(50) UNIQUE NOT NULL COMMENT 'Numero progressivo del movimento',
        data_movimento DATE NOT NULL,
        tipo_movimento ENUM('carico', 'scarico', 'trasferimento', 'inventario', 'rettifica') NOT NULL,
        codice_materiale VARCHAR(20) NOT NULL,
        ID_ubicazione_origine INT COMMENT 'Ubicazione di partenza (per trasferimenti/scarichi)',
        ID_ubicazione_destinazione INT COMMENT 'Ubicazione di arrivo (per trasferimenti/carichi)',
        quantita DECIMAL(10,2) NOT NULL,
        prezzo_unitario DECIMAL(10,2) COMMENT 'Prezzo unitario (per valorizzazione)',
        valore_totale DECIMAL(12,2) GENERATED ALWAYS AS (quantita * prezzo_unitario) STORED,
        fornitore_cliente VARCHAR(200) COMMENT 'Fornitore (per carichi) o cliente (per scarichi)',
        documento_riferimento VARCHAR(100) COMMENT 'DDT, fattura, etc.',
        causale VARCHAR(200) NOT NULL COMMENT 'Motivo del movimento',
        note TEXT,
        user_name VARCHAR(100) NOT NULL COMMENT 'Utente che ha registrato il movimento',
        approvato_da VARCHAR(100) COMMENT 'Utente che ha approvato il movimento',
        data_approvazione TIMESTAMP NULL COMMENT 'Data e ora di approvazione',
        stato ENUM('bozza', 'approvato', 'annullato') DEFAULT 'bozza',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (codice_materiale) REFERENCES anagrafica_materiali(codice_materiale) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (ID_ubicazione_origine) REFERENCES ubicazioni(ID_ubicazione) ON DELETE SET NULL,
        FOREIGN KEY (ID_ubicazione_destinazione) REFERENCES ubicazioni(ID_ubicazione) ON DELETE SET NULL,
        INDEX idx_numero_movimento (numero_movimento),
        INDEX idx_data_movimento (data_movimento),
        INDEX idx_tipo_movimento (tipo_movimento),
        INDEX idx_codice_materiale (codice_materiale),
        INDEX idx_stato (stato),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $conn->exec($sql);

    // 5. Crea tabella per alert e notifiche
    echo "Creazione tabella AlertMateriali...\n";
    $sql = "CREATE TABLE IF NOT EXISTS AlertMateriali (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codice_materiale VARCHAR(20) NOT NULL,
        ID_ubicazione INT,
        tipo_alert ENUM('scorta_minima', 'scadenza', 'inventario_scaduto', 'movimento_anomalo') NOT NULL,
        livello_priorita ENUM('basso', 'medio', 'alto', 'critico') DEFAULT 'medio',
        messaggio TEXT NOT NULL,
        quantita_attuale DECIMAL(10,2),
        soglia_riferimento DECIMAL(10,2),
        data_scadenza DATE COMMENT 'Per alert di scadenza',
        visualizzato BOOLEAN DEFAULT FALSE,
        risolto BOOLEAN DEFAULT FALSE,
        utente_risoluzione VARCHAR(100),
        data_risoluzione TIMESTAMP NULL,
        note_risoluzione TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (codice_materiale) REFERENCES anagrafica_materiali(codice_materiale) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (ID_ubicazione) REFERENCES ubicazioni(ID_ubicazione) ON DELETE CASCADE,
        INDEX idx_codice_materiale (codice_materiale),
        INDEX idx_tipo_alert (tipo_alert),
        INDEX idx_livello_priorita (livello_priorita),
        INDEX idx_risolto (risolto),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    $conn->exec($sql);

    // 6. Crea view per report e query frequenti
    echo "Creazione view per report...\n";
    
    // View per giacenze totali per materiale
    $sql = "CREATE OR REPLACE VIEW view_giacenze_totali AS
    SELECT 
        am.codice_materiale,
        am.categoria,
        am.tipo,
        am.unita_misura,
        COALESCE(SUM(gm.quantita_attuale), 0) as quantita_totale,
        COALESCE(SUM(gm.quantita_riservata), 0) as quantita_riservata_totale,
        COALESCE(SUM(gm.quantita_disponibile), 0) as quantita_disponibile_totale,
        am.soglia_minima,
        CASE 
            WHEN COALESCE(SUM(gm.quantita_disponibile), 0) <= am.soglia_minima THEN 'CRITICO'
            WHEN COALESCE(SUM(gm.quantita_disponibile), 0) <= (am.soglia_minima * 1.5) THEN 'BASSO'
            ELSE 'OK'
        END as stato_giacenza,
        COUNT(gm.ID_ubicazione) as numero_ubicazioni,
        am.attivo
    FROM anagrafica_materiali am
    LEFT JOIN giacenze_materiali gm ON am.codice_materiale = gm.codice_materiale
    WHERE am.attivo = TRUE
    GROUP BY am.codice_materiale, am.categoria, am.tipo, am.unita_misura, am.soglia_minima, am.attivo";
    $conn->exec($sql);

    // View per giacenze per ubicazione
    $sql = "CREATE OR REPLACE VIEW view_giacenze_per_ubicazione AS
    SELECT 
        u.nome_ubicazione,
        u.ID_ubicazione,
        am.codice_materiale,
        am.categoria,
        am.tipo,
        am.unita_misura,
        gm.quantita_attuale,
        gm.quantita_riservata,
        gm.quantita_disponibile,
        gm.data_ultimo_inventario,
        DATEDIFF(CURDATE(), gm.data_ultimo_inventario) as giorni_ultimo_inventario,
        gm.updated_at as ultimo_aggiornamento
    FROM ubicazioni u
    JOIN giacenze_materiali gm ON u.ID_ubicazione = gm.ID_ubicazione
    JOIN anagrafica_materiali am ON gm.codice_materiale = am.codice_materiale
    WHERE am.attivo = TRUE AND gm.quantita_attuale > 0
    ORDER BY u.nome_ubicazione, am.categoria, am.tipo";
    $conn->exec($sql);

    // 7. Creazione di trigger per automatizzare i log
    echo "Creazione trigger per logging automatico...\n";
    
    // Trigger per logging delle modifiche alle giacenze
    $sql = "DROP TRIGGER IF EXISTS tr_giacenze_after_update";
    $conn->exec($sql);
    
    $sql = "CREATE TRIGGER tr_giacenze_after_update
    AFTER UPDATE ON giacenze_materiali
    FOR EACH ROW
    BEGIN
        IF OLD.quantita_attuale != NEW.quantita_attuale THEN
            INSERT INTO LogVariazioniMateriali (
                user_name,
                azione,
                codice_materiale,
                ID_ubicazione_destinazione,
                quantita_precedente,
                quantita_variazione,
                quantita_attuale,
                causale,
                note
            ) VALUES (
                NEW.utente_modifica,
                IF(NEW.quantita_attuale > OLD.quantita_attuale, 'carico', 'scarico'),
                NEW.codice_materiale,
                NEW.ID_ubicazione,
                OLD.quantita_attuale,
                NEW.quantita_attuale - OLD.quantita_attuale,
                NEW.quantita_attuale,
                'Modifica diretta giacenza',
                CONCAT('Aggiornamento automatico da ', OLD.quantita_attuale, ' a ', NEW.quantita_attuale)
            );
        END IF;
    END";
    $conn->exec($sql);

    // Trigger per logging delle nuove giacenze
    $sql = "DROP TRIGGER IF EXISTS tr_giacenze_after_insert";
    $conn->exec($sql);
    
    $sql = "CREATE TRIGGER tr_giacenze_after_insert
    AFTER INSERT ON giacenze_materiali
    FOR EACH ROW
    BEGIN
        INSERT INTO LogVariazioniMateriali (
            user_name,
            azione,
            codice_materiale,
            ID_ubicazione_destinazione,
            quantita_precedente,
            quantita_variazione,
            quantita_attuale,
            causale,
            note
        ) VALUES (
            NEW.utente_creazione,
            'creazione_giacenza',
            NEW.codice_materiale,
            NEW.ID_ubicazione,
            0,
            NEW.quantita_attuale,
            NEW.quantita_attuale,
            'Creazione nuova giacenza',
            CONCAT('Creazione giacenza per ubicazione ID: ', NEW.ID_ubicazione)
        );
    END";
    $conn->exec($sql);

    // Trigger per logging delle eliminazioni giacenze
    $sql = "DROP TRIGGER IF EXISTS tr_giacenze_after_delete";
    $conn->exec($sql);
    
    $sql = "CREATE TRIGGER tr_giacenze_after_delete
    AFTER DELETE ON giacenze_materiali
    FOR EACH ROW
    BEGIN
        INSERT INTO LogVariazioniMateriali (
            user_name,
            azione,
            codice_materiale,
            ID_ubicazione_destinazione,
            quantita_precedente,
            quantita_variazione,
            quantita_attuale,
            causale,
            note
        ) VALUES (
            'SYSTEM',
            'eliminazione_giacenza',
            OLD.codice_materiale,
            OLD.ID_ubicazione,
            OLD.quantita_attuale,
            -OLD.quantita_attuale,
            0,
            'Eliminazione giacenza',
            CONCAT('Eliminazione giacenza da ubicazione ID: ', OLD.ID_ubicazione)
        );
    END";
    $conn->exec($sql);

    echo "\n=== INIZIALIZZAZIONE COMPLETATA ===\n";
    echo "Tabelle create:\n";
    echo "- anagrafica_materiali: anagrafica completa dei materiali\n";
    echo "- giacenze_materiali: quantità per ubicazione\n";
    echo "- LogVariazioniMateriali: storico di tutte le variazioni\n";
    echo "- MovimentiMateriali: movimenti dettagliati\n";
    echo "- AlertMateriali: sistema di alert e notifiche\n";
    echo "- view_giacenze_totali: vista riassuntiva giacenze\n";
    echo "- view_giacenze_per_ubicazione: vista giacenze per ubicazione\n";
    echo "- Trigger automatici per il logging\n";
    echo "\nSchema materiali inizializzato correttamente!\n";

} catch(PDOException $e) {
    echo "Errore durante l'inizializzazione del database materiali: " . $e->getMessage() . "\n";
}
?>