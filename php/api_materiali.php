<?php
/**
 * API per la gestione dei materiali
 */

// Abilita la visualizzazione degli errori
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

try {
    // Carica configurazione
    if (!file_exists('config.php')) {
        throw new Exception('File config.php non trovato');
    }
    require_once 'config.php';
    
    // Imposta header JSON
    header('Content-Type: application/json');
    
    // Connessione al database
    $conn = new PDO(
        "mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );    // Determina l'azione richiesta
    $action = $_GET['action'] ?? $_POST['action'] ?? 'getMateriali';
    
    // Log della chiamata API
    $requestData = $_POST;
    if (empty($requestData)) {
        $requestData = $_GET;
    }
    logApiEvent($conn, $action, $requestData);

    switch ($action) {
        
        case 'getMateriali':
            $query = "
                SELECT 
                    am.codice_materiale,
                    am.categoria,
                    am.tipo,
                    am.unita_misura,
                    am.soglia_minima,
                    am.note,
                    am.attivo,
                    COALESCE(SUM(gm.quantita_attuale), 0) as quantita_totale,
                    COALESCE(SUM(gm.quantita_riservata), 0) as quantita_riservata_totale,
                    COALESCE(SUM(gm.quantita_disponibile), 0) as quantita_disponibile_totale,
                    COUNT(gm.ID_ubicazione) as numero_ubicazioni,
                    CASE 
                        WHEN COALESCE(SUM(gm.quantita_disponibile), 0) <= am.soglia_minima THEN 'CRITICO'
                        WHEN COALESCE(SUM(gm.quantita_disponibile), 0) <= (am.soglia_minima * 1.5) THEN 'BASSO'
                        ELSE 'OK'
                    END as stato_giacenza
                FROM anagrafica_materiali am
                LEFT JOIN giacenze_materiali gm ON am.codice_materiale = gm.codice_materiale
                WHERE am.attivo = 1
                GROUP BY am.codice_materiale
                ORDER BY am.categoria, am.tipo
            ";

            $stmt = $conn->query($query);
            $materiali = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $response = [
                'success' => true,
                'count' => count($materiali),
                'data' => $materiali
            ];
            
            logApiEvent($conn, $action, $requestData, 200, $response);
            echo json_encode($response);
            break;

        case 'getGiacenze':
            $query = "
                SELECT 
                    gm.*,
                    am.categoria,
                    am.tipo,
                    am.unita_misura,
                    am.soglia_minima,
                    u.nome_ubicazione,
                    u.indirizzo,
                    DATEDIFF(CURDATE(), gm.data_ultimo_inventario) as giorni_ultimo_inventario
                FROM giacenze_materiali gm
                JOIN anagrafica_materiali am ON gm.codice_materiale = am.codice_materiale
                JOIN ubicazioni u ON gm.ID_ubicazione = u.ID_ubicazione
                WHERE am.attivo = 1
            ";

            $params = [];

            if (isset($_GET['codice_materiale']) && !empty($_GET['codice_materiale'])) {
                $query .= " AND gm.codice_materiale = ?";
                $params[] = $_GET['codice_materiale'];
            }

            if (isset($_GET['ubicazione']) && !empty($_GET['ubicazione'])) {
                $query .= " AND UPPER(u.nome_ubicazione) = UPPER(?)";
                $params[] = $_GET['ubicazione'];
            }

            if (isset($_GET['solo_positive']) && $_GET['solo_positive'] === 'true') {
                $query .= " AND gm.quantita_attuale > 0";
            }

            $query .= " ORDER BY u.nome_ubicazione, am.categoria, am.tipo";

            $stmt = $conn->prepare($query);
            $stmt->execute($params);
            $giacenze = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $response = [
                'success' => true,
                'count' => count($giacenze),
                'data' => $giacenze
            ];
            
            logApiEvent($conn, $action, $requestData, 200, $response);
            echo json_encode($response);
            break;
        case 'updateGiacenza':
            $requiredFields = ['codice_materiale', 'ubicazione', 'nuova_quantita', 'userName'];
            foreach ($requiredFields as $field) {
                if ((!isset($_POST[$field]) || $_POST[$field] === '') && (!isset($_GET[$field]) || $_GET[$field] === '')) {
                    throw new Exception("Campo obbligatorio mancante: $field");
                }
            }
            
            // Prende i valori da POST o GET usando l'operatore di coalescenza null
            $codice_materiale = $_POST['codice_materiale'] ?? $_GET['codice_materiale'];
            $ubicazione = $_POST['ubicazione'] ?? $_GET['ubicazione'];
            $nuova_quantita = $_POST['nuova_quantita'] ?? $_GET['nuova_quantita'];
            $userName = $_POST['userName'] ?? $_GET['userName'];

            $conn->beginTransaction();            // Trova o crea ubicazione
            $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE UPPER(nome_ubicazione) = UPPER(?)");
            $stmt->execute([trim($ubicazione)]);
            $ubicazione_id = $stmt->fetchColumn();

            if (!$ubicazione_id) {
                $stmt = $conn->prepare("INSERT INTO ubicazioni (nome_ubicazione, user_created) VALUES (UPPER(?), ?)");
                $stmt->execute([trim($ubicazione), strtoupper($userName)]);
                $ubicazione_id = $conn->lastInsertId();
            }

            // Verifica giacenza esistente
            $stmt = $conn->prepare("
                SELECT quantita_attuale 
                FROM giacenze_materiali 
                WHERE codice_materiale = ? AND ID_ubicazione = ?
            ");
            $stmt->execute([$codice_materiale, $ubicazione_id]);
            $quantita_precedente = $stmt->fetchColumn();            // Converti la quantità in modo sicuro
            $nuova_quantita = trim($nuova_quantita);
            // Sostituisce le virgole con punti
            $nuova_quantita = str_replace(',', '.', $nuova_quantita);
            // Converti in float senza formattazione aggiuntiva
            $nuova_quantita = (float)$nuova_quantita;

            // Log della quantità per debug
            error_log("Aggiornamento giacenza - Valore originale: " . $nuova_quantita . 
                     " - Dopo trim: " . trim($nuova_quantita) . 
                     " - Dopo replace: " . str_replace(',', '.', trim($nuova_quantita)) . 
                     " - Valore finale: " . $nuova_quantita);            if ($quantita_precedente !== false) {
                // Aggiorna giacenza esistente
                $stmt = $conn->prepare("
                    UPDATE giacenze_materiali 
                    SET quantita_attuale = ?, utente_modifica = ?
                    WHERE codice_materiale = ? AND ID_ubicazione = ?
                ");
                $stmt->bindValue(1, $nuova_quantita, PDO::PARAM_STR);
                $stmt->bindValue(2, strtoupper($userName), PDO::PARAM_STR);
                $stmt->bindValue(3, $codice_materiale, PDO::PARAM_STR);
                $stmt->bindValue(4, $ubicazione_id, PDO::PARAM_INT);
                $stmt->execute();
            } else {                // Crea nuova giacenza
                $quantita_precedente = 0;
                $stmt = $conn->prepare("
                    INSERT INTO giacenze_materiali (
                        codice_materiale, ID_ubicazione, quantita_attuale, 
                        utente_creazione, utente_modifica
                    ) VALUES (?, ?, ?, ?, ?)
                ");
                $stmt->bindValue(1, $codice_materiale, PDO::PARAM_STR);
                $stmt->bindValue(2, $ubicazione_id, PDO::PARAM_INT);
                $stmt->bindValue(3, $nuova_quantita, PDO::PARAM_STR);
                $stmt->bindValue(4, strtoupper($userName), PDO::PARAM_STR);
                $stmt->bindValue(5, strtoupper($userName), PDO::PARAM_STR);
                $stmt->execute();
            }

            $conn->commit();

            $response = [
                'success' => true,
                'message' => 'Giacenza aggiornata con successo',
                'data' => [
                    'quantita_precedente' => $quantita_precedente,
                    'nuova_quantita' => $nuova_quantita,
                    'variazione' => $nuova_quantita - $quantita_precedente
                ]
            ];
            
            logApiEvent($conn, $action, $requestData, 200, $response);
            echo json_encode($response);
            break;

        case 'spostaMateriale':
            $requiredFields = ['codice_materiale', 'ubicazione_origine', 'ubicazione_destinazione', 'quantita_da_spostare', 'userName'];
            foreach ($requiredFields as $field) {
                if ((!isset($_POST[$field]) || $_POST[$field] === '') && (!isset($_GET[$field]) || $_GET[$field] === '')) {
                    throw new Exception("Campo obbligatorio mancante: $field");
                }
            }
            
            // Prende i valori da POST o GET
            $codice_materiale = $_POST['codice_materiale'] ?? $_GET['codice_materiale'];
            $ubicazione_origine = $_POST['ubicazione_origine'] ?? $_GET['ubicazione_origine'];
            $ubicazione_destinazione = $_POST['ubicazione_destinazione'] ?? $_GET['ubicazione_destinazione'];
            $quantita_da_spostare = $_POST['quantita_da_spostare'] ?? $_GET['quantita_da_spostare'];
            $userName = $_POST['userName'] ?? $_GET['userName'];

            // Validazione dei dati
            $quantita_da_spostare = (float)str_replace(',', '.', trim($quantita_da_spostare));
            if ($quantita_da_spostare <= 0) {
                throw new Exception("La quantità da spostare deve essere positiva");
            }

            if (strtoupper(trim($ubicazione_origine)) === strtoupper(trim($ubicazione_destinazione))) {
                throw new Exception("L'ubicazione di origine e destinazione non possono essere uguali");
            }

            $conn->beginTransaction();

            // 1. Trova ID ubicazione origine
            $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE UPPER(nome_ubicazione) = UPPER(?)");
            $stmt->execute([trim($ubicazione_origine)]);
            $ubicazione_origine_id = $stmt->fetchColumn();

            if (!$ubicazione_origine_id) {
                throw new Exception("Ubicazione di origine non trovata: " . $ubicazione_origine);
            }

            // 2. Verifica quantità disponibile nell'ubicazione origine
            $stmt = $conn->prepare("
                SELECT quantita_attuale 
                FROM giacenze_materiali 
                WHERE codice_materiale = ? AND ID_ubicazione = ?
            ");
            $stmt->execute([$codice_materiale, $ubicazione_origine_id]);
            $quantita_origine = $stmt->fetchColumn();

            if ($quantita_origine === false) {
                throw new Exception("Materiale non trovato nell'ubicazione di origine");
            }

            if ($quantita_origine < $quantita_da_spostare) {
                throw new Exception("Quantità insufficiente nell'ubicazione di origine. Disponibile: " . $quantita_origine . ", Richiesta: " . $quantita_da_spostare);
            }

            // 3. Trova o crea ubicazione destinazione
            $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE UPPER(nome_ubicazione) = UPPER(?)");
            $stmt->execute([trim($ubicazione_destinazione)]);
            $ubicazione_dest_id = $stmt->fetchColumn();

            if (!$ubicazione_dest_id) {
                $stmt = $conn->prepare("INSERT INTO ubicazioni (nome_ubicazione, user_created) VALUES (UPPER(?), ?)");
                $stmt->execute([trim($ubicazione_destinazione), strtoupper($userName)]);
                $ubicazione_dest_id = $conn->lastInsertId();
            }

            // 4. Verifica se il materiale esiste già nella destinazione
            $stmt = $conn->prepare("
                SELECT quantita_attuale 
                FROM giacenze_materiali 
                WHERE codice_materiale = ? AND ID_ubicazione = ?
            ");
            $stmt->execute([$codice_materiale, $ubicazione_dest_id]);
            $quantita_destinazione = $stmt->fetchColumn();

            // 5. Diminuisci quantità nell'origine
            $nuova_quantita_origine = $quantita_origine - $quantita_da_spostare;
            
            if ($nuova_quantita_origine == 0) {
                // Rimuovi completamente la giacenza se diventa zero
                $stmt = $conn->prepare("DELETE FROM giacenze_materiali WHERE codice_materiale = ? AND ID_ubicazione = ?");
                $stmt->execute([$codice_materiale, $ubicazione_origine_id]);
            } else {
                // Aggiorna la quantità
                $stmt = $conn->prepare("
                    UPDATE giacenze_materiali 
                    SET quantita_attuale = ?, utente_modifica = ?
                    WHERE codice_materiale = ? AND ID_ubicazione = ?
                ");
                $stmt->execute([$nuova_quantita_origine, strtoupper($userName), $codice_materiale, $ubicazione_origine_id]);
            }

            // 6. Aggiungi/aggiorna quantità nella destinazione
            if ($quantita_destinazione !== false) {
                // Aggiorna giacenza esistente
                $nuova_quantita_destinazione = $quantita_destinazione + $quantita_da_spostare;
                $stmt = $conn->prepare("
                    UPDATE giacenze_materiali 
                    SET quantita_attuale = ?, utente_modifica = ?
                    WHERE codice_materiale = ? AND ID_ubicazione = ?
                ");
                $stmt->execute([$nuova_quantita_destinazione, strtoupper($userName), $codice_materiale, $ubicazione_dest_id]);
            } else {
                // Crea nuova giacenza
                $stmt = $conn->prepare("
                    INSERT INTO giacenze_materiali (
                        codice_materiale, ID_ubicazione, quantita_attuale, 
                        utente_creazione, utente_modifica
                    ) VALUES (?, ?, ?, ?, ?)
                ");
                $stmt->execute([$codice_materiale, $ubicazione_dest_id, $quantita_da_spostare, strtoupper($userName), strtoupper($userName)]);
                $quantita_destinazione = 0;
                $nuova_quantita_destinazione = $quantita_da_spostare;
            }

            // 7. Log del movimento (opzionale - se hai una tabella movimenti)
            // Potresti aggiungere qui il logging in una tabella dedicata ai movimenti

            $conn->commit();

            $response = [
                'success' => true,
                'message' => 'Materiale spostato con successo',
                'data' => [
                    'codice_materiale' => $codice_materiale,
                    'ubicazione_origine' => $ubicazione_origine,
                    'ubicazione_destinazione' => $ubicazione_destinazione,
                    'quantita_spostata' => $quantita_da_spostare,
                    'origine_prima' => $quantita_origine,
                    'origine_dopo' => $nuova_quantita_origine,
                    'destinazione_prima' => $quantita_destinazione ?: 0,
                    'destinazione_dopo' => $nuova_quantita_destinazione
                ]
            ];
            
            logApiEvent($conn, $action, $requestData, 200, $response);
            echo json_encode($response);
            break;

        case 'movimentoMateriale':
            $requiredFields = ['codice_materiale', 'tipo_movimento', 'quantita', 'userName'];
            foreach ($requiredFields as $field) {
                if (!isset($_POST[$field]) || $_POST[$field] === '') {
                    throw new Exception("Campo obbligatorio mancante: $field");
                }
            }

            $tipo_movimento = $_POST['tipo_movimento'];
            $quantita = (float)$_POST['quantita'];

            if ($quantita <= 0) {
                throw new Exception("La quantità deve essere positiva");
            }

            $conn->beginTransaction();

            switch ($tipo_movimento) {
                case 'carico':
                    if (!isset($_POST['ubicazione_destinazione'])) {
                        throw new Exception("Ubicazione destinazione richiesta per carico");
                    }
                    
                    // Trova o crea ubicazione destinazione
                    $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE UPPER(nome_ubicazione) = UPPER(?)");
                    $stmt->execute([trim($_POST['ubicazione_destinazione'])]);
                    $ubicazione_dest_id = $stmt->fetchColumn();

                    if (!$ubicazione_dest_id) {
                        $stmt = $conn->prepare("INSERT INTO ubicazioni (nome_ubicazione, user_created) VALUES (UPPER(?), ?)");
                        $stmt->execute([trim($_POST['ubicazione_destinazione']), strtoupper($_POST['userName'])]);
                        $ubicazione_dest_id = $conn->lastInsertId();
                    }

                    // Aggiorna o crea giacenza
                    $stmt = $conn->prepare("
                        INSERT INTO giacenze_materiali (codice_materiale, ID_ubicazione, quantita_attuale, utente_creazione, utente_modifica)
                        VALUES (?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                        quantita_attuale = quantita_attuale + VALUES(quantita_attuale),
                        utente_modifica = VALUES(utente_modifica)
                    ");
                    $stmt->execute([
                        $_POST['codice_materiale'],
                        $ubicazione_dest_id,
                        $quantita,
                        strtoupper($_POST['userName']),
                        strtoupper($_POST['userName'])
                    ]);
                    break;

                case 'scarico':
                    if (!isset($_POST['ubicazione_origine'])) {
                        throw new Exception("Ubicazione origine richiesta per scarico");
                    }

                    // Trova ubicazione origine
                    $stmt = $conn->prepare("SELECT ID_ubicazione FROM ubicazioni WHERE UPPER(nome_ubicazione) = UPPER(?)");
                    $stmt->execute([trim($_POST['ubicazione_origine'])]);
                    $ubicazione_orig_id = $stmt->fetchColumn();

                    if (!$ubicazione_orig_id) {
                        throw new Exception("Ubicazione origine non trovata");
                    }

                    // Verifica disponibilità
                    $stmt = $conn->prepare("
                        SELECT quantita_disponibile 
                        FROM giacenze_materiali 
                        WHERE codice_materiale = ? AND ID_ubicazione = ?
                    ");
                    $stmt->execute([$_POST['codice_materiale'], $ubicazione_orig_id]);
                    $disponibile = $stmt->fetchColumn();

                    if ($disponibile === false || $disponibile < $quantita) {
                        throw new Exception("Quantità non disponibile. Disponibile: " . ($disponibile ?: 0));
                    }

                    // Aggiorna giacenza
                    $stmt = $conn->prepare("
                        UPDATE giacenze_materiali 
                        SET quantita_attuale = quantita_attuale - ?, utente_modifica = ?
                        WHERE codice_materiale = ? AND ID_ubicazione = ?
                    ");
                    $stmt->execute([
                        $quantita,
                        strtoupper($_POST['userName']),
                        $_POST['codice_materiale'],
                        $ubicazione_orig_id
                    ]);
                    break;

                default:
                    throw new Exception("Tipo movimento non valido: $tipo_movimento");
            }

            $conn->commit();

            echo json_encode([
                'success' => true,
                'message' => "Movimento $tipo_movimento registrato con successo"
            ]);
            break;

        case 'getMaterialeDettaglio':
            if (!isset($_GET['codice_materiale']) || empty($_GET['codice_materiale'])) {
                throw new Exception("Codice materiale richiesto");
            }

            // Dettagli anagrafica materiale
            $stmt = $conn->prepare("SELECT * FROM anagrafica_materiali WHERE codice_materiale = ?");
            $stmt->execute([$_GET['codice_materiale']]);
            $materiale = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$materiale) {
                throw new Exception("Materiale non trovato");
            }

            // Giacenze per ubicazione
            $stmt = $conn->prepare("
                SELECT 
                    gm.*,
                    u.nome_ubicazione,
                    u.indirizzo
                FROM giacenze_materiali gm
                JOIN ubicazioni u ON gm.ID_ubicazione = u.ID_ubicazione
                WHERE gm.codice_materiale = ?
                ORDER BY u.nome_ubicazione
            ");
            $stmt->execute([$_GET['codice_materiale']]);
            $giacenze = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $quantita_totale = array_sum(array_column($giacenze, 'quantita_attuale'));

            echo json_encode([
                'success' => true,
                'data' => [
                    'materiale' => $materiale,
                    'giacenze' => $giacenze,
                    'totali' => [
                        'quantita_totale' => $quantita_totale,
                        'numero_ubicazioni' => count($giacenze)
                    ]
                ]
            ]);
            break;

        case 'getTotaliPerTipo':
            $query = "
                SELECT 
                    am.tipo,
                    am.categoria,
                    COUNT(DISTINCT am.codice_materiale) as numero_materiali,
                    COALESCE(SUM(gm.quantita_attuale), 0) as quantita_totale,
                    COALESCE(SUM(gm.quantita_disponibile), 0) as quantita_disponibile,
                    COALESCE(SUM(gm.quantita_riservata), 0) as quantita_riservata
                FROM anagrafica_materiali am
                LEFT JOIN giacenze_materiali gm ON am.codice_materiale = gm.codice_materiale
                WHERE am.attivo = 1
                GROUP BY am.tipo, am.categoria
                ORDER BY am.categoria, am.tipo
            ";

            $stmt = $conn->query($query);
            $totali = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'count' => count($totali),
                'data' => $totali
            ]);
            break;
        case 'getStorico':
            $params = [];
            $conditions = ["1=1"];
            
            // Gestisce sia 'codice' che 'codice_materiale' per retrocompatibilità
            $codice_materiale = $_GET['codice'] ?? $_GET['codice_materiale'] ?? null;
            if (!empty($codice_materiale)) {
                $conditions[] = "lvm.codice_materiale = ?";
                $params[] = $codice_materiale;
            }

            if (isset($_GET['ubicazione']) && !empty($_GET['ubicazione'])) {
                $conditions[] = "(
                    (u_dest.nome_ubicazione = ? AND lvm.ID_ubicazione_destinazione IS NOT NULL) OR 
                    (u_orig.nome_ubicazione = ? AND lvm.ID_ubicazione_origine IS NOT NULL)
                )";
                $params[] = $_GET['ubicazione'];
                $params[] = $_GET['ubicazione'];
            }

            // Costruisci la query con le condizioni
            $query = "
                SELECT 
                    lvm.*,
                    am.categoria,
                    am.tipo,
                    u_dest.nome_ubicazione as ubicazione_destinazione,
                    u_orig.nome_ubicazione as ubicazione_origine
                FROM LogVariazioniMateriali lvm
                INNER JOIN anagrafica_materiali am ON lvm.codice_materiale = am.codice_materiale
                LEFT JOIN ubicazioni u_dest ON lvm.ID_ubicazione_destinazione = u_dest.ID_ubicazione
                LEFT JOIN ubicazioni u_orig ON lvm.ID_ubicazione_origine = u_orig.ID_ubicazione
                WHERE " . implode(" AND ", $conditions) . "
                ORDER BY lvm.timestamp DESC
            ";

            if (isset($_GET['limit']) && is_numeric($_GET['limit'])) {
                $query .= " LIMIT ?";
                $params[] = (int)$_GET['limit'];
            }

            $stmt = $conn->prepare($query);
            $stmt->execute($params);
            $storico = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'count' => count($storico),
                'data' => $storico
            ]);
            break;

        case 'getAlert':
            // Alert per giacenze basse
            $stmt = $conn->query("
                SELECT 
                    am.codice_materiale,
                    am.categoria,
                    am.tipo,
                    am.soglia_minima,
                    COALESCE(SUM(gm.quantita_disponibile), 0) as quantita_disponibile,
                    'scorta_minima' as tipo_alert
                FROM anagrafica_materiali am
                LEFT JOIN giacenze_materiali gm ON am.codice_materiale = gm.codice_materiale
                WHERE am.attivo = 1 AND am.soglia_minima > 0
                GROUP BY am.codice_materiale
                HAVING quantita_disponibile <= am.soglia_minima
                ORDER BY quantita_disponibile ASC
            ");
            $alert_giacenze = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'count' => count($alert_giacenze),
                'data' => [
                    'giacenze_basse' => $alert_giacenze
                ]
            ]);
            break;

        case 'getCategorie':
            $stmt = $conn->query("
                SELECT 
                    categoria,
                    COUNT(*) as numero_materiali,
                    SUM(CASE WHEN attivo = 1 THEN 1 ELSE 0 END) as materiali_attivi
                FROM anagrafica_materiali 
                GROUP BY categoria 
                ORDER BY categoria
            ");
            $categorie = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'count' => count($categorie),
                'data' => $categorie
            ]);
            break;

        case 'getUbicazioni':
            $stmt = $conn->query("
                SELECT 
                    u.*,
                    COUNT(gm.id) as numero_materiali_giacenza,
                    SUM(CASE WHEN gm.quantita_attuale > 0 THEN 1 ELSE 0 END) as materiali_con_giacenza_positiva
                FROM ubicazioni u
                LEFT JOIN giacenze_materiali gm ON u.ID_ubicazione = gm.ID_ubicazione
                GROUP BY u.ID_ubicazione
                ORDER BY u.nome_ubicazione
            ");
            $ubicazioni = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'count' => count($ubicazioni),
                'data' => $ubicazioni
            ]);
            break;

        case 'addMateriale':
            // Verifica campi obbligatori
            $requiredFields = ['categoria', 'tipo', 'unita_misura', 'userName'];
            foreach ($requiredFields as $field) {
                if (!isset($_POST[$field]) || trim($_POST[$field]) === '') {
                    throw new Exception("Campo obbligatorio mancante: $field");
                }
            }

            // Standardizza i valori in input
            $categoria = strtoupper(trim($_POST['categoria']));
            $tipo = strtoupper(trim($_POST['tipo']));
            $unitaMisura = strtoupper(trim($_POST['unita_misura']));
            $userName = strtoupper(trim($_POST['userName']));
            $sogliaMinima = isset($_POST['soglia_minima']) ? (float)str_replace(',', '.', $_POST['soglia_minima']) : 0;
            $note = isset($_POST['note']) ? trim($_POST['note']) : '';

            // Verifica che il tipo non esista già per questa categoria
            $stmt = $conn->prepare("
                SELECT COUNT(*) 
                FROM anagrafica_materiali 
                WHERE UPPER(categoria) = ? AND UPPER(tipo) = ?
            ");
            $stmt->execute([$categoria, $tipo]);
            if ($stmt->fetchColumn() > 0) {
                throw new Exception("Esiste già un materiale di tipo '$tipo' nella categoria '$categoria'");
            }

            $conn->beginTransaction();
            try {
                // Genera il nuovo codice materiale
                $stmt = $conn->query("
                    SELECT codice_materiale 
                    FROM anagrafica_materiali 
                    WHERE codice_materiale LIKE 'MATE%'
                    ORDER BY codice_materiale DESC 
                    LIMIT 1
                ");
                $lastCode = $stmt->fetchColumn();
                
                if ($lastCode) {
                    $lastNumber = (int)substr($lastCode, 4);
                    $newNumber = $lastNumber + 1;
                } else {
                    $newNumber = 1;
                }
                
                $codice_materiale = 'MATE' . str_pad($newNumber, 4, '0', STR_PAD_LEFT);

                // Inserisci il nuovo materiale
                $stmt = $conn->prepare("
                    INSERT INTO anagrafica_materiali (
                        codice_materiale, 
                        categoria, 
                        tipo, 
                        unita_misura, 
                        soglia_minima, 
                        note,
                        attivo,
                        utente_creazione,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW())
                ");

                $stmt->execute([
                    $codice_materiale,
                    $categoria,
                    $tipo,
                    $unitaMisura,
                    $sogliaMinima,
                    $note,
                    $userName
                ]);

                $conn->commit();

                // Log dell'operazione
                error_log("Nuovo materiale creato - Codice: $codice_materiale, Categoria: $categoria, Tipo: $tipo, Utente: $userName");

                // Restituisci i dati del nuovo materiale
                echo json_encode([
                    'success' => true,
                    'codice_materiale' => $codice_materiale,
                    'message' => 'Materiale creato con successo'
                ]);
            } catch (Exception $e) {
                $conn->rollBack();
                throw $e;
            }
            break;

        case 'getLocations':
            $stmt = $conn->query("
                SELECT 
                    u.*,
                    COUNT(DISTINCT gm.codice_materiale) as numero_materiali,
                    SUM(CASE WHEN gm.quantita_attuale > 0 THEN 1 ELSE 0 END) as materiali_con_giacenza,
                    COALESCE(SUM(gm.quantita_attuale), 0) as quantita_totale,
                    MAX(gm.data_ultimo_inventario) as ultima_data_inventario,
                    MIN(CASE WHEN gm.quantita_attuale > 0 
                        THEN DATEDIFF(CURDATE(), gm.data_ultimo_inventario) 
                        ELSE NULL END) as giorni_da_ultimo_inventario
                FROM ubicazioni u
                LEFT JOIN giacenze_materiali gm ON u.ID_ubicazione = gm.ID_ubicazione
                GROUP BY u.ID_ubicazione
                ORDER BY u.nome_ubicazione
            ");
            $ubicazioni = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'count' => count($ubicazioni),
                'data' => $ubicazioni
            ]);
            break;

        default:
            echo json_encode([
                'success' => false,
                'message' => 'Azione non riconosciuta. Azioni disponibili: getMateriali, getGiacenze, updateGiacenza, movimentoMateriale, getMaterialeDettaglio, getStorico, getAlert, getCategorie, getUbicazioni'
            ]);
            break;
    }
    
} catch (PDOException $e) {
    error_log("ERRORE DB API MATERIALI: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Errore database: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("ERRORE GENERICO API MATERIALI: " . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>