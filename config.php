<?php
/**
 * Configuración de la aplicación
 * División Gestión de la Información y Comunicación Institucional
 */

define('CONFIG_FILE', __DIR__ . '/config.json');
define('CACHE_DIR', __DIR__ . '/cache');
define('CACHE_FILE', CACHE_DIR . '/trello_cache.json');
define('DEFAULT_CACHE_TTL', 300); // 5 minutos de caché

function get_app_config() {
    $default_config = [
        'board_id' => '3X5asYe2',
        'api_key' => '',
        'api_token' => '',
        'board_url' => 'https://trello.com/b/3X5asYe2/div-gestion-de-la-informacion-y-comunicacion-institucional',
        'cache_ttl' => DEFAULT_CACHE_TTL,
        'thresholds' => [
            'low' => 2,      // 0-2 tareas activas: Carga Baja / Disponible
            'moderate' => 4, // 3-4 tareas: Carga Moderada
            'high' => 6,     // 5-6 tareas: Carga Alta
            'overload' => 7  // 7+ tareas: Sobrecarga
        ]
    ];

    if (file_exists(CONFIG_FILE)) {
        $json = file_get_contents(CONFIG_FILE);
        $saved = json_decode($json, true);
        if (is_array($saved)) {
            $default_config = array_replace_recursive($default_config, $saved);
        }
    }

    // Permitir variables de entorno si existen
    if (!empty(getenv('TRELLO_API_KEY'))) {
        $default_config['api_key'] = getenv('TRELLO_API_KEY');
    }
    if (!empty(getenv('TRELLO_API_TOKEN'))) {
        $default_config['api_token'] = getenv('TRELLO_API_TOKEN');
    }
    if (!empty(getenv('TRELLO_BOARD_ID'))) {
        $default_config['board_id'] = getenv('TRELLO_BOARD_ID');
    }

    return $default_config;
}

function save_app_config($data) {
    if (!is_dir(dirname(CONFIG_FILE))) {
        mkdir(dirname(CONFIG_FILE), 0777, true);
    }
    $current = get_app_config();
    $updated = array_replace_recursive($current, $data);
    return file_put_contents(CONFIG_FILE, json_encode($updated, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) !== false;
}
