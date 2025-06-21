<?php
require_once 'config.php';

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

    // 2. Crea tabella attrezzature
    echo "Creazione tabella attrezzature...\n";
    $sql = "CREATE TABLE IF NOT EXISTS attrezzature (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codice VARCHAR(50) UNIQUE NOT NULL,
        categoria VARCHAR(100) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        marca VARCHAR(200) NOT NULL,
        ID_ubicazione INT NOT NULL,
        doc VARCHAR(500),
        note TEXT,
        utente_creazione VARCHAR(100),
        utente_modifica VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ID_ubicazione) REFERENCES ubicazioni(ID_ubicazione),
        INDEX idx_codice (codice),
        INDEX idx_categoria (categoria),
        INDEX idx_tipo (tipo)
    )";
    $conn->exec($sql);

    // 3. Crea tabella LogToolsMovements per gli spostamenti e le modifiche
    echo "Creazione tabella LogToolsMovements...\n";
    $sql = "CREATE TABLE IF NOT EXISTS LogToolsMovements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_name VARCHAR(100) NOT NULL,
        azione VARCHAR(50) NOT NULL,
        tipo_oggetto VARCHAR(50) NOT NULL,
        codice VARCHAR(50) NOT NULL,
        vecchia_ubicazione_id INT,
        nuova_ubicazione_id INT,
        note_precedenti TEXT,
        note_nuove TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (codice) REFERENCES attrezzature(codice) ON DELETE CASCADE,
        FOREIGN KEY (vecchia_ubicazione_id) REFERENCES ubicazioni(ID_ubicazione),
        FOREIGN KEY (nuova_ubicazione_id) REFERENCES ubicazioni(ID_ubicazione),
        INDEX idx_timestamp (timestamp),
        INDEX idx_codice (codice),
        INDEX idx_azione (azione)
    )";
    $conn->exec($sql);

    // 4. Crea tabella LogToolsNotes per lo storico delle note
    echo "Creazione tabella LogToolsNotes...\n";
    $sql = "CREATE TABLE IF NOT EXISTS LogToolsNotes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_name VARCHAR(100) NOT NULL,
        codice VARCHAR(50) NOT NULL,
        nota TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (codice) REFERENCES attrezzature(codice) ON DELETE CASCADE,
        INDEX idx_codice (codice),
        INDEX idx_timestamp (timestamp)
    )";
    $conn->exec($sql);

    // 5. Crea tabella LogApiEvent per log API
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

    echo "\nDatabase e tabelle create con successo!\n";
    echo "Schema del database inizializzato correttamente.\n";

} catch(PDOException $e) {
    echo "Errore durante l'inizializzazione del database: " . $e->getMessage() . "\n";
}
?>