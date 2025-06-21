<?php
// Abilita la visualizzazione degli errori
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Log per debug
error_log("=== Inizio richiesta API ===");

try {
    // Carica configurazione (che gestisce anche CORS)
    if (!file_exists('config.php')) {
        throw new Exception('File config.php non trovato');
    }
    require_once 'config.php';
    
    // Imposta header JSON (CORS già gestito in config.php)
    header('Content-Type: application/json');
    
    // Connessione al database
    error_log("Tentativo connessione DB");
    $conn = new PDO(
        "mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    error_log("Connessione DB riuscita");

    // Funzione per generare il prossimo codice ATTR
    function getNextProgressiveCode($conn) {
        try {
            // Trova il massimo codice numerico esistente
            $stmt = $conn->query("SELECT MAX(CAST(SUBSTRING(codice, 5) AS UNSIGNED)) as max_num FROM attrezzature WHERE codice LIKE 'ATTR%'");
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Se non ci sono codici, parti da 1, altrimenti incrementa
            $nextNum = ($result['max_num'] === null) ? 1 : $result['max_num'] + 1;
            
            // Formatta il codice con padding di zeri
            return 'ATTR' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);
        } catch(PDOException $e) {
            error_log("Errore nella generazione del codice: " . $e->getMessage());
            throw new Exception("Errore nella generazione del codice progressivo");
        }
    }

    // Determina l'azione richiesta
    $action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : 'getData');

    if ($action === 'getData') {
        try {
            // Log inizio chiamata API
            error_log("logApiEvent: tentativo log inizio getData");
            if (function_exists('logApiEvent')) {
                $logResult = logApiEvent($conn, 'getData', $_GET, 100, null, 'Inizio richiesta getData');
                error_log("logApiEvent risultato inizio: " . ($logResult ? 'success' : 'failed'));
            } else {
                error_log("logApiEvent: funzione non trovata");
            }

            // Query con JOIN per ottenere i dettagli dell'ubicazione
            error_log("Esecuzione query SELECT con JOIN");
            $result = $conn->query("
                SELECT a.*, u.nome_ubicazione, u.indirizzo 
                FROM attrezzature a 
                JOIN ubicazioni u ON a.ID_ubicazione = u.ID_ubicazione 
                ORDER BY a.codice
            ");
            $data = $result->fetchAll(PDO::FETCH_ASSOC);
            error_log("Query completata - " . count($data) . " record trovati");

            // Log successo chiamata API
            error_log("logApiEvent: tentativo log successo getData");
            if (function_exists('logApiEvent')) {
                $logResult = logApiEvent($conn, 'getData', $_GET, 200, [
                    'count' => count($data),
                    'query_status' => 'success'
                ], null);
                error_log("logApiEvent risultato successo: " . ($logResult ? 'success' : 'failed'));
            }

            // Risposta JSON
            echo json_encode([
                'success' => true,
                'count' => count($data),
                'data' => $data
            ]);
        } catch (Exception $e) {
            // Log errore getData
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getData', $_GET, 500, null, 'Errore getData: ' . $e->getMessage());
            }
            echo json_encode([
                'success' => false,
                'message' => 'Errore durante il recupero dei dati: ' . $e->getMessage()
            ]);
        }
        
    } else if ($action === 'updateNotes') {
        // SEMPLIFICATO: Gestione aggiornamento note con storico
        if (!isset($_POST['codice']) || !isset($_POST['note']) || !isset($_POST['userName'])) {
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'updateNotes', $_POST, 400, null, 'Parametri mancanti');
            }
            echo json_encode([
                'success' => false,
                'message' => 'Parametri mancanti: codice, note e userName sono richiesti'
            ]);
            exit;
        }

        try {
            // Inizia la transazione per garantire la consistenza
            $conn->beginTransaction();

            // 1. Aggiorna le note e l'utente che ha fatto la modifica nella tabella attrezzature
            $stmt = $conn->prepare("UPDATE attrezzature SET note = ?, utente_modifica = ? WHERE codice = ?");
            $stmt->execute([$_POST['note'], strtoupper($_POST['userName']), $_POST['codice']]);

            if ($stmt->rowCount() === 0) {
                // Verifica se l'attrezzatura esiste
                $stmt = $conn->prepare("SELECT codice FROM attrezzature WHERE codice = ?");
                $stmt->execute([$_POST['codice']]);
                if ($stmt->rowCount() === 0) {
                    throw new Exception("Attrezzatura non trovata");
                }
            }

            // 2. Inserisci il log nella tabella logNote (SEMPLIFICATA)
            $stmt = $conn->prepare(
                "INSERT INTO LogToolsNotes (
                    timestamp,
                    user_name,
                    codice,
                    nota
                ) VALUES (NOW(), ?, ?, ?)"
            );
            if (!$stmt->execute([
                strtoupper($_POST['userName']), // MAIUSCOLO
                $_POST['codice'],
                $_POST['note']
            ])) {
                throw new Exception("Errore durante l'inserimento del log note");
            }

            // 3. Log evento API
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'updateNotes', $_POST, 200, [
                    'codice' => $_POST['codice'],
                    'nota' => $_POST['note'],
                    'userName' => $_POST['userName']
                ], null);
            }

            // 4. Commit della transazione
            $conn->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Note aggiornate con successo'
            ]);

        } catch (Exception $e) {
            $conn->rollBack();
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'updateNotes', $_POST, 500, null, $e->getMessage());
            }
            echo json_encode([
                'success' => false,
                'message' => 'Errore durante l\'aggiornamento delle note: ' . $e->getMessage()
            ]);
        }
        
    } else if ($action === 'getNotesHistory') {
        // SEMPLIFICATO: Endpoint per recuperare lo storico delle note
        try {
            // Log inizio chiamata
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getNotesHistory', $_GET, 100, null, 'Inizio richiesta getNotesHistory');
            }

            // Prepara la query di base (SEMPLIFICATA)
            $query = "
                SELECT 
                    timestamp,
                    user_name,
                    codice,
                    nota
                FROM LogToolsNotes 
                WHERE 1=1
            ";
            $params = [];

            // Se è specificato un codice, filtra per quel codice
            if (isset($_GET['codice'])) {
                $query .= " AND codice = ?";
                $params[] = $_GET['codice'];
            }

            // Ordina per timestamp decrescente (più recenti prima)
            $query .= " ORDER BY timestamp DESC";

            // Limita il numero di risultati se specificato
            if (isset($_GET['limit']) && is_numeric($_GET['limit'])) {
                $query .= " LIMIT ?";
                $params[] = (int)$_GET['limit'];
            }

            $stmt = $conn->prepare($query);
            $stmt->execute($params);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Log successo
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getNotesHistory', $_GET, 200, [
                    'count' => count($history),
                    'filtered_by_codice' => isset($_GET['codice']) ? $_GET['codice'] : null
                ], null);
            }

            echo json_encode([
                'success' => true,
                'count' => count($history),
                'data' => $history
            ]);

        } catch (Exception $e) {
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getNotesHistory', $_GET, 500, null, $e->getMessage());
            }
            echo json_encode([
                'success' => false,
                'message' => 'Errore durante il recupero dello storico note: ' . $e->getMessage()
            ]);
        }
        
    } else if ($action === 'getMovementHistory') {
        try {
            // Log inizio chiamata
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getMovementHistory', $_GET, 100, null, 'Inizio richiesta getMovementHistory');
            }

            // Prepara la query di base
            $query = "
                SELECT 
                    m.timestamp,
                    m.user_name,
                    m.azione,
                    m.tipo_oggetto,
                    m.codice,
                    m.vecchia_ubicazione_id,
                    m.nuova_ubicazione_id,
                    u_old.nome_ubicazione as vecchia_ubicazione,
                    u_new.nome_ubicazione as nuova_ubicazione
                FROM LogToolsMovements m
                LEFT JOIN ubicazioni u_old ON m.vecchia_ubicazione_id = u_old.ID_ubicazione
                LEFT JOIN ubicazioni u_new ON m.nuova_ubicazione_id = u_new.ID_ubicazione
                WHERE m.azione IN ('spostamento')
            ";
            $params = [];

            // Se è specificato un codice, filtra per quel codice
            if (isset($_GET['codice'])) {
                $query .= " AND codice = ?";
                $params[] = $_GET['codice'];
            }

            // Ordina per timestamp decrescente (più recenti prima)
            $query .= " ORDER BY timestamp DESC";

            // Limita il numero di risultati se specificato
            if (isset($_GET['limit']) && is_numeric($_GET['limit'])) {
                $query .= " LIMIT ?";
                $params[] = (int)$_GET['limit'];
            }

            $stmt = $conn->prepare($query);
            $stmt->execute($params);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Log successo
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getMovementHistory', $_GET, 200, [
                    'count' => count($history),
                    'filtered_by_codice' => isset($_GET['codice']) ? $_GET['codice'] : null
                ], null);
            }

            echo json_encode([
                'success' => true,
                'count' => count($history),
                'data' => $history
            ]);

        } catch (Exception $e) {
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getMovementHistory', $_GET, 500, null, $e->getMessage());
            }
            echo json_encode([
                'success' => false,
                'message' => 'Errore durante il recupero dello storico: ' . $e->getMessage()
            ]);
        }

    } else if ($action === 'moveEquipment') {
        // Verifica che i parametri necessari siano presenti
        if (!isset($_POST['codice']) || !isset($_POST['newLocation']) || !isset($_POST['userName'])) {
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'moveEquipment', $_POST, 400, null, 'Parametri mancanti');
            }
            echo json_encode([
                'success' => false,
                'message' => 'Parametri mancanti: codice, newLocation e userName sono richiesti'
            ]);
            exit;
        }
        
        try {
            $conn->beginTransaction();

            // 1. Verifica se l'ubicazione esiste o creala
            $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE UPPER(nome_ubicazione) = UPPER(?)");
            $stmt->execute([trim($_POST['newLocation'])]);
            $newLocationId = $stmt->fetchColumn();

            if ($newLocationId === false) {
                // Crea la nuova ubicazione
                $stmt = $conn->prepare("INSERT INTO ubicazioni (nome_ubicazione, user_created) VALUES (UPPER(?), ?)");
                $stmt->execute([trim($_POST['newLocation']), strtoupper($_POST['userName'])]);
                $newLocationId = $conn->lastInsertId();
            }

            // 2. Ottieni la vecchia ubicazione
            $stmt = $conn->prepare("
                SELECT a.ID_ubicazione, u.nome_ubicazione 
                FROM attrezzature a 
                JOIN ubicazioni u ON a.ID_ubicazione = u.ID_ubicazione 
                WHERE a.codice = ?
            ");
            $stmt->execute([$_POST['codice']]);
            $oldLocation = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$oldLocation) {
                throw new Exception("Attrezzatura non trovata");
            }

            // 3. Aggiorna l'ubicazione e l'utente che ha fatto la modifica
            $stmt = $conn->prepare("
                UPDATE attrezzature 
                SET ID_ubicazione = ?, utente_modifica = ? 
                WHERE codice = ?
            ");
            $stmt->execute([$newLocationId, strtoupper($_POST['userName']), $_POST['codice']]);

            if ($stmt->rowCount() === 0) {
                throw new Exception("Errore nell'aggiornamento dell'ubicazione");
            }

            // 4. Inserisci il log del movimento
            $stmt = $conn->prepare("
                INSERT INTO LogToolsMovements (
                    timestamp,
                    user_name,
                    azione,
                    tipo_oggetto,
                    codice,
                    vecchia_ubicazione_id,
                    nuova_ubicazione_id
                ) VALUES (NOW(), ?, 'spostamento', 'attrezzatura', ?, ?, ?)
            ");
            
            if (!$stmt->execute([
                strtoupper($_POST['userName']),
                $_POST['codice'],
                $oldLocation['ID_ubicazione'],
                $newLocationId
            ])) {
                throw new Exception("Errore durante l'inserimento del log");
            }

            // 5. Log evento API
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'moveEquipment', $_POST, 200, [
                    'codice' => $_POST['codice'],
                    'oldLocation' => $oldLocation['nome_ubicazione'],
                    'newLocation' => $_POST['newLocation'],
                    'userName' => $_POST['userName']
                ], null);
            }

            // 6. Commit della transazione
            $conn->commit();

            echo json_encode([
                'success' => true,
                'message' => 'Attrezzatura spostata con successo'
            ]);
        } catch (Exception $e) {
            // Rollback in caso di errore
            $conn->rollBack();
            
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'moveEquipment', $_POST, 500, null, $e->getMessage());
            }
            echo json_encode([
                'success' => false,
                'message' => 'Errore durante lo spostamento: ' . $e->getMessage()
            ]);
        }

    } else if ($action === 'createEquipment') {
        try {
            // Ottieni i dati dalla query string
            $inputData = [
                'categoria' => $_GET['categoria'] ?? '',
                'tipo' => $_GET['tipo'] ?? '',
                'marca' => $_GET['marca'] ?? '',
                'ubicazione' => $_GET['ubicazione'] ?? '',
                'userName' => $_GET['userName'] ?? '',
                'note' => $_GET['note'] ?? '',
                'doc' => $_GET['doc'] ?? ''
            ];
            
            // Verifica i campi obbligatori
            $requiredFields = ['categoria', 'tipo', 'marca', 'ubicazione', 'userName'];
            foreach ($requiredFields as $field) {
                if (empty($inputData[$field])) {
                    throw new Exception("Campo obbligatorio mancante: $field");
                }
            }

            // Log inizio operazione
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'createEquipment', $inputData, 100, null, 'Inizio creazione nuova attrezzatura');
            }

            // Genera il nuovo codice progressivo
            $newCode = getNextProgressiveCode($conn);

            // Inizia la transazione
            $conn->beginTransaction();

            // 1. Verifica se l'ubicazione esiste o creala
            $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE UPPER(nome_ubicazione) = UPPER(?)");
            $stmt->execute([trim($inputData['ubicazione'])]);
            $locationId = $stmt->fetchColumn();

            if ($locationId === false) {
                // Crea la nuova ubicazione
                $stmt = $conn->prepare("INSERT INTO ubicazioni (nome_ubicazione, user_created) VALUES (UPPER(?), ?)");
                $stmt->execute([trim($inputData['ubicazione']), strtoupper($inputData['userName'])]);
                $locationId = $conn->lastInsertId();
            }

            // 2. Inserisci la nuova attrezzatura
            $stmt = $conn->prepare("
                INSERT INTO attrezzature (
                    codice,
                    categoria,
                    tipo,
                    marca,
                    ID_ubicazione,
                    note,
                    doc,
                    utente_creazione,
                    utente_modifica
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $result = $stmt->execute([
                $newCode,
                strtoupper($inputData['categoria']),
                strtoupper($inputData['tipo']),
                $inputData['marca'],
                $locationId,
                $inputData['note'] ?? '',
                $inputData['doc'] ?? '',
                strtoupper($inputData['userName']),
                strtoupper($inputData['userName'])
            ]);

            if (!$result) {
                throw new Exception("Errore nell'inserimento dell'attrezzatura");
            }

            // 3. Registra nel log
            $stmt = $conn->prepare("
                INSERT INTO LogToolsMovements (
                    timestamp,
                    user_name,
                    azione,
                    tipo_oggetto,
                    codice,
                    nuova_ubicazione_id
                ) VALUES (NOW(), ?, 'creazione', 'attrezzatura', ?, ?)
            ");

            $stmt->execute([
                strtoupper($inputData['userName']),
                $newCode,
                $locationId
            ]);

            // Commit della transazione
            $conn->commit();

            // Log successo operazione
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'createEquipment', $inputData, 200, [
                    'codice' => $newCode,
                    'categoria' => $inputData['categoria'],
                    'tipo' => $inputData['tipo']
                ], null);
            }

            // Risposta di successo
            echo json_encode([
                'success' => true,
                'message' => 'Attrezzatura creata con successo',
                'codice' => $newCode
            ]);

        } catch (Exception $e) {
            // Rollback in caso di errore
            if ($conn->inTransaction()) {
                $conn->rollBack();
            }

            // Log errore
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'createEquipment', $inputData ?? [], 500, null, $e->getMessage());
            }

            // Risposta di errore
            echo json_encode([
                'success' => false,
                'message' => 'Errore durante la creazione dell\'attrezzatura: ' . $e->getMessage()
            ]);
        }

    } else if ($action === 'getLocations') {
        try {
            // Log inizio chiamata API
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getLocations', $_GET, 100, null, 'Inizio richiesta getLocations');
            }

            $query = "
                SELECT 
                    u.ID_ubicazione,
                    u.nome_ubicazione,
                    u.indirizzo,
                    u.user_created,
                    u.user_modified,
                    u.created_at,
                    u.modified_at,
                    COUNT(a.id) as num_attrezzature
                FROM ubicazioni u
                LEFT JOIN attrezzature a ON u.ID_ubicazione = a.ID_ubicazione
                GROUP BY u.ID_ubicazione
                ORDER BY u.nome_ubicazione
            ";

            $result = $conn->query($query);
            $locations = $result->fetchAll(PDO::FETCH_ASSOC);

            // Log successo
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getLocations', $_GET, 200, [
                    'count' => count($locations)
                ], null);
            }

            echo json_encode([
                'success' => true,
                'count' => count($locations),
                'data' => $locations
            ]);

        } catch (Exception $e) {
            if (function_exists('logApiEvent')) {
                logApiEvent($conn, 'getLocations', $_GET, 500, null, $e->getMessage());
            }
            echo json_encode([
                'success' => false,
                'message' => 'Errore durante il recupero delle ubicazioni: ' . $e->getMessage()
            ]);
        }

    } else {
        if (function_exists('logApiEvent')) {
            logApiEvent($conn, $action ?: 'unknown', $_GET, 400, null, 'Azione non specificata');
        }
        echo json_encode([
            'success' => false,
            'message' => 'Azione non specificata. Usa ?action=getData'
        ]);
    }
    
} catch (PDOException $e) {
    error_log("ERRORE DB: " . $e->getMessage());
    
    // Log errore database (solo se $conn è definito)
    if (isset($conn) && function_exists('logApiEvent')) {
        logApiEvent($conn, $action ?? 'unknown', $_REQUEST, 500, null, 'Errore database: ' . $e->getMessage());
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Errore database: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("ERRORE GENERICO: " . $e->getMessage());
    
    // Log errore generico (solo se $conn è definito)
    if (isset($conn) && function_exists('logApiEvent')) {
        logApiEvent($conn, $action ?? 'unknown', $_REQUEST, 500, null, 'Errore generico: ' . $e->getMessage());
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

error_log("=== Fine richiesta API ===");
?>