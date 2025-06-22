<?php
// Definizione del percorso base
define('BASE_PATH', dirname(__FILE__));

// Verifica che config.php esista
if (!file_exists(BASE_PATH . '/config.php')) {
    die("ERRORE: File config.php non trovato!\n");
}

require_once BASE_PATH . '/config.php';

echo "=================================================\n";
echo "Inizializzazione completa del sistema database\n";
echo "=================================================\n\n";

try {
    // Test iniziale della connessione
    try {
        $testConn = new PDO("mysql:host=" . DB_HOST, DB_USER, DB_PASS);
        $testConn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $testConn = null;
    } catch (PDOException $e) {
        die("ERRORE: Impossibile connettersi al database MySQL.\nDettagli: " . $e->getMessage() . "\n");
    }

    // 1. Inizializzazione database base e tabelle di sistema
    echo "Step 1: Inizializzazione database base e tabelle di sistema...\n";
    require_once BASE_PATH . '/init/init_db_main.php';
    echo "Completato Step 1\n\n";

    // 2. Inizializzazione tabelle attrezzature
    echo "Step 2: Inizializzazione tabelle attrezzature...\n";
    require_once BASE_PATH . '/init/init_db_attrezzature.php';
    echo "Completato Step 2\n\n";

    // 3. Inizializzazione tabelle materiali
    echo "Step 3: Inizializzazione tabelle materiali...\n";
    require_once BASE_PATH . '/init/init_db_materiali.php';
    echo "Completato Step 3\n\n";

    echo "=================================================\n";
    echo "Inizializzazione completa del database completata!\n";
    echo "=================================================\n";

} catch (Exception $e) {
    echo "\n\nERRORE DURANTE L'INIZIALIZZAZIONE: \n";
    echo $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n";
    exit(1);
}
?>