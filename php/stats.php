<?php
require_once 'config.php';

// Funzione per formattare il tempo in millisecondi
function formatExecutionTime($time) {
    return number_format($time * 1000, 2) . ' ms';
}

// Funzione per formattare la data
function formatDate($date) {
    return date('d/m/Y H:i:s', strtotime($date));
}

try {
    $conn = getConnection();
    
    // Statistiche generali
    $generalStats = $conn->query("
        SELECT 
            COUNT(*) as total_calls,
            COUNT(CASE WHEN status = 'error' THEN 1 END) as total_errors,
            AVG(execution_time) as avg_execution_time,
            MAX(execution_time) as max_execution_time,
            MIN(timestamp) as first_call,
            MAX(timestamp) as last_call
        FROM LogEvent
    ")->fetch(PDO::FETCH_ASSOC);

    // Statistiche per azione
    $actionStats = $conn->query("
        SELECT 
            action,
            COUNT(*) as calls,
            COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
            AVG(execution_time) as avg_time,
            MAX(execution_time) as max_time
        FROM LogEvent 
        GROUP BY action 
        ORDER BY calls DESC
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Ultimi errori
    $recentErrors = $conn->query("
        SELECT timestamp, action, error_message, ip_address, execution_time
        FROM LogEvent 
        WHERE status = 'error'
        ORDER BY timestamp DESC 
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Statistiche orarie (ultime 24 ore)
    $hourlyStats = $conn->query("
        SELECT 
            DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
            COUNT(*) as calls,
            COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
            AVG(execution_time) as avg_time
        FROM LogEvent 
        WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY hour
        ORDER BY hour DESC
    ")->fetchAll(PDO::FETCH_ASSOC);

} catch(PDOException $e) {
    die("Errore nel recupero delle statistiche: " . $e->getMessage());
}
?>

<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Statistiche API SERES</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1, h2 {
            color: #333;
            margin-top: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .error-row {
            background-color: #fff3f3;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .stat-item {
            background: #fff;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .stat-label {
            color: #666;
            font-size: 14px;
        }
        .refresh-button {
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .refresh-button:hover {
            background: #45a049;
        }
        .chart {
            width: 100%;
            height: 300px;
            margin-top: 20px;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <h1>📊 Statistiche API SERES</h1>
        <button class="refresh-button" onclick="location.reload()">🔄 Aggiorna Statistiche</button>

        <!-- Statistiche Generali -->
        <div class="card">
            <h2>📈 Panoramica Generale</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value"><?php echo number_format($generalStats['total_calls']); ?></div>
                    <div class="stat-label">Chiamate Totali</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value"><?php echo number_format($generalStats['total_errors']); ?></div>
                    <div class="stat-label">Errori Totali</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value"><?php echo formatExecutionTime($generalStats['avg_execution_time']); ?></div>
                    <div class="stat-label">Tempo Medio di Esecuzione</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value"><?php echo formatExecutionTime($generalStats['max_execution_time']); ?></div>
                    <div class="stat-label">Tempo Massimo di Esecuzione</div>
                </div>
            </div>
            <p>
                Prima chiamata: <?php echo formatDate($generalStats['first_call']); ?><br>
                Ultima chiamata: <?php echo formatDate($generalStats['last_call']); ?>
            </p>
        </div>

        <!-- Grafico delle chiamate nelle ultime 24 ore -->
        <div class="card">
            <h2>📊 Attività ultime 24 ore</h2>
            <canvas id="hourlyChart" class="chart"></canvas>
        </div>

        <!-- Statistiche per Azione -->
        <div class="card">
            <h2>🎯 Statistiche per Azione</h2>
            <table>
                <thead>
                    <tr>
                        <th>Azione</th>
                        <th>Chiamate</th>
                        <th>Errori</th>
                        <th>Tempo Medio</th>
                        <th>Tempo Massimo</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($actionStats as $stat): ?>
                    <tr>
                        <td><?php echo htmlspecialchars($stat['action']); ?></td>
                        <td><?php echo number_format($stat['calls']); ?></td>
                        <td><?php echo number_format($stat['errors']); ?></td>
                        <td><?php echo formatExecutionTime($stat['avg_time']); ?></td>
                        <td><?php echo formatExecutionTime($stat['max_time']); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <!-- Ultimi Errori -->
        <div class="card">
            <h2>⚠️ Ultimi Errori</h2>
            <table>
                <thead>
                    <tr>
                        <th>Data/Ora</th>
                        <th>Azione</th>
                        <th>Messaggio di Errore</th>
                        <th>IP</th>
                        <th>Tempo di Esecuzione</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($recentErrors as $error): ?>
                    <tr class="error-row">
                        <td><?php echo formatDate($error['timestamp']); ?></td>
                        <td><?php echo htmlspecialchars($error['action']); ?></td>
                        <td><?php echo htmlspecialchars($error['error_message']); ?></td>
                        <td><?php echo htmlspecialchars($error['ip_address']); ?></td>
                        <td><?php echo formatExecutionTime($error['execution_time']); ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <script>
        // Preparazione dati per il grafico
        const hourlyData = <?php echo json_encode($hourlyStats); ?>;
        
        // Creazione del grafico
        const ctx = document.getElementById('hourlyChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: hourlyData.map(item => new Date(item.hour).toLocaleTimeString()),
                datasets: [{
                    label: 'Chiamate',
                    data: hourlyData.map(item => item.calls),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }, {
                    label: 'Errori',
                    data: hourlyData.map(item => item.errors),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    </script>
</body>
</html>
