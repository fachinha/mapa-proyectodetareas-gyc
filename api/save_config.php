<?php
/**
 * Guardar configuración de Trello y validar conexión
 * División Gestión de la Información y Comunicación Institucional
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => true, 'message' => 'Método no permitido']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => true, 'message' => 'Datos inválidos']);
    exit;
}

$api_key = trim($data['api_key'] ?? '');
$api_token = trim($data['api_token'] ?? '');
$board_id = trim($data['board_id'] ?? '3X5asYe2');

// Validar conexión con Trello si se proporcionaron credenciales
$connection_status = 'not_tested';
$test_message = '';

if (!empty($api_key) && !empty($api_token)) {
    $url = "https://api.trello.com/1/boards/" . urlencode($board_id) . "?fields=name,url&key=" . urlencode($api_key) . "&token=" . urlencode($api_token);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_USERAGENT, 'GestionComInfo-App/1.0');
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code === 200) {
        $board_data = json_decode($response, true);
        $connection_status = 'success';
        $test_message = '¡Conexión exitosa con el tablero "' . ($board_data['name'] ?? $board_id) . '"!';
        
        // Limpiar caché previo para forzar recarga en vivo
        if (file_exists(CACHE_FILE)) {
            @unlink(CACHE_FILE);
        }
    } else {
        $connection_status = 'failed';
        $test_message = 'Trello respondió con código HTTP ' . $http_code . ': ' . substr($response, 0, 120);
    }
}

// Guardar configuración
$update_data = [
    'board_id' => $board_id,
    'api_key' => $api_key,
    'api_token' => $api_token
];

$saved = save_app_config($update_data);

echo json_encode([
    'success' => $saved,
    'connection_status' => $connection_status,
    'message' => $test_message ?: ($saved ? 'Configuración guardada correctamente' : 'Error al guardar configuración'),
    'has_credentials' => !empty($api_key) && !empty($api_token)
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
