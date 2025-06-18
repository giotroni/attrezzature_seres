<?php
require_once 'config.php';

// Funzione per pulire e validare i dati
function cleanData($data) {
    return trim(str_replace(array("\r", "\n"), ' ', $data));
}

// Funzione per importare dati da CSV
function importFromCSV($conn, $csvFile) {
    $results = array(
        'total' => 0,
        'imported' => 0,
        'skipped' => 0,
        'errors' => 0,
        'error_details' => array()
    );    if (($handle = fopen($csvFile, "r")) !== FALSE) {
        // Skip header row
        fgetcsv($handle, 0, ";");  // Specifica il punto e virgola come separatore
        
        while (($data = fgetcsv($handle, 0, ";")) !== FALSE) {  // Specifica il punto e virgola come separatore
            $results['total']++;
            
            // Assicurati che ci siano tutti i campi necessari
            if (count($data) < 7) {
                $results['errors']++;
                $results['error_details'][] = "Riga {$results['total']}: numero di campi non valido";
                continue;
            }

            // Pulisci i dati
            $categoria = cleanData($data[0]);
            $tipo = cleanData($data[1]);
            $marca = cleanData($data[2]);
            $ubicazione = cleanData($data[3]);
            $codice = cleanData($data[4]);
            $note = cleanData($data[5]);
            $doc = cleanData($data[6]);

            // Verifica che il codice non sia vuoto
            if (empty($codice)) {
                $results['errors']++;
                $results['error_details'][] = "Riga {$results['total']}: codice mancante";
                continue;
            }

            try {
                // Verifica se il codice esiste già
                $stmt = $conn->prepare("SELECT codice FROM attrezzature WHERE codice = ?");
                $stmt->execute([$codice]);
                
                if ($stmt->rowCount() > 0) {
                    $results['skipped']++;
                    $results['error_details'][] = "Riga {$results['total']}: codice '$codice' già presente nel database";
                    continue;
                }

                // Inserisci il nuovo record
                $stmt = $conn->prepare("INSERT INTO attrezzature (codice, categoria, tipo, marca, ubicazione, note, doc) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([$codice, $categoria, $tipo, $marca, $ubicazione, $note, $doc]);
                
                $results['imported']++;
                
            } catch (PDOException $e) {
                $results['errors']++;
                $results['error_details'][] = "Riga {$results['total']}: " . $e->getMessage();
            }
        }
        fclose($handle);
    }
    
    return $results;
}

try {
    $conn = new PDO("mysql:host=" . DB_HOST, DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Crea il database se non esiste
    $sql = "CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
    $conn->exec($sql);
    
    // Seleziona il database
    $conn->exec("USE " . DB_NAME);

    // Crea tabella attrezzature con il nuovo campo DOC
    $sql = "CREATE TABLE IF NOT EXISTS attrezzature (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codice VARCHAR(50) UNIQUE NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        marca VARCHAR(200) NOT NULL,
        ubicazione VARCHAR(100) NOT NULL,
        doc VARCHAR(500),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )";
    $conn->exec($sql);

    // Aggiungi il campo DOC se non esiste già
    try {
        $conn->exec("ALTER TABLE attrezzature ADD COLUMN doc VARCHAR(500)");
        echo "Campo DOC aggiunto con successo!\n";
    } catch(PDOException $e) {
        if($e->getCode() != '42S21') { // Ignora errore se la colonna esiste già
            throw $e;
        }
    }

    // Crea tabella log
    $sql = "CREATE TABLE IF NOT EXISTS log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        azione VARCHAR(200) NOT NULL,
        tipo_oggetto VARCHAR(50) NOT NULL,
        codice VARCHAR(50) NOT NULL,
        vecchia_ubicazione VARCHAR(100),
        nuova_ubicazione VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )";
    $conn->exec($sql);

    // Crea tabella LogEvent per il logging delle API
    $sql = "CREATE TABLE IF NOT EXISTS LogEvent (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45) NOT NULL,
        request_method VARCHAR(10) NOT NULL,
        api_endpoint VARCHAR(100) NOT NULL,
        action VARCHAR(50) NOT NULL,
        request_data TEXT,
        response_code INT,
        response_data TEXT,
        error_message TEXT,
        execution_time FLOAT,
        user_agent VARCHAR(255),
        status ENUM('success', 'error') NOT NULL,
        INDEX idx_timestamp (timestamp),
        INDEX idx_action (action),
        INDEX idx_status (status)
    ) ENGINE=InnoDB";
    $conn->exec($sql);

    echo "Database e tabelle create con successo!\n";

    // Importa dati dal CSV se il file esiste
    $csvFile = __DIR__ . '/../INVENTARIO_SERES_copia.CSV';
    if (file_exists($csvFile)) {
        $results = importFromCSV($conn, $csvFile);
        echo "\nRisultati importazione CSV:\n";
        echo "Totale righe processate: {$results['total']}\n";
        echo "Righe importate con successo: {$results['imported']}\n";
        echo "Righe saltate (duplicati): {$results['skipped']}\n";
        echo "Errori riscontrati: {$results['errors']}\n";
        
        if (!empty($results['error_details'])) {
            echo "\nDettaglio errori:\n";
            foreach ($results['error_details'] as $error) {
                echo "- $error\n";
            }
        }
    } else {
        echo "\nFile CSV non trovato: $csvFile\n";
    }

} catch(PDOException $e) {
    echo "Errore: " . $e->getMessage();
}
?>
