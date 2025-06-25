<?php
/**
 * Statistiche del database
 * Fornisce statistiche su tabelle, API calls e utilizzo del sistema
 */

// Abilita la visualizzazione degli errori
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

try {
    // Carica configurazione
    require_once 'config.php';
    
    // Imposta header JSON
    header('Content-Type: application/json');
    
    // Connessione al database
    $conn = getConnection();

    $statistics = [];

    // 1. Statistiche sulle chiamate API
    $apiStats = $conn->query("
        SELECT 
            COUNT(*) as total_calls,
            COUNT(DISTINCT ip_address) as unique_ips,
            COUNT(DISTINCT api_endpoint) as unique_endpoints,
            COUNT(DISTINCT action) as unique_actions,
            AVG(execution_time) as avg_execution_time,
            MAX(execution_time) as max_execution_time,
            MIN(created_at) as first_call,
            MAX(created_at) as last_call,
            COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
            COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count
        FROM LogApiEvent
    ")->fetch(PDO::FETCH_ASSOC);

    // Chiamate API per giorno
    $dailyCalls = $conn->query("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
        FROM LogApiEvent
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
    ")->fetchAll(PDO::FETCH_ASSOC);

    $apiStats['daily_calls'] = $dailyCalls;

    // Top 10 azioni più chiamate
    $topActions = $conn->query("
        SELECT action, COUNT(*) as count
        FROM LogApiEvent
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);

    $statistics['api'] = [
        'general' => $apiStats,
        'top_actions' => $topActions
    ];

    // 2. Statistiche sui materiali
    $materialsStats = $conn->query("
        SELECT 
            COUNT(*) as total_materials,
            COUNT(CASE WHEN attivo = 1 THEN 1 END) as active_materials,
            COUNT(DISTINCT categoria) as unique_categories,
            COUNT(DISTINCT tipo) as unique_types,
            COUNT(DISTINCT unita_misura) as unique_units
        FROM anagrafica_materiali
    ")->fetch(PDO::FETCH_ASSOC);

    // Materiali per categoria
    $materialsPerCategory = $conn->query("
        SELECT 
            categoria,
            COUNT(*) as count,
            COUNT(CASE WHEN attivo = 1 THEN 1 END) as active_count
        FROM anagrafica_materiali
        GROUP BY categoria
        ORDER BY count DESC
    ")->fetchAll(PDO::FETCH_ASSOC);

    $statistics['materials'] = [
        'general' => $materialsStats,
        'per_category' => $materialsPerCategory
    ];

    // 3. Statistiche sulle giacenze
    $inventoryStats = $conn->query("
        SELECT 
            COUNT(DISTINCT codice_materiale) as materials_with_stock,
            COUNT(DISTINCT ID_ubicazione) as locations_used,
            SUM(quantita_attuale) as total_quantity,
            SUM(quantita_riservata) as total_reserved,
            SUM(quantita_disponibile) as total_available,
            AVG(DATEDIFF(CURRENT_DATE, data_ultimo_inventario)) as avg_days_since_inventory
        FROM giacenze_materiali
    ")->fetch(PDO::FETCH_ASSOC);

    // Top 10 ubicazioni per numero di materiali
    $topLocations = $conn->query("
        SELECT 
            u.nome_ubicazione,
            COUNT(DISTINCT gm.codice_materiale) as unique_materials,
            SUM(gm.quantita_attuale) as total_quantity
        FROM ubicazioni u
        JOIN giacenze_materiali gm ON u.ID_ubicazione = gm.ID_ubicazione
        GROUP BY u.ID_ubicazione
        ORDER BY unique_materials DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);

    $statistics['inventory'] = [
        'general' => $inventoryStats,
        'top_locations' => $topLocations
    ];

    // 4. Statistiche sulla dimensione del database
    $dbStats = $conn->query("
        SELECT 
            table_name as 'table',
            table_rows as 'rows',
            ROUND((data_length + index_length) / 1024 / 1024, 2) as size_mb
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY (data_length + index_length) DESC
    ")->fetchAll(PDO::FETCH_ASSOC);

    $statistics['database'] = [
        'tables' => $dbStats
    ];

    // 5. Statistiche temporali
    $timeStats = [
        'current_time' => date('Y-m-d H:i:s'),
        'timezone' => date_default_timezone_get(),
        'uptime' => $conn->query("SHOW GLOBAL STATUS LIKE 'Uptime'")->fetch(PDO::FETCH_ASSOC)
    ];

    $statistics['system'] = $timeStats;

    // 6. Statistiche sui movimenti degli strumenti
    $movementsStats = $conn->query("
        SELECT 
            COUNT(*) as total_movements,
            COUNT(DISTINCT codice) as unique_tools,
            COUNT(DISTINCT user_name) as unique_users,
            COUNT(CASE WHEN azione = 'PRELIEVO' THEN 1 END) as prelievi,
            COUNT(CASE WHEN azione = 'RESTITUZIONE' THEN 1 END) as restituzioni,
            COUNT(CASE WHEN azione = 'spostamento' THEN 1 END) as spostamenti,
            MIN(timestamp) as first_movement,
            MAX(timestamp) as last_movement
        FROM LogToolsMovements
    ")->fetch(PDO::FETCH_ASSOC);

    // Top 10 strumenti più movimentati
    $topMovedTools = $conn->query("
        SELECT 
            codice,
            COUNT(*) as total_movements,
            COUNT(CASE WHEN azione = 'PRELIEVO' THEN 1 END) as prelievi,
            COUNT(CASE WHEN azione = 'RESTITUZIONE' THEN 1 END) as restituzioni,
            COUNT(CASE WHEN azione = 'spostamento' THEN 1 END) as spostamenti,
            MAX(timestamp) as last_movement
        FROM LogToolsMovements
        GROUP BY codice
        ORDER BY total_movements DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Top 10 utenti più attivi nei movimenti
    $topMovementUsers = $conn->query("
        SELECT 
            user_name,
            COUNT(*) as total_movements,
            COUNT(DISTINCT codice) as unique_tools,
            COUNT(CASE WHEN azione = 'PRELIEVO' THEN 1 END) as prelievi,
            COUNT(CASE WHEN azione = 'RESTITUZIONE' THEN 1 END) as restituzioni,
            COUNT(CASE WHEN azione = 'spostamento' THEN 1 END) as spostamenti,
            MAX(timestamp) as last_movement
        FROM LogToolsMovements
        GROUP BY user_name
        ORDER BY total_movements DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Movimenti per mese
    $monthlyMovements = $conn->query("
        SELECT 
            DATE_FORMAT(timestamp, '%Y-%m') as month,
            COUNT(*) as total_movements,
            COUNT(CASE WHEN azione = 'PRELIEVO' THEN 1 END) as prelievi,
            COUNT(CASE WHEN azione = 'RESTITUZIONE' THEN 1 END) as restituzioni,
            COUNT(CASE WHEN azione = 'spostamento' THEN 1 END) as spostamenti
        FROM LogToolsMovements
        GROUP BY DATE_FORMAT(timestamp, '%Y-%m')
        ORDER BY month DESC
        LIMIT 12
    ")->fetchAll(PDO::FETCH_ASSOC);

    $statistics['tools_movements'] = [
        'general' => $movementsStats,
        'top_tools' => $topMovedTools,
        'top_users' => $topMovementUsers,
        'monthly' => $monthlyMovements
    ];

    // 7. Statistiche sugli utenti attivi
    $activeUsers = $conn->query("
        SELECT 
            UPPER(user_action) as username,
            COUNT(CASE WHEN type = 'location_change' THEN 1 END) as location_changes,
            COUNT(CASE WHEN type = 'material_change' THEN 1 END) as material_changes,
            MAX(action_time) as last_access
        FROM (
            SELECT 
                CAST(user_created AS CHAR) as user_action,
                CAST('location_change' AS CHAR) as type,
                created_at as action_time
            FROM ubicazioni
            WHERE user_created IS NOT NULL
            UNION ALL
            SELECT 
                CAST(user_modified AS CHAR),
                CAST('location_change' AS CHAR),
                modified_at
            FROM ubicazioni
            WHERE user_modified IS NOT NULL
            UNION ALL
            SELECT 
                CAST(utente_creazione AS CHAR),
                CAST('material_change' AS CHAR),
                created_at
            FROM giacenze_materiali
            WHERE utente_creazione IS NOT NULL
            UNION ALL
            SELECT 
                CAST(utente_modifica AS CHAR),
                CAST('material_change' AS CHAR),
                updated_at
            FROM giacenze_materiali
            WHERE utente_modifica IS NOT NULL
        ) user_actions
        GROUP BY UPPER(user_action)
        ORDER BY COUNT(*) DESC
    ")->fetchAll(PDO::FETCH_ASSOC);

    $statistics['users'] = $activeUsers;

    // Output delle statistiche
    echo json_encode([
        'success' => true,
        'timestamp' => date('Y-m-d H:i:s'),
        'statistics' => $statistics
    ], JSON_PRETTY_PRINT);

} catch (PDOException $e) {
    error_log("Errore DB in statistiche.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Errore database: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("Errore generico in statistiche.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

// Debug query per vedere il contenuto di LogToolsMovements
    $debug = $conn->query("
        SELECT *, 
            CASE 
                WHEN azione = 'PRELIEVO' THEN 1 
                WHEN azione = 'prelievo' THEN 1
                WHEN azione = 'Prelievo' THEN 1
                ELSE 0 
            END as is_prelievo,
            CASE 
                WHEN azione = 'RESTITUZIONE' THEN 1 
                WHEN azione = 'restituzione' THEN 1
                WHEN azione = 'Restituzione' THEN 1
                ELSE 0 
            END as is_restituzione,
            CASE 
                WHEN TRIM(azione) = '' THEN 'VUOTO'
                ELSE TRIM(azione)
            END as azione_pulita
        FROM LogToolsMovements
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Salva il debug in un file
    $debugContent = "Debug LogToolsMovements (" . date('Y-m-d H:i:s') . "):\n";
    $debugContent .= "Numero totale righe: " . count($debug) . "\n\n";
    foreach ($debug as $row) {
        $debugContent .= "Record:\n";
        foreach ($row as $key => $value) {
            $debugContent .= "  $key: " . ($value === null ? 'NULL' : $value) . "\n";
        }
        $debugContent .= "------------------------\n";
    }
    file_put_contents(__DIR__ . '/debug_movements.txt', $debugContent);
?>
