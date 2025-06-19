<?php
// Script per verificare il flusso completo dei movimenti
require_once 'config.php';

try {
    $conn = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    echo "=== VERIFICA TABELLE ===\n";
    
    // 1. Verifica esistenza tabelle
    $tables = ['attrezzature', 'log', 'LogEvent'];
    foreach ($tables as $table) {
        $stmt = $conn->query("SHOW TABLES LIKE '$table'");
        if ($stmt->rowCount() > 0) {
            echo "✅ Tabella '$table' esiste\n";
            
            // Conta record
            $stmt = $conn->query("SELECT COUNT(*) as count FROM $table");
            $count = $stmt->fetch(PDO::FETCH_ASSOC);
            echo "   Record: {$count['count']}\n";
        } else {
            echo "❌ Tabella '$table' NON esiste\n";
        }
    }

    echo "\n=== STRUTTURA TABELLA LOG ===\n";
    $stmt = $conn->query("DESCRIBE log");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo "- {$col['Field']}: {$col['Type']}\n";
    }

    echo "\n=== CONTENUTO TABELLA LOG (ultimi 10) ===\n";
    $stmt = $conn->query("SELECT * FROM log ORDER BY timestamp DESC LIMIT 10");
    $logRecords = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($logRecords)) {
        echo "⚠️ Nessun record nella tabella log\n";
        
        // Verifica se ci sono attrezzature per test
        $stmt = $conn->query("SELECT codice FROM attrezzature LIMIT 3");
        $attrezzature = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (!empty($attrezzature)) {
            echo "\n=== CREAZIONE RECORD DI TEST ===\n";
            foreach ($attrezzature as $attr) {
                $stmt = $conn->prepare("
                    INSERT INTO log (
                        user_name, azione, tipo_oggetto, codice, 
                        vecchia_ubicazione, nuova_ubicazione
                    ) VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    'test_user',
                    'spostamento', 
                    'attrezzatura',
                    $attr['codice'],
                    'MAGAZZINO',
                    'OFFICINA'
                ]);
                echo "✅ Creato movimento di test per {$attr['codice']}\n";
            }
        }
    } else {
        foreach ($logRecords as $record) {
            echo "ID: {$record['id']} | {$record['timestamp']} | {$record['codice']} | {$record['azione']} | {$record['user_name']}\n";
            if ($record['azione'] === 'spostamento') {
                echo "   Da: {$record['vecchia_ubicazione']} -> A: {$record['nuova_ubicazione']}\n";
            }
        }
    }

    echo "\n=== TEST API getMovementHistory ===\n";
    
    // Prendi il primo codice dalla tabella log
    $stmt = $conn->query("SELECT DISTINCT codice FROM log LIMIT 1");
    $testRecord = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($testRecord) {
        $testCodice = $testRecord['codice'];
        echo "Test con codice: $testCodice\n";
        
        // Simula la query dell'API
        $stmt = $conn->prepare("
            SELECT 
                timestamp,
                user_name,
                azione,
                vecchia_ubicazione,
                nuova_ubicazione
            FROM log 
            WHERE codice = ? 
            ORDER BY timestamp DESC
        ");
        $stmt->execute([$testCodice]);
        $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "Movimenti trovati: " . count($movements) . "\n";
        foreach ($movements as $mov) {
            echo "- {$mov['timestamp']}: {$mov['azione']} by {$mov['user_name']}\n";
            if ($mov['azione'] === 'spostamento') {
                echo "  {$mov['vecchia_ubicazione']} → {$mov['nuova_ubicazione']}\n";
            }
        }
        
        echo "\n=== URL DI TEST ===\n";
        echo "Prova questo URL nel browser:\n";
        echo "https://seres.it/tools/php/api.php?action=getMovementHistory&codice=" . urlencode($testCodice) . "\n";
        
    } else {
        echo "❌ Nessun codice trovato nella tabella log per il test\n";
    }

    echo "\n=== VERIFICA LogEvent PER API ===\n";
    $stmt = $conn->query("
        SELECT action, COUNT(*) as count 
        FROM LogEvent 
        WHERE action LIKE '%Movement%' OR action = 'getMovementHistory'
        GROUP BY action
    ");
    $apiCalls = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($apiCalls)) {
        echo "❌ Nessuna chiamata API getMovementHistory registrata in LogEvent\n";
    } else {
        foreach ($apiCalls as $call) {
            echo "✅ {$call['action']}: {$call['count']} chiamate\n";
        }
    }

} catch (Exception $e) {
    echo "ERRORE: " . $e->getMessage() . "\n";
}
?>