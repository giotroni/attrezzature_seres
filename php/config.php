<?php
// --- CORS ROBUSTO: deve essere la PRIMA cosa eseguita, prima di qualunque output o require ---
$allowed_origins = [
    'http://seres.it',
    'http://www.seres.it',
    'http://seres.it/tools/test',
    'http://www.seres.it/tools/test',
    'http://localhost',
    'http://127.0.0.1'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');
} else {
    // Per debugging: consenti sempre localhost se non in elenco
    if (strpos($origin, 'localhost') !== false || strpos($origin, '127.0.0.1') !== false) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Credentials: true');
    }
}
// Rispondi subito alle richieste OPTIONS (preflight) con header CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Content-Type: application/json');
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'CORS preflight OK']);
    exit;
}

// --- FINE CORS ---

// Configurazione Database
define('DB_HOST', 'localhost');     // Il tuo host MySQL
define('DB_USER', 'jseresxg_tools_materials');         // Il tuo username MySQL
define('DB_PASS', '^2xs!r][7WwO');             // La tua password MySQL
define('DB_NAME', 'jseresxg_tools_materials');     // Il nome del database

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
        logApiEvent(null, 'connection_error', null, 500, null, $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Errore di connessione: ' . $e->getMessage()]);
        exit;
    }
}

// Funzione per loggare gli eventi delle API
function logApiEvent($conn, $action, $requestData = null, $responseCode = null, $responseData = null, $errorMessage = null) {
    try {
        // Se non abbiamo una connessione, creane una nuova
        $needNewConnection = false;
        if (!$conn) {
            $conn = new PDO(
                "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8",
                DB_USER,
                DB_PASS
            );
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $needNewConnection = true;
        }

<?php
// --- CORS ROBUSTO: deve essere la PRIMA cosa eseguita, prima di qualunque output o require ---
$allowed_origins = [
    'https://php-v1--seres-tools.netlify.app',
    'http://localhost',
    'http://127.0.0.1'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');
} else {
    // Per debugging: consenti sempre localhost se non in elenco
    if (strpos($origin, 'localhost') !== false || strpos($origin, '127.0.0.1') !== false) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Credentials: true');
    }
}
// Rispondi subito alle richieste OPTIONS (preflight) con header CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Content-Type: application/json');
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'CORS preflight OK']);
    exit;
}

// --- FINE CORS ---

// Configurazione Database
define('DB_HOST', 'localhost');     // Il tuo host MySQL
define('DB_USER', 'jseresxg_tools_materials');         // Il tuo username MySQL
define('DB_PASS', '^2xs!r][7WwO');             // La tua password MySQL
define('DB_NAME', 'jseresxg_tools_materials');     // Il nome del database

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
        logApiEvent(null, 'connection_error', null, 500, null, $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Errore di connessione: ' . $e->getMessage()]);
        exit;
    }
}

// Funzione per loggare gli eventi delle API
function logApiEvent($conn, $action, $requestData = null, $responseCode = null, $responseData = null, $errorMessage = null) {
    try {
        // Se non abbiamo una connessione, creane una nuova
        $needNewConnection = false;
        if (!$conn) {
            $conn = new PDO(
                "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8",
                DB_USER,
                DB_PASS
            );
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $needNewConnection = true;
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

        $stmt->execute([
            $_SERVER['REMOTE_ADDR'],
            $_SERVER['REQUEST_METHOD'],
            $_SERVER['PHP_SELF'],
            $action,
            $requestData ? json_encode($requestData) : null,
            $responseCode,
            $responseData ? json_encode($responseData) : null,
            $errorMessage,
            $executionTime,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            $errorMessage ? 'error' : 'success'
        ]);

        // Chiudi la connessione se l'abbiamo creata qui
        if ($needNewConnection) {
            $conn = null;
        }
    } catch(Exception $e) {
        // Se fallisce il logging, scriviamo almeno in error_log
        error_log("Errore nel logging: " . $e->getMessage());
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
            $_GET['action'] ?? 'unknown',
            isset($GLOBALS['api_request_data']) ? $GLOBALS['api_request_data'] : null,
            $responseCode,
            $data,
            isset($data['success']) && !$data['success'] ? ($data['message'] ?? null) : null
        );
    }

    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Registra il tempo di inizio per calcolare l'execution time
$GLOBALS['api_start_time'] = microtime(true);

// Definizione URL base API
define('API_BASE_URL', 'https://seres.it/tools/php/api.php');

// --- CORS ROBUSTO PER API ESTERNE (NETLIFY) ---
$allowed_origins = [
    'https://php-v1--seres-tools.netlify.app',
    'http://localhost',
    'http://127.0.0.1'
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');
} else {
    // Per debugging: consenti sempre localhost se non in elenco
    if (strpos($origin, 'localhost') !== false || strpos($origin, '127.0.0.1') !== false) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Credentials: true');
    }
}
// Rispondi subito alle richieste OPTIONS (preflight) con header CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Content-Type: application/json');
    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'CORS preflight OK']);
    exit;
}
?>
