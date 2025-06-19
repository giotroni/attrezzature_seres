<?php
// --- CORS ROBUSTO: deve essere la PRIMA cosa eseguita ---
$allowed_origins = [
    'http://seres.it',
    'http://www.seres.it',
    'http://seres.it/tools/test',
    'http://www.seres.it/tools/test',
    'https://php-v1--seres-tools.netlify.app',
    'http://localhost',
    'http://127.0.0.1'
];

// Gestione CORS
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

// Per debug temporaneo: permetti tutte le origini in sviluppo
if (strpos($origin, 'localhost') !== false || strpos($origin, '127.0.0.1') !== false) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: *'); // Temporaneamente permettiamo tutte le origini
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400'); // 24 ore

// Gestisci le richieste OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- FINE CORS ---

// Configurazione Database - AGGIUNTE LE DEFINIZIONI DELLE COSTANTI
if (!defined('DB_HOST')) {
    define('DB_HOST', 'localhost');
}
if (!defined('DB_USER')) {
    define('DB_USER', 'jseresxg_tools_materials');
}
if (!defined('DB_PASS')) {
    define('DB_PASS', '^2xs!r][7WwO');
}
if (!defined('DB_NAME')) {
    define('DB_NAME', 'jseresxg_tools_materials');
}

// Registra il tempo di inizio per calcolare l'execution time
$GLOBALS['api_start_time'] = microtime(true);

// Funzione per connessione al database
function getConnection() {
    try {
        $conn = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8",
            DB_USER,
            DB_PASS
        );
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $conn;
    } catch(PDOException $e) {
        error_log("Errore connessione DB: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Errore di connessione: ' . $e->getMessage()]);
        exit;
    }
}

// Funzione semplificata per loggare gli eventi delle API
// Compatibile con le chiamate da api.php
function logApiEvent($conn, $action, $requestData = null, $responseCode = null, $responseData = null, $errorMessage = null) {
    try {
        // Se non abbiamo una connessione valida, salta il logging
        if (!$conn || !($conn instanceof PDO)) {
            error_log("logApiEvent: connessione non valida per action: $action");
            return false;
        }

        // Verifica se la tabella LogEvent esiste
        $checkTable = $conn->query("SHOW TABLES LIKE 'LogEvent'");
        if ($checkTable->rowCount() == 0) {
            error_log("logApiEvent: tabella LogEvent non trovata");
            return false;
        }

        $stmt = $conn->prepare("
            INSERT INTO LogEvent (
                ip_address,
                request_method,
                api_endpoint,
                action,
                request_data,
                response_code,
                response_data,
                error_message,
                execution_time,
                user_agent,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $executionTime = isset($GLOBALS['api_start_time']) ? 
            (microtime(true) - $GLOBALS['api_start_time']) : 
            0;

        $result = $stmt->execute([
            $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            $_SERVER['REQUEST_METHOD'] ?? 'unknown',
            $_SERVER['PHP_SELF'] ?? 'api.php',
            $action,
            $requestData ? json_encode($requestData) : null,
            $responseCode,
            $responseData ? json_encode($responseData) : null,
            $errorMessage,
            $executionTime,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            $errorMessage ? 'error' : 'success'
        ]);

        if ($result) {
            error_log("logApiEvent: log inserito con successo per action: $action");
        } else {
            error_log("logApiEvent: errore nell'inserimento per action: $action");
        }

        return $result;
        
    } catch(Exception $e) {
        // Se fallisce il logging, scriviamo almeno in error_log
        error_log("Errore nel logging per action $action: " . $e->getMessage());
        return false;
    }
}

// Funzione per gestire le risposte JSON
function sendJsonResponse($data, $conn = null) {
    $responseCode = isset($data['success']) && $data['success'] ? 200 : 400;
    http_response_code($responseCode);
    
    // Log della risposta
    if ($conn) {
        logApiEvent(
            $conn,
            $_GET['action'] ?? $_POST['action'] ?? 'unknown',
            array_merge($_GET, $_POST),
            $responseCode,
            $data,
            isset($data['success']) && !$data['success'] ? ($data['message'] ?? null) : null
        );
    }

    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Definizione URL base API
define('API_BASE_URL', 'https://seres.it/tools/php/api.php');
?>