<?php
require_once 'config.php';

// Ricevi i dati POST e salvali per il logging
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, TRUE);
$GLOBALS['api_request_data'] = $input;

$action = isset($_GET['action']) ? $_GET['action'] : (isset($input['action']) ? $input['action'] : '');

// Connessione al database
$conn = getConnection();

try {
    switch($action) {
        case 'getData':
            try {
                $stmt = $conn->query("SELECT id, codice, categoria, tipo, marca, ubicazione, doc, note FROM attrezzature ORDER BY codice");
                $attrezzature = $stmt->fetchAll(PDO::FETCH_ASSOC);
                sendJsonResponse(['success' => true, 'data' => $attrezzature], $conn);
            } catch(PDOException $e) {
                sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $conn);
            }
            break;

        case 'moveEquipment':
            try {
                $data = $input['data'];
                
                // Inizia la transazione
                $conn->beginTransaction();

                // Aggiorna l'ubicazione dell'attrezzatura
                $stmt = $conn->prepare("UPDATE attrezzature SET ubicazione = ? WHERE codice = ?");
                $stmt->execute([$data['newLocation'], $data['codice']]);

                // Registra nel log
                $stmt = $conn->prepare("INSERT INTO log (timestamp, user_name, azione, tipo_oggetto, codice, vecchia_ubicazione, nuova_ubicazione) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $azione = $data['isNewLocation'] ? 
                    'Spostamento attrezzatura e inserimento nuova ubicazione' : 
                    'Spostamento attrezzatura';
                $stmt->execute([
                    $data['timestamp'],
                    $data['userName'],
                    $azione,
                    'attrezzatura',
                    $data['codice'],
                    $data['oldLocation'],
                    $data['newLocation']
                ]);

                // Commit della transazione
                $conn->commit();
                
                sendJsonResponse(['success' => true, 'message' => 'Attrezzatura spostata con successo'], $conn);
            } catch(PDOException $e) {
                $conn->rollBack();
                sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $conn);
            }
            break;

        case 'addEquipment':
            try {
                $data = $input['data'];
                
                // Inizia la transazione
                $conn->beginTransaction();

                // Genera un nuovo codice
                $stmt = $conn->query("SELECT MAX(CAST(SUBSTRING(codice, 5) AS UNSIGNED)) as max_num FROM attrezzature WHERE codice LIKE 'ATTR%'");
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                $nextNum = str_pad(($result['max_num'] + 1), 4, "0", STR_PAD_LEFT);
                $newCodice = "ATTR" . $nextNum;

                // Inserisci la nuova attrezzatura con il campo doc
                $stmt = $conn->prepare("INSERT INTO attrezzature (codice, categoria, tipo, marca, ubicazione, doc, note) VALUES (?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $newCodice,
                    $data['categoria'],
                    $data['tipo'],
                    $data['marca'],
                    $data['ubicazione'],
                    $data['doc'] ?? null,
                    $data['note'] ?? ''
                ]);

                // Registra nel log
                $stmt = $conn->prepare("INSERT INTO log (timestamp, user_name, azione, tipo_oggetto, codice, nuova_ubicazione) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    date('Y-m-d H:i:s'),
                    $data['userName'] ?? 'Sistema',
                    'Nuova attrezzatura',
                    'attrezzatura',
                    $newCodice,
                    $data['ubicazione']
                ]);

                // Commit della transazione
                $conn->commit();

                sendJsonResponse([
                    'success' => true, 
                    'message' => 'Attrezzatura aggiunta con successo', 
                    'codice' => $newCodice
                ], $conn);
            } catch(PDOException $e) {
                $conn->rollBack();
                sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $conn);
            }
            break;

        case 'updateDoc':
            try {
                $data = $input['data'];
                
                $stmt = $conn->prepare("UPDATE attrezzature SET doc = ? WHERE codice = ?");
                $stmt->execute([$data['doc'], $data['codice']]);

                // Registra nel log
                $stmt = $conn->prepare("INSERT INTO log (timestamp, user_name, azione, tipo_oggetto, codice) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([
                    date('Y-m-d H:i:s'),
                    $data['userName'] ?? 'Sistema',
                    'Aggiornamento documento',
                    'attrezzatura',
                    $data['codice']
                ]);

                sendJsonResponse(['success' => true, 'message' => 'Link documento aggiornato con successo'], $conn);
            } catch(PDOException $e) {
                sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $conn);
            }
            break;

        case 'getLists':
            try {
                $categorie = $conn->query("SELECT DISTINCT categoria FROM attrezzature ORDER BY categoria")->fetchAll(PDO::FETCH_COLUMN);
                $tipi = $conn->query("SELECT DISTINCT tipo FROM attrezzature ORDER BY tipo")->fetchAll(PDO::FETCH_COLUMN);
                $ubicazioni = $conn->query("SELECT DISTINCT ubicazione FROM attrezzature ORDER BY ubicazione")->fetchAll(PDO::FETCH_COLUMN);

                sendJsonResponse([
                    'success' => true,
                    'data' => [
                        'categorie' => $categorie,
                        'tipi' => $tipi,
                        'ubicazioni' => $ubicazioni
                    ]
                ], $conn);
            } catch(PDOException $e) {
                sendJsonResponse(['success' => false, 'message' => $e->getMessage()], $conn);
            }
            break;

        default:
            sendJsonResponse(['success' => false, 'message' => 'Azione non valida'], $conn);
    }
} catch(Exception $e) {
    sendJsonResponse(['success' => false, 'message' => 'Errore interno: ' . $e->getMessage()], $conn);
}
?>
