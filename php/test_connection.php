<?php
require_once 'config.php';

echo "Informazioni PHP e PDO:\n";
echo "PHP Version: " . phpversion() . "\n";
echo "PDO drivers disponibili: " . implode(", ", PDO::getAvailableDrivers()) . "\n\n";

echo "Configurazione database:\n";
echo "Host: " . DB_HOST . "\n";
echo "Database: " . DB_NAME . "\n";
echo "Username: " . DB_USER . "\n\n";

echo "Tentativo di connessione al database...\n";
try {
    $conn = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8",
        DB_USER,
        DB_PASS
    );
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connessione riuscita!\n";
    
    // Test query semplice
    $stmt = $conn->query("SELECT DATABASE()");
    $dbName = $stmt->fetchColumn();
    echo "Database connesso: " . $dbName . "\n";
    
    // Test caratteri speciali
    $conn->query("SET NAMES utf8mb4");
    echo "Supporto UTF-8 verificato\n";
    
    $conn = null;
    echo "Connessione chiusa correttamente.\n";
    
} catch(PDOException $e) {
    echo "ERRORE di connessione: " . $e->getMessage() . "\n";
    exit(1);
}
?>
