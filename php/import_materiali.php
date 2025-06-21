<?php
/**
 * Script semplificato per importare i dati dei materiali
 * Non richiede librerie esterne - utilizza solo PHP nativo
 * 
 * IMPORTANTE: Prima di eseguire questo script:
 * 1. Converti il file Excel in 2 file CSV separati:
 *    - anagrafica_materiali.csv (con colonne: ID,CATEGORIA,TIPO,UM)
 *    - ubicazione_materiali.csv (con colonne: ID,Ubicazione,Valore)
 * 2. Carica i file CSV nella stessa cartella di questo script
 */

// Abilita la visualizzazione degli errori per debug
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'config.php';

try {
    $conn = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "=== IMPORTAZIONE MATERIALI - VERSIONE SEMPLIFICATA ===\n\n";

    // === OPZIONE 1: IMPORTAZIONE DA CSV ===
    $file_anagrafica = 'anagrafica_materiali.csv';
    $file_ubicazioni = 'ubicazione_materiali.csv';
    
    if (file_exists($file_anagrafica) && file_exists($file_ubicazioni)) {
        echo "Trovati file CSV, procedo con l'importazione...\n\n";
        importazioneCSV($conn, $file_anagrafica, $file_ubicazioni);
    } else {
        echo "File CSV non trovati, procedo con l'importazione di dati di esempio...\n\n";
        echo "Per importare i tuoi dati:\n";
        echo "1. Salva i sheet Excel come CSV separati:\n";
        echo "   - anagrafica_materiali.csv\n";
        echo "   - ubicazione_materiali.csv\n";
        echo "2. Ricarica questo script\n\n";
        
        // === OPZIONE 2: CREA DATI DI ESEMPIO ===
        creaDatiEsempio($conn);
    }

} catch (Exception $e) {
    echo "ERRORE: " . $e->getMessage() . "\n";
    echo "Traccia completa:\n" . $e->getTraceAsString() . "\n";
}

function importazioneCSV($conn, $file_anagrafica, $file_ubicazioni) {
    echo "=== IMPORTAZIONE ANAGRAFICA DA CSV ===\n";
    
    // Importa anagrafica materiali
    $handle = fopen($file_anagrafica, 'r');
    if (!$handle) {
        throw new Exception("Impossibile aprire il file $file_anagrafica");
    }
    
    // Salta l'header
    $header = fgetcsv($handle);
    echo "Header anagrafica: " . implode(', ', $header) . "\n";
    
    $stmt_anagrafica = $conn->prepare("
        INSERT INTO anagrafica_materiali (
            codice_materiale, categoria, tipo, unita_misura, 
            utente_creazione, utente_modifica
        ) VALUES (?, ?, ?, ?, 'IMPORT', 'IMPORT')
        ON DUPLICATE KEY UPDATE
            categoria = VALUES(categoria),
            tipo = VALUES(tipo),
            unita_misura = VALUES(unita_misura),
            utente_modifica = 'IMPORT',
            updated_at = CURRENT_TIMESTAMP
    ");
    
    $imported_anagrafica = 0;
    while (($data = fgetcsv($handle)) !== FALSE) {
        if (count($data) >= 4 && !empty(trim($data[0]))) {
            $id = trim($data[0]);
            $categoria = strtoupper(trim($data[1]));
            $tipo = trim($data[2]);
            $um = strtoupper(trim($data[3]));
            
            try {
                $stmt_anagrafica->execute([$id, $categoria, $tipo, $um]);
                $imported_anagrafica++;
                
                if ($imported_anagrafica % 50 == 0) {
                    echo "Importati $imported_anagrafica materiali...\n";
                }
            } catch (PDOException $e) {
                echo "Errore importazione materiale $id: " . $e->getMessage() . "\n";
            }
        }
    }
    fclose($handle);
    echo "Anagrafica importata: $imported_anagrafica materiali\n\n";
    
    // === IMPORTAZIONE GIACENZE ===
    echo "=== IMPORTAZIONE GIACENZE DA CSV ===\n";
    
    $handle = fopen($file_ubicazioni, 'r');
    if (!$handle) {
        throw new Exception("Impossibile aprire il file $file_ubicazioni");
    }
    
    // Salta l'header
    $header = fgetcsv($handle);
    echo "Header giacenze: " . implode(', ', $header) . "\n";
    
    // Prima fase: crea tutte le ubicazioni
    echo "Creazione ubicazioni...\n";
    $ubicazioni_uniche = [];
    while (($data = fgetcsv($handle)) !== FALSE) {
        if (count($data) >= 3 && !empty(trim($data[1]))) {
            $ubicazione = trim($data[1]);
            $ubicazioni_uniche[strtoupper($ubicazione)] = $ubicazione;
        }
    }
    rewind($handle);
    fgetcsv($handle); // Salta di nuovo l'header
    
    $stmt_check_ubicazione = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE UPPER(nome_ubicazione) = UPPER(?)");
    $stmt_create_ubicazione = $conn->prepare("INSERT INTO ubicazioni (nome_ubicazione, user_created) VALUES (UPPER(?), 'IMPORT')");
    
    $ubicazioni_map = [];
    $ubicazioni_create = 0;
    
    foreach ($ubicazioni_uniche as $ubicazione_upper => $ubicazione_originale) {
        $stmt_check_ubicazione->execute([$ubicazione_originale]);
        $ubicazione_id = $stmt_check_ubicazione->fetchColumn();
        
        if (!$ubicazione_id) {
            $stmt_create_ubicazione->execute([$ubicazione_originale]);
            $ubicazione_id = $conn->lastInsertId();
            $ubicazioni_create++;
            echo "Creata ubicazione: $ubicazione_originale (ID: $ubicazione_id)\n";
        }
        
        $ubicazioni_map[$ubicazione_upper] = $ubicazione_id;
    }
    echo "Ubicazioni create: $ubicazioni_create\n";
    
    // Seconda fase: importa le giacenze
    $stmt_giacenze = $conn->prepare("
        INSERT INTO giacenze_materiali (
            codice_materiale, ID_ubicazione, quantita_attuale,
            utente_creazione, utente_modifica
        ) VALUES (?, ?, ?, 'IMPORT', 'IMPORT')
        ON DUPLICATE KEY UPDATE
            quantita_attuale = VALUES(quantita_attuale),
            utente_modifica = 'IMPORT',
            updated_at = CURRENT_TIMESTAMP
    ");
    
    $imported_giacenze = 0;
    $skipped_zero = 0;
    
    while (($data = fgetcsv($handle)) !== FALSE) {
        if (count($data) >= 3 && !empty(trim($data[0])) && !empty(trim($data[1]))) {
            $id_materiale = trim($data[0]);
            $ubicazione = trim($data[1]);
            $quantita = is_numeric($data[2]) ? (float)$data[2] : 0;
            
            // Salta giacenze a zero (opzionale)
            if ($quantita == 0) {
                $skipped_zero++;
                continue;
            }
            
            $ubicazione_upper = strtoupper($ubicazione);
            if (isset($ubicazioni_map[$ubicazione_upper])) {
                $ubicazione_id = $ubicazioni_map[$ubicazione_upper];
                
                try {
                    $stmt_giacenze->execute([$id_materiale, $ubicazione_id, $quantita]);
                    $imported_giacenze++;
                    
                    if ($imported_giacenze % 100 == 0) {
                        echo "Importate $imported_giacenze giacenze...\n";
                    }
                } catch (PDOException $e) {
                    echo "Errore importazione giacenza $id_materiale in $ubicazione: " . $e->getMessage() . "\n";
                }
            }
        }
    }
    fclose($handle);
    
    echo "Giacenze importate: $imported_giacenze\n";
    echo "Giacenze a zero saltate: $skipped_zero\n\n";
    
    generaReport($conn);
}

function creaDatiEsempio($conn) {
    echo "=== CREAZIONE DATI DI ESEMPIO ===\n";
    
    // Crea alcune ubicazioni di esempio
    echo "Creazione ubicazioni di esempio...\n";
    $ubicazioni_esempio = [
        'LABORATORIO',
        'MAGAZZINO_PRINCIPALE', 
        'REPARTO_PRODUZIONE',
        'UFFICIO_TECNICO'
    ];
    
    $stmt_ubicazione = $conn->prepare("
        INSERT INTO ubicazioni (nome_ubicazione, user_created) 
        VALUES (?, 'IMPORT')
        ON DUPLICATE KEY UPDATE nome_ubicazione = nome_ubicazione
    ");
    
    foreach ($ubicazioni_esempio as $ubicazione) {
        $stmt_ubicazione->execute([$ubicazione]);
    }
    
    // Crea materiali di esempio
    echo "Creazione materiali di esempio...\n";
    $materiali_esempio = [
        ['MATE001', 'SOLVENTI', 'Acetone', 'L'],
        ['MATE002', 'SOLVENTI', 'Alcol Etilico', 'L'], 
        ['MATE003', 'PLASTICHE', 'Pellet PVC', 'KG'],
        ['MATE004', 'PLASTICHE', 'Pellet PE', 'KG'],
        ['MATE005', 'CHIMICI', 'Acido Citrico', 'KG'],
        ['MATE006', 'CHIMICI', 'Bicarbonato di Sodio', 'KG'],
        ['MATE007', 'UTENSILI', 'Guanti Nitrile', 'PZ'],
        ['MATE008', 'UTENSILI', 'Mascherine FFP2', 'PZ'],
        ['MATE009', 'CONSUMABILI', 'Carta Assorbente', 'CF'],
        ['MATE010', 'CONSUMABILI', 'Nastro Adesivo', 'PZ']
    ];
    
    $stmt_materiale = $conn->prepare("
        INSERT INTO anagrafica_materiali (
            codice_materiale, categoria, tipo, unita_misura,
            soglia_minima, utente_creazione, utente_modifica
        ) VALUES (?, ?, ?, ?, ?, 'IMPORT', 'IMPORT')
        ON DUPLICATE KEY UPDATE
            categoria = VALUES(categoria),
            tipo = VALUES(tipo),
            unita_misura = VALUES(unita_misura)
    ");
    
    foreach ($materiali_esempio as $materiale) {
        $soglia = rand(1, 5); // Soglia minima casuale
        $stmt_materiale->execute([
            $materiale[0], $materiale[1], $materiale[2], $materiale[3], $soglia
        ]);
    }
    
    // Crea giacenze di esempio
    echo "Creazione giacenze di esempio...\n";
    
    // Ottieni gli ID delle ubicazioni
    $stmt = $conn->query("SELECT ID_ubicazione, nome_ubicazione FROM ubicazioni");
    $ubicazioni_ids = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    
    $stmt_giacenza = $conn->prepare("
        INSERT INTO giacenze_materiali (
            codice_materiale, ID_ubicazione, quantita_attuale,
            utente_creazione, utente_modifica
        ) VALUES (?, ?, ?, 'IMPORT', 'IMPORT')
        ON DUPLICATE KEY UPDATE
            quantita_attuale = VALUES(quantita_attuale)
    ");
    
    $giacenze_create = 0;
    
    foreach ($materiali_esempio as $materiale) {
        foreach ($ubicazioni_ids as $ubicazione_id => $nome_ubicazione) {
            // Non tutti i materiali in tutte le ubicazioni
            if (rand(1, 100) > 70) continue;
            
            $quantita = rand(0, 50) + (rand(0, 100) / 100); // Quantità casuale con decimali
            
            if ($quantita > 0) {
                $stmt_giacenza->execute([$materiale[0], $ubicazione_id, $quantita]);
                $giacenze_create++;
            }
        }
    }
    
    echo "Creati $giacenze_create record di giacenza\n\n";
    
    generaReport($conn);
}

function generaReport($conn) {
    echo "=== REPORT FINALE ===\n";
    
    // Conta materiali
    $stmt = $conn->query("SELECT COUNT(*) FROM anagrafica_materiali");
    $count_materiali = $stmt->fetchColumn();
    echo "Totale materiali in anagrafica: $count_materiali\n";
    
    // Conta giacenze attive
    $stmt = $conn->query("SELECT COUNT(*) FROM giacenze_materiali WHERE quantita_attuale > 0");
    $count_giacenze = $stmt->fetchColumn();
    echo "Totale giacenze attive: $count_giacenze\n";
    
    // Conta ubicazioni
    $stmt = $conn->query("SELECT COUNT(*) FROM ubicazioni");
    $count_ubicazioni = $stmt->fetchColumn();
    echo "Totale ubicazioni: $count_ubicazioni\n";
    
    // Report per categoria
    echo "\nMateriali per categoria:\n";
    $stmt = $conn->query("
        SELECT categoria, COUNT(*) as count 
        FROM anagrafica_materiali 
        GROUP BY categoria 
        ORDER BY count DESC
    ");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "- {$row['categoria']}: {$row['count']} materiali\n";
    }
    
    // Ubicazioni con giacenze
    echo "\nUbicazioni con giacenze:\n";
    $stmt = $conn->query("
        SELECT 
            u.nome_ubicazione, 
            COUNT(gm.id) as num_materiali,
            ROUND(SUM(gm.quantita_attuale), 2) as totale_quantita
        FROM ubicazioni u
        JOIN giacenze_materiali gm ON u.ID_ubicazione = gm.ID_ubicazione
        WHERE gm.quantita_attuale > 0
        GROUP BY u.ID_ubicazione, u.nome_ubicazione
        ORDER BY num_materiali DESC
    ");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "- {$row['nome_ubicazione']}: {$row['num_materiali']} materiali, {$row['totale_quantita']} unità\n";
    }
    
    echo "\n=== IMPORTAZIONE COMPLETATA ===\n";
    echo "Ora puoi testare le API:\n";
    echo "- api_materiali.php?action=getMateriali\n";
    echo "- api_materiali.php?action=getGiacenze\n";
    echo "- api_materiali.php?action=getAlert\n\n";
}
?>