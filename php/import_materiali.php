<?php
/**
 * Script per importare i dati dei materiali dai file CSV
 * I file devono essere nella cartella init:
 *    - init/anagrafica_materiali.csv (con colonne: ID,CATEGORIA,TIPO,UM)
 *    - init/ubicazione_materiali.csv (con colonne: ID,Ubicazione,Valore)
 */

// Abilita la visualizzazione degli errori per debug
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'config.php';

try {
    $conn = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "=== IMPORTAZIONE MATERIALI ===\n\n";

    // Percorsi dei file CSV
    $file_anagrafica = __DIR__ . '/init/anagrafica_materiali.CSV';
    $file_ubicazioni = __DIR__ . '/init/ubicazione_materiali.CSV';
    
    if (file_exists($file_anagrafica) && file_exists($file_ubicazioni)) {
        echo "File CSV trovati, procedo con l'importazione...\n\n";
        importazioneCSV($conn, $file_anagrafica, $file_ubicazioni);
    } else {
        echo "ERRORE: File CSV non trovati!\n";
        echo "Cerco in: " . dirname($file_anagrafica) . "\n";
        echo "File richiesti:\n";
        echo "- anagrafica_materiali.CSV\n";
        echo "- ubicazione_materiali.CSV\n";
        exit(1);
    }

} catch (Exception $e) {
    echo "ERRORE: " . $e->getMessage() . "\n";
    echo "Traccia completa:\n" . $e->getTraceAsString() . "\n";
}

function importazioneCSV($conn, $file_anagrafica, $file_ubicazioni) {
    // Imposta la codifica della connessione
    $conn->exec("SET NAMES 'utf8mb4'");
    $conn->exec("SET CHARACTER SET utf8mb4");
    $conn->exec("SET SESSION collation_connection = 'utf8mb4_unicode_ci'");

    echo "=== IMPORTAZIONE ANAGRAFICA DA CSV ===\n";
    
    // Importa anagrafica materiali
    $handle = fopen($file_anagrafica, 'r');
    if (!$handle) {
        throw new Exception("Impossibile aprire il file $file_anagrafica");
    }

    // Determina la codifica del file
    $bom = fread($handle, 3);
    rewind($handle);
    $encoding = 'UTF-8';
    if ($bom === "\xEF\xBB\xBF") {
        $encoding = 'UTF-8';
    } elseif (mb_detect_encoding(fread($handle, 1024), 'UTF-8, ISO-8859-1, ISO-8859-15', true) === 'ISO-8859-1') {
        $encoding = 'ISO-8859-1';
    }
    rewind($handle);
    if ($encoding === 'UTF-8' && $bom === "\xEF\xBB\xBF") {
        fseek($handle, 3); // Salta il BOM se presente
    }
    
    // Leggi l'header e puliscilo
    $header = fgetcsv($handle, 0, ';'); // Specifico il delimiter ;
    if (!$header) {
        fclose($handle);
        throw new Exception("Impossibile leggere l'header del CSV");
    }

    // Pulisci l'header e converti in UTF-8 se necessario
    $header = array_map(function($col) use ($encoding) {
        $col = trim($col);
        if ($encoding !== 'UTF-8') {
            $col = iconv($encoding, 'UTF-8//IGNORE', $col);
        }
        return strtoupper($col);
    }, $header);

    echo "Header trovato nel file: " . implode(', ', $header) . "\n";

    // Mappa delle colonne attese con possibili alternative
    $column_map = [
        'ID' => ['ID', 'CODICE', 'CODICE_MATERIALE'],
        'CATEGORIA' => ['CATEGORIA', 'CAT'],
        'TIPO' => ['TIPO', 'DESCRIZIONE', 'DESC'],
        'UM' => ['UM', 'UNITA_MISURA', 'U.M.', 'UDM']
    ];

    // Trova le colonne nel file
    $column_indices = [];
    foreach ($column_map as $required_col => $possible_names) {
        $found = false;
        foreach ($possible_names as $name) {
            $index = array_search(strtoupper($name), $header);
            if ($index !== false) {
                $column_indices[$required_col] = $index;
                $found = true;
                break;
            }
        }
        if (!$found) {
            fclose($handle);
            throw new Exception("Colonna $required_col non trovata. Cercata come: " . implode(', ', $possible_names));
        }
    }

    echo "\nMappatura colonne trovata:\n";
    foreach ($column_indices as $col => $index) {
        echo "- $col -> {$header[$index]}\n";
    }
    
    // Prepara statement per anagrafica
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
    $riga = 2; // Contatore righe per debug (partendo da 2 perché l'header è riga 1)
    
    while (($data = fgetcsv($handle, 0, ';')) !== FALSE) {
        if (count($data) >= max($column_indices) + 1) {
            $id = trim($data[$column_indices['ID']]);
            $categoria = strtoupper(trim($data[$column_indices['CATEGORIA']]));
            $tipo = trim($data[$column_indices['TIPO']]);
            if ($encoding !== 'UTF-8') {
                $tipo = iconv($encoding, 'UTF-8//IGNORE', $tipo);
            }
            $um = strtoupper(trim($data[$column_indices['UM']]));

            if (!empty($id)) {
                try {
                    $stmt_anagrafica->execute([$id, $categoria, $tipo, $um]);
                    $imported_anagrafica++;
                    
                    if ($imported_anagrafica % 50 == 0) {
                        echo "Importati $imported_anagrafica materiali...\n";
                    }
                } catch (PDOException $e) {
                    echo "Errore importazione materiale alla riga $riga (ID: $id): " . $e->getMessage() . "\n";
                    echo "Dati: " . json_encode(['categoria' => $categoria, 'tipo' => $tipo, 'um' => $um], JSON_UNESCAPED_UNICODE) . "\n";
                }
            }
        } else if (!empty(array_filter($data))) {
            echo "Warning: Dati incompleti alla riga $riga: " . implode(', ', $data) . "\n";
        }
        $riga++;
    }
    fclose($handle);
    echo "Anagrafica importata: $imported_anagrafica materiali\n\n";
    
    // === IMPORTAZIONE GIACENZE ===
    echo "=== IMPORTAZIONE GIACENZE DA CSV ===\n";
    
    $handle = fopen($file_ubicazioni, 'r');
    if (!$handle) {
        throw new Exception("Impossibile aprire il file $file_ubicazioni");
    }
    
    // Salta l'header e verifica le colonne
    $header = fgetcsv($handle, 0, ';');
    if (!$header) {
        fclose($handle);
        throw new Exception("Impossibile leggere l'header del file ubicazioni");
    }
    
    // Pulisci e normalizza l'header
    $header = array_map(function($col) {
        return strtoupper(trim(str_replace("\xEF\xBB\xBF", '', $col)));
    }, $header);
    
    echo "Header giacenze trovato: " . implode(', ', $header) . "\n";
    
    // Mappa delle colonne per il file ubicazioni
    $ubicazioni_column_map = [
        'ID' => ['ID', 'CODICE', 'CODICE_MATERIALE'],
        'UBICAZIONE' => ['UBICAZIONE', 'MAGAZZINO', 'DEPOSITO', 'LUOGO'],
        'VALORE' => ['VALORE', 'QUANTITA', 'QTA', 'GIACENZA']
    ];
    
    // Trova gli indici delle colonne
    $ubicazioni_indices = [];
    foreach ($ubicazioni_column_map as $required_col => $possible_names) {
        $found = false;
        foreach ($possible_names as $name) {
            $index = array_search(strtoupper($name), $header);
            if ($index !== false) {
                $ubicazioni_indices[$required_col] = $index;
                $found = true;
                break;
            }
        }
        if (!$found) {
            fclose($handle);
            throw new Exception("Colonna $required_col non trovata nel file ubicazioni. Cercata come: " . implode(', ', $possible_names));
        }
    }

    echo "\nMappatura colonne ubicazioni:\n";
    foreach ($ubicazioni_indices as $col => $index) {
        echo "- $col -> {$header[$index]}\n";
    }
    
    // Prima fase: crea tutte le ubicazioni
    echo "Creazione ubicazioni...\n";
    $ubicazioni_uniche = [];
    rewind($handle);
    fgetcsv($handle); // Salta l'header
    
    while (($data = fgetcsv($handle, 0, ';')) !== FALSE) {
        if (count($data) >= max($ubicazioni_indices) + 1) {
            $ubicazione = trim($data[$ubicazioni_indices['UBICAZIONE']]);
            if (!empty($ubicazione)) {
                $ubicazioni_uniche[strtoupper($ubicazione)] = $ubicazione;
            }
        }
    }
    
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
    rewind($handle);
    fgetcsv($handle); // Salta l'header
    
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
    $riga = 2;
    
    while (($data = fgetcsv($handle, 0, ';')) !== FALSE) {
        if (count($data) >= max($ubicazioni_indices) + 1) {
            $id_materiale = trim($data[$ubicazioni_indices['ID']]);
            $ubicazione = trim($data[$ubicazioni_indices['UBICAZIONE']]);
            $quantita = str_replace(',', '.', trim($data[$ubicazioni_indices['VALORE']]));
            $quantita = is_numeric($quantita) ? (float)$quantita : 0;
            
            if (!empty($id_materiale) && !empty($ubicazione)) {
                // Salta giacenze a zero
                if ($quantita == 0) {
                    $skipped_zero++;
                    $riga++;
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
                        echo "Errore importazione giacenza alla riga $riga (ID: $id_materiale, Ubicazione: $ubicazione): " . $e->getMessage() . "\n";
                    }
                } else {
                    echo "Warning: Ubicazione non trovata alla riga $riga: $ubicazione\n";
                }
            } else if (!empty(array_filter($data))) {
                echo "Warning: Dati incompleti alla riga $riga: " . implode(', ', $data) . "\n";
            }
        }
        $riga++;
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