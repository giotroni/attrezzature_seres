<?php
/**
 * Script per importare le attrezzature dal CSV nel database
 * Crea automaticamente le ubicazioni man mano che le trova
 */

require_once 'config.php';

// Configurazione
$csvFile = __DIR__ . '/init/inventario_attrezzature.CSV';
$delimiter = ';';
$username = 'IMPORT_SCRIPT'; // Username per tracking delle creazioni

// Colonne attese nel CSV
$expectedColumns = ['CATEGORIA', 'TIPO', 'MARCA/MODELLO', 'UBICAZIONE', 'CODICE'];

// Funzione per leggere il CSV
function readCsvFile($filename, $delimiter = ',', $expectedColumns = []) {
    $data = [];
    
    if (!file_exists($filename)) {
        throw new Exception("File CSV non trovato: $filename");
    }
    
    $handle = fopen($filename, 'r');
    if ($handle === false) {
        throw new Exception("Impossibile aprire il file CSV: $filename");
    }
    
    // Leggi l'header
    $header = fgetcsv($handle, 0, $delimiter);
    if ($header === false) {
        fclose($handle);
        throw new Exception("Impossibile leggere l'header del CSV");
    }
    
    // Pulisci l'header da eventuali BOM o caratteri nascosti
    $header = array_map(function($col) {
        return trim(str_replace("\xEF\xBB\xBF", '', $col));
    }, $header);

    // Verifica che tutte le colonne attese siano presenti
    foreach ($expectedColumns as $column) {
        if (!in_array($column, $header)) {
            fclose($handle);
            throw new Exception("Colonna mancante nel CSV: $column");
        }
    }
    
    // Leggi i dati
    while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
        if (count($row) === count($header)) {
            $data[] = array_combine($header, $row);
        }
    }
    
    fclose($handle);
    return $data;
}

// Funzione per creare o ottenere ID ubicazione
function getOrCreateUbicazione($conn, $nomeUbicazione, $username) {
    // Controlla se l'ubicazione esiste già
    $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE nome_ubicazione = ?");
    $stmt->execute([$nomeUbicazione]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($result) {
        return $result['ID_ubicazione'];
    }
    
    // Crea nuova ubicazione
    $stmt = $conn->prepare("
        INSERT INTO ubicazioni (nome_ubicazione, user_created) 
        VALUES (?, ?)
    ");
    
    if ($stmt->execute([$nomeUbicazione, $username])) {
        $ubicazioneId = $conn->lastInsertId();
        echo "✓ Creata ubicazione: $nomeUbicazione (ID: $ubicazioneId)\n";
        return $ubicazioneId;
    } else {
        throw new Exception("Errore nella creazione dell'ubicazione: $nomeUbicazione");
    }
}

// Funzione per inserire attrezzatura
function insertAttrezzatura($conn, $data, $ubicazioneId, $username) {
    // Verifica se l'attrezzatura esiste già
    $stmt = $conn->prepare("SELECT codice FROM attrezzature WHERE codice = ?");
    $stmt->execute([$data['CODICE']]);
    if ($stmt->fetch()) {
        throw new Exception("Attrezzatura con codice {$data['CODICE']} già esistente");
    }

    $stmt = $conn->prepare("
        INSERT INTO attrezzature (
            codice, 
            categoria, 
            tipo, 
            marca, 
            ID_ubicazione, 
            utente_creazione
        ) VALUES (?, ?, ?, ?, ?, ?)
    ");
    
    return $stmt->execute([
        $data['CODICE'],
        $data['CATEGORIA'],
        $data['TIPO'],
        $data['MARCA/MODELLO'],
        $ubicazioneId,
        $username
    ]);
}

try {
    echo "=== IMPORTAZIONE ATTREZZATURE DA CSV ===\n\n";
    
    // Connessione al database
    echo "Connessione al database...\n";
    $conn = getConnection();
    
    // Leggi il file CSV
    echo "Lettura file CSV: $csvFile...\n";
    $csvData = readCsvFile($csvFile, $delimiter, $expectedColumns);
    
    echo "Trovati " . count($csvData) . " record nel CSV\n\n";
    
    // Contatori per il report
    $counters = [
        'ubicazioni_create' => 0,
        'attrezzature_inserite' => 0,
        'errori' => 0,
        'ubicazioni_esistenti' => 0
    ];
    
    $ubicazioniCache = []; // Cache per evitare query ripetute
    $errori = [];
    
    // Inizia transazione
    $conn->beginTransaction();
    
    echo "Inizio importazione...\n";
    echo str_repeat("-", 50) . "\n";
    
    foreach ($csvData as $index => $row) {
        $numeroRiga = $index + 2; // +2 perché iniziamo da 1 e saltiamo l'header
        
        try {
            // Valida i dati essenziali
            if (empty($row['CODICE']) || empty($row['CATEGORIA']) || 
                empty($row['TIPO']) || empty($row['UBICAZIONE'])) {
                throw new Exception("Dati mancanti (codice, categoria, tipo o ubicazione)");
            }
            
            $nomeUbicazione = trim($row['UBICAZIONE']);
            
            // Gestisci ubicazioni sconosciute
            if ($nomeUbicazione === '?' || empty($nomeUbicazione)) {
                $nomeUbicazione = 'UBICAZIONE_SCONOSCIUTA';
            }
            
            // Ottieni o crea ubicazione
            if (!isset($ubicazioniCache[$nomeUbicazione])) {
                $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE nome_ubicazione = ?");
                $stmt->execute([$nomeUbicazione]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($result) {
                    $ubicazioniCache[$nomeUbicazione] = $result['ID_ubicazione'];
                    $counters['ubicazioni_esistenti']++;
                } else {
                    $ubicazioniCache[$nomeUbicazione] = getOrCreateUbicazione($conn, $nomeUbicazione, $username);
                    $counters['ubicazioni_create']++;
                }
            }
            
            $ubicazioneId = $ubicazioniCache[$nomeUbicazione];
            
            // Inserisci attrezzatura
            if (insertAttrezzatura($conn, $row, $ubicazioneId, $username)) {
                $counters['attrezzature_inserite']++;
                echo "✓ Riga $numeroRiga: {$row['CODICE']} - {$row['TIPO']} → $nomeUbicazione\n";
            } else {
                throw new Exception("Errore nell'inserimento dell'attrezzatura");
            }
            
        } catch (Exception $e) {
            $counters['errori']++;
            $errorMsg = "✗ Riga $numeroRiga: " . $e->getMessage() . " - Dati: " . json_encode($row);
            $errori[] = $errorMsg;
            echo $errorMsg . "\n";
        }
    }
    
    // Commit della transazione
    $conn->commit();
    
    echo str_repeat("-", 50) . "\n";
    echo "=== REPORT IMPORTAZIONE ===\n\n";
    
    echo "Ubicazioni create: " . $counters['ubicazioni_create'] . "\n";
    echo "Ubicazioni esistenti: " . $counters['ubicazioni_esistenti'] . "\n";
    echo "Attrezzature inserite: " . $counters['attrezzature_inserite'] . "\n";
    echo "Errori: " . $counters['errori'] . "\n";
    echo "Totale record processati: " . count($csvData) . "\n\n";
    
    if ($counters['errori'] > 0) {
        echo "=== DETTAGLIO ERRORI ===\n";
        foreach ($errori as $errore) {
            echo $errore . "\n";
        }
        echo "\n";
    }
    
    // Mostra le ubicazioni create
    if ($counters['ubicazioni_create'] > 0) {
        echo "=== UBICAZIONI CREATE ===\n";
        $stmt = $conn->prepare("
            SELECT ID_ubicazione, nome_ubicazione, created_at 
            FROM ubicazioni 
            WHERE user_created = ? 
            ORDER BY created_at DESC
        ");
        $stmt->execute([$username]);
        
        while ($ubicazione = $stmt->fetch(PDO::FETCH_ASSOC)) {
            echo "ID {$ubicazione['ID_ubicazione']}: {$ubicazione['nome_ubicazione']} (creata: {$ubicazione['created_at']})\n";
        }
        echo "\n";
    }
    
    // Statistiche per categoria
    echo "=== STATISTICHE PER CATEGORIA ===\n";
    $stmt = $conn->prepare("
        SELECT categoria, COUNT(*) as totale 
        FROM attrezzature 
        WHERE utente_creazione = ? 
        GROUP BY categoria 
        ORDER BY totale DESC
    ");
    $stmt->execute([$username]);
    
    while ($stat = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "{$stat['categoria']}: {$stat['totale']} attrezzature\n";
    }
    
    echo "\n=== IMPORTAZIONE COMPLETATA ===\n";
    
    // Log dell'operazione
    logApiEvent(
        $conn,
        'import_csv_attrezzature',
        ['file' => $csvFile, 'total_records' => count($csvData)],
        200,
        $counters,
        $counters['errori'] > 0 ? 'Importazione completata con errori' : null
    );
    
} catch (Exception $e) {
    // Rollback in caso di errore grave
    if (isset($conn) && $conn->inTransaction()) {
        $conn->rollback();
    }
    
    echo "\n!!! ERRORE GRAVE !!!\n";
    echo $e->getMessage() . "\n";
    echo "Importazione annullata.\n";
    
    if (isset($conn)) {
        logApiEvent($conn, 'import_csv_attrezzature', ['file' => $csvFile], 500, null, $e->getMessage());
    }
    
    exit(1);
}
?>