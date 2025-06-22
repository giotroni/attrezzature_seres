<?php
// config.php è già incluso dal file principale
echo "Inizializzazione database generale...\n";

try {
    $conn = new PDO("mysql:host=" . DB_HOST, DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Crea il database se non esiste
    $sql = "CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
    $conn->exec($sql);
    
    // Seleziona il database
    $conn->exec("USE " . DB_NAME);

    echo "Inizializzazione database...\n";

    // 1. Crea tabella ubicazioni
    echo "Creazione tabella ubicazioni...\n";
    $sql = "CREATE TABLE IF NOT EXISTS ubicazioni (
        ID_ubicazione INT AUTO_INCREMENT PRIMARY KEY,
        nome_ubicazione VARCHAR(100) NOT NULL UNIQUE,
        indirizzo TEXT,
        user_created VARCHAR(100),
        user_modified VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nome_ubicazione (nome_ubicazione)
    )";
    $conn->exec($sql);

    // 2. Crea tabella LogApiEvent per log API
    echo "Creazione tabella LogApiEvent...\n";
    $sql = "CREATE TABLE IF NOT EXISTS LogApiEvent (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip_address VARCHAR(45),
        request_method VARCHAR(10),
        api_endpoint VARCHAR(255),
        action VARCHAR(50),
        request_data TEXT,
        response_code INT,
        response_data TEXT,
        error_message TEXT,
        execution_time FLOAT,
        user_agent TEXT,
        status ENUM('success', 'error') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_action (action),
        INDEX idx_created_at (created_at)
    )";
    $conn->exec($sql);

    echo "\nDatabase e tabelle base create con successo!\n";
    echo "Schema del database inizializzato correttamente.\n";

} catch(PDOException $e) {
    echo "Errore durante l'inizializzazione del database: " . $e->getMessage() . "\n";
}
?>
