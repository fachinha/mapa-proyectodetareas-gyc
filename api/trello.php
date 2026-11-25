<?php
/**
 * API Endpoint para Trello
 * División Gestión de la Información y Comunicación Institucional
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../config.php';

$config = get_app_config();
$force_refresh = isset($_GET['refresh']) && $_GET['refresh'] == '1';

// Verificar caché existente y vigente
if (!$force_refresh && file_exists(CACHE_FILE)) {
    $cache_time = filemtime(CACHE_FILE);
    if ((time() - $cache_time) < $config['cache_ttl']) {
        $cached_content = file_get_contents(CACHE_FILE);
        $decoded = json_decode($cached_content, true);
        if ($decoded) {
            $decoded['meta']['source'] = 'cache';
            $decoded['meta']['cached_at'] = date('Y-m-d H:i:s', $cache_time);
            $decoded['meta']['cache_age_seconds'] = time() - $cache_time;
            echo json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

// Función para llamada cURL a Trello
function trello_request($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 12);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'GestionComInfo-App/1.0');
    
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);

    if ($http_code !== 200 || !$response) {
        return ['error' => true, 'code' => $http_code, 'message' => $curl_error ?: $response];
    }

    $data = json_decode($response, true);
    return ['error' => false, 'data' => $data];
}

// Procesar datos de Trello o fallback
$result = null;

if (!empty($config['api_key']) && !empty($config['api_token']) && !empty($config['board_id'])) {
    $key = urlencode($config['api_key']);
    $token = urlencode($config['api_token']);
    $board_id = urlencode($config['board_id']);

    // 1. Obtener datos del tablero
    $board_res = trello_request("https://api.trello.com/1/boards/{$board_id}?fields=name,desc,url,prefs&key={$key}&token={$token}");
    
    // 2. Obtener listas
    $lists_res = trello_request("https://api.trello.com/1/boards/{$board_id}/lists?fields=name,closed,pos&key={$key}&token={$token}");
    
    // 3. Obtener tarjetas
    $cards_res = trello_request("https://api.trello.com/1/boards/{$board_id}/cards?fields=name,desc,idList,idMembers,labels,due,dueComplete,dateLastActivity,url&key={$key}&token={$token}");
    
    // 4. Obtener miembros
    $members_res = trello_request("https://api.trello.com/1/boards/{$board_id}/members?fields=fullName,username,avatarUrl,initials&key={$key}&token={$token}");

    if (!$board_res['error'] && !$lists_res['error'] && !$cards_res['error'] && !$members_res['error']) {
        $result = process_trello_payload(
            $board_res['data'],
            $lists_res['data'],
            $cards_res['data'],
            $members_res['data'],
            $config,
            'trello_live'
        );

        // Guardar en caché
        if (!is_dir(CACHE_DIR)) {
            mkdir(CACHE_DIR, 0777, true);
        }
        file_put_contents(CACHE_FILE, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    } else {
        $error_detail = [
            'board' => $board_res['error'] ? $board_res['message'] : 'ok',
            'lists' => $lists_res['error'] ? $lists_res['message'] : 'ok',
            'cards' => $cards_res['error'] ? $cards_res['message'] : 'ok',
            'members' => $members_res['error'] ? $members_res['message'] : 'ok',
        ];
    }
}

// Si no se pudo obtener de Trello en vivo (sin credenciales o error), revisar caché anterior
if (!$result && file_exists(CACHE_FILE)) {
    $cached_content = file_get_contents(CACHE_FILE);
    $decoded = json_decode($cached_content, true);
    if ($decoded) {
        $decoded['meta']['source'] = 'stale_cache';
        $decoded['meta']['warning'] = 'No se pudo conectar con Trello en vivo, mostrando última versión guardada.';
        echo json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Si aún no hay resultado, generar dataset demostrativo institucional de alta fidelidad
if (!$result) {
    $result = get_demo_institutional_dataset($config, isset($error_detail) ? $error_detail : null);
}

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
exit;

/**
 * Procesa tarjetas, listas y miembros para calcular métricas de ocupación
 */
function process_trello_payload($board, $lists, $cards, $members, $config, $source = 'trello_live') {
    // Mapa de listas por ID
    $list_map = [];
    $done_list_ids = [];
    foreach ($lists as $list) {
        $list_map[$list['id']] = $list['name'];
        $lower = mb_strtolower($list['name'], 'UTF-8');
        if (strpos($lower, 'listo') !== false || 
            strpos($lower, 'finaliz') !== false || 
            strpos($lower, 'hecho') !== false || 
            strpos($lower, 'complet') !== false ||
            strpos($lower, 'terminad') !== false ||
            strpos($lower, 'archiv') !== false) {
            $done_list_ids[$list['id']] = true;
        }
    }

    $thresholds = $config['thresholds'];

    // Inicializar mapa de miembros
    $members_data = [];
    foreach ($members as $m) {
        $avatar = !empty($m['avatarUrl']) ? $m['avatarUrl'] . '/170.png' : null;
        $members_data[$m['id']] = [
            'id' => $m['id'],
            'fullName' => $m['fullName'],
            'username' => $m['username'],
            'initials' => !empty($m['initials']) ? $m['initials'] : substr($m['fullName'], 0, 2),
            'avatarUrl' => $avatar,
            'cards' => [],
            'stats' => [
                'total' => 0,
                'active' => 0,
                'completed' => 0,
                'overdue' => 0,
                'due_soon' => 0
            ],
            'workload' => [
                'level' => 'low',
                'label' => 'Disponible',
                'badge_class' => 'status-low',
                'percentage' => 0,
                'description' => 'Carga liviana de tareas'
            ],
            'lists_distribution' => []
        ];
    }

    // Miembro ficticio para tarjetas sin asignar
    $unassigned_cards = [];

    $now = time();
    $in_48h = $now + (48 * 3600);

    $total_cards = count($cards);
    $total_active = 0;
    $total_completed = 0;
    $total_overdue = 0;

    foreach ($cards as $card) {
        $is_done = !empty($card['dueComplete']) || isset($done_list_ids[$card['idList']]);
        $list_name = isset($list_map[$card['idList']]) ? $list_map[$card['idList']] : 'Sin lista';
        
        $due_status = 'normal';
        $due_formatted = null;
        if (!empty($card['due'])) {
            $due_time = strtotime($card['due']);
            $due_formatted = date('d/m/Y H:i', $due_time);
            if (!$is_done) {
                if ($due_time < $now) {
                    $due_status = 'overdue';
                    $total_overdue++;
                } elseif ($due_time <= $in_48h) {
                    $due_status = 'due_soon';
                }
            }
        }

        if ($is_done) {
            $total_completed++;
        } else {
            $total_active++;
        }

        $card_item = [
            'id' => $card['id'],
            'name' => $card['name'],
            'desc' => !empty($card['desc']) ? $card['desc'] : '',
            'listId' => $card['idList'],
            'listName' => $list_name,
            'isDone' => $is_done,
            'due' => $card['due'] ?? null,
            'dueFormatted' => $due_formatted,
            'dueStatus' => $due_status,
            'labels' => array_map(function($l) {
                return [
                    'id' => $l['id'] ?? '',
                    'name' => !empty($l['name']) ? $l['name'] : 'Etiqueta',
                    'color' => !empty($l['color']) ? $l['color'] : 'sky'
                ];
            }, $card['labels'] ?? []),
            'url' => $card['url'] ?? '#',
            'dateLastActivity' => $card['dateLastActivity'] ?? null
        ];

        $assigned_ids = $card['idMembers'] ?? [];
        if (empty($assigned_ids)) {
            $unassigned_cards[] = $card_item;
        } else {
            foreach ($assigned_ids as $m_id) {
                if (isset($members_data[$m_id])) {
                    $members_data[$m_id]['cards'][] = $card_item;
                    $members_data[$m_id]['stats']['total']++;
                    
                    if ($is_done) {
                        $members_data[$m_id]['stats']['completed']++;
                    } else {
                        $members_data[$m_id]['stats']['active']++;
                        if ($due_status === 'overdue') {
                            $members_data[$m_id]['stats']['overdue']++;
                        } elseif ($due_status === 'due_soon') {
                            $members_data[$m_id]['stats']['due_soon']++;
                        }
                    }

                    // Distribución por lista
                    if (!isset($members_data[$m_id]['lists_distribution'][$list_name])) {
                        $members_data[$m_id]['lists_distribution'][$list_name] = 0;
                    }
                    $members_data[$m_id]['lists_distribution'][$list_name]++;
                }
            }
        }
    }

    // Calcular nivel de carga (Workload) por integrante
    $overloaded_members_count = 0;
    $high_load_count = 0;

    foreach ($members_data as $m_id => &$m) {
        $active_count = $m['stats']['active'];
        
        // Capacidad recomendada: 5 tareas activas = 100% de ocupación óptima
        $capacity_pct = round(($active_count / 5) * 100);

        if ($active_count <= $thresholds['low']) {
            $level = 'low';
            $label = 'Disponible';
            $badge_class = 'status-low';
            $desc = 'Carga baja. Disponibilidad alta para nuevos requerimientos.';
        } elseif ($active_count <= $thresholds['moderate']) {
            $level = 'moderate';
            $label = 'Moderada';
            $badge_class = 'status-moderate';
            $desc = 'Carga equilibrada y productiva.';
        } elseif ($active_count <= $thresholds['high']) {
            $level = 'high';
            $label = 'Alta';
            $badge_class = 'status-high';
            $desc = 'Carga de trabajo elevada. Cerca del límite de capacidad.';
            $high_load_count++;
        } else {
            $level = 'overload';
            $label = 'Sobrecarga';
            $badge_class = 'status-overload';
            $desc = 'Sobrecarga crítica. Se sugiere redistribuir proyectos.';
            $overloaded_members_count++;
        }

        $m['workload'] = [
            'level' => $level,
            'label' => $label,
            'badge_class' => $badge_class,
            'percentage' => $capacity_pct,
            'description' => $desc
        ];
    }
    unset($m);

    // Ordenar integrantes por cantidad de tareas activas (descendente)
    uasort($members_data, function($a, $b) {
        return $b['stats']['active'] <=> $a['stats']['active'];
    });

    return [
        'board' => [
            'id' => $board['id'] ?? '3X5asYe2',
            'name' => $board['name'] ?? 'División Gestión de la Información y Comunicación Institucional',
            'desc' => $board['desc'] ?? 'Tablero Oficial de Gestión y Coordinación de Proyectos',
            'url' => $board['url'] ?? $config['board_url']
        ],
        'summary' => [
            'total_members' => count($members_data),
            'total_cards' => $total_cards,
            'total_active' => $total_active,
            'total_completed' => $total_completed,
            'total_overdue' => $total_overdue,
            'unassigned_count' => count($unassigned_cards),
            'overload_count' => $overloaded_members_count,
            'high_count' => $high_load_count
        ],
        'lists' => array_values($lists),
        'members' => array_values($members_data),
        'unassigned_cards' => $unassigned_cards,
        'meta' => [
            'source' => $source,
            'timestamp' => date('Y-m-d H:i:s'),
            'has_api_credentials' => !empty($config['api_key']) && !empty($config['api_token'])
        ]
    ];
}

/**
 * Dataset institucional realista de respaldo mientras se conectan las credenciales
 */
function get_demo_institutional_dataset($config, $error_detail = null) {
    $demo_lists = [
        ['id' => 'l1', 'name' => 'Bandeja de Entrada / Solicitudes'],
        ['id' => 'l2', 'name' => 'En Planificación y Guion'],
        ['id' => 'l3', 'name' => 'En Producción / Diseño / Redacción'],
        ['id' => 'l4', 'name' => 'En Revisión Institucional'],
        ['id' => 'l5', 'name' => 'Listo / Publicado']
    ];

    $demo_members = [
        [
            'id' => 'm1',
            'fullName' => 'Lucas Rossi',
            'username' => 'lucas_rossi',
            'initials' => 'LR',
            'avatarUrl' => null
        ],
        [
            'id' => 'm2',
            'fullName' => 'Mariana Gómez',
            'username' => 'mariana_gomez',
            'initials' => 'MG',
            'avatarUrl' => null
        ],
        [
            'id' => 'm3',
            'fullName' => 'Esteban Morales',
            'username' => 'esteban_morales',
            'initials' => 'EM',
            'avatarUrl' => null
        ],
        [
            'id' => 'm4',
            'fullName' => 'Camila Benítez',
            'username' => 'camila_benitez',
            'initials' => 'CB',
            'avatarUrl' => null
        ],
        [
            'id' => 'm5',
            'fullName' => 'Auxiliar Gestión GyC',
            'username' => 'auxiliargestiondelainformacion',
            'initials' => 'AG',
            'avatarUrl' => null
        ],
        [
            'id' => 'm6',
            'fullName' => 'Nicolás Herrera',
            'username' => 'nicolas_herrera',
            'initials' => 'NH',
            'avatarUrl' => null
        ]
    ];

    $demo_cards = [
        // Lucas Rossi (Carga Alta / 5 tareas activas)
        [
            'id' => 'c1',
            'name' => 'Campaña de Vacunación Municipal 2026: Redacción de gacetillas y cronograma',
            'desc' => 'Elaboración de notas de prensa, partes oficiales y piezas de difusión comunitaria.',
            'idList' => 'l3',
            'idMembers' => ['m1'],
            'due' => date('c', strtotime('+1 day')),
            'dueComplete' => false,
            'labels' => [['id' => 'b1', 'name' => 'Prensa Oficial', 'color' => 'blue']]
        ],
        [
            'id' => 'c2',
            'name' => 'Boletín Semanal de Novedades del Municipio: Edición #48',
            'desc' => 'Recopilación de proyectos de las secretarías y redacción integral.',
            'idList' => 'l3',
            'idMembers' => ['m1'],
            'due' => date('c', strtotime('+2 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b2', 'name' => 'Comunicación Interna', 'color' => 'green']]
        ],
        [
            'id' => 'c3',
            'name' => 'Monitoreo de medios y clipping matutino diario',
            'desc' => 'Relevamiento de menciones en prensa digital, radio y televisión local.',
            'idList' => 'l3',
            'idMembers' => ['m1'],
            'due' => date('c', strtotime('+4 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b3', 'name' => 'Monitoreo', 'color' => 'purple']]
        ],
        [
            'id' => 'c4',
            'name' => 'Cobertura fotográfica y testimonios: Obra nuevo centro de salud',
            'desc' => 'Visita con equipo técnico para registro fotográfico y video institucional.',
            'idList' => 'l2',
            'idMembers' => ['m1', 'm3'],
            'due' => date('c', strtotime('+3 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b4', 'name' => 'Audiovisual', 'color' => 'orange']]
        ],
        [
            'id' => 'c5',
            'name' => 'Actualización de datos y comunicados en el Portal Web',
            'desc' => 'Subida de resoluciones y normativas vigentes a la sección de transparencia.',
            'idList' => 'l3',
            'idMembers' => ['m1'],
            'due' => date('c', strtotime('+5 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b5', 'name' => 'Portal Web', 'color' => 'cyan']]
        ],
        [
            'id' => 'c6',
            'name' => 'Informe mensual de impacto en medios digitales (Octubre)',
            'desc' => 'Métricas completadas y presentadas a dirección.',
            'idList' => 'l5',
            'idMembers' => ['m1'],
            'due' => date('c', strtotime('-3 days')),
            'dueComplete' => true,
            'labels' => [['id' => 'b1', 'name' => 'Prensa Oficial', 'color' => 'blue']]
        ],

        // Mariana Gómez (Sobrecarga / 7 tareas activas)
        [
            'id' => 'c7',
            'name' => 'Diseño de identidad visual para Festival Cultural Ciudad',
            'desc' => 'Sistema de cartelería, banners y programas de mano impresos.',
            'idList' => 'l3',
            'idMembers' => ['m2'],
            'due' => date('c', strtotime('+1 day')),
            'dueComplete' => false,
            'labels' => [['id' => 'b6', 'name' => 'Diseño Gráfico', 'color' => 'pink']]
        ],
        [
            'id' => 'c8',
            'name' => 'Plantillas de Instagram Stories y Feed para áreas municipales',
            'desc' => 'Kit de 20 piezas editables para avisos de tránsito y servicios públicos.',
            'idList' => 'l3',
            'idMembers' => ['m2'],
            'due' => date('c', strtotime('+3 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b6', 'name' => 'Diseño Gráfico', 'color' => 'pink']]
        ],
        [
            'id' => 'c9',
            'name' => 'Folletería digital e impresa: Taller de Empleo Juvenil',
            'desc' => 'Flyers de convocatoria y trípticos explicativos.',
            'idList' => 'l2',
            'idMembers' => ['m2'],
            'due' => date('c', strtotime('+2 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b6', 'name' => 'Diseño Gráfico', 'color' => 'pink']]
        ],
        [
            'id' => 'c10',
            'name' => 'Infografía interactiva sobre Presupuesto Participativo',
            'desc' => 'Visualización de datos sobre las obras votadas por los vecinos.',
            'idList' => 'l3',
            'idMembers' => ['m2', 'm5'],
            'due' => date('c', strtotime('-1 day')),
            'dueComplete' => false,
            'labels' => [['id' => 'b7', 'name' => 'Infografías', 'color' => 'yellow']]
        ],
        [
            'id' => 'c11',
            'name' => 'Manual de Normas Gráficas y Uso de Marca Municipal (Revisión)',
            'desc' => 'Ajuste de tipografías y paleta cromática institucional.',
            'idList' => 'l4',
            'idMembers' => ['m2'],
            'due' => date('c', strtotime('+6 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b6', 'name' => 'Diseño Gráfico', 'color' => 'pink']]
        ],
        [
            'id' => 'c12',
            'name' => 'Banners de señalética para el Centro Cívico Municipal',
            'desc' => 'Diseño de tótems indicativos y cartelería de orientación.',
            'idList' => 'l3',
            'idMembers' => ['m2'],
            'due' => date('c', strtotime('+4 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b6', 'name' => 'Diseño Gráfico', 'color' => 'pink']]
        ],
        [
            'id' => 'c13',
            'name' => 'Posters para Jornada de Donación de Sangre Hospital Municipal',
            'desc' => 'Gráfica urgente solicitada por la Secretaría de Salud.',
            'idList' => 'l1',
            'idMembers' => ['m2'],
            'due' => date('c', strtotime('+12 hours')),
            'dueComplete' => false,
            'labels' => [['id' => 'b6', 'name' => 'Diseño Gráfico', 'color' => 'pink']]
        ],

        // Esteban Morales (Carga Moderada / 3 tareas activas)
        [
            'id' => 'c14',
            'name' => 'Edición de video resumen: Inauguración de nuevo Polideportivo',
            'desc' => 'Corte dinámico para redes sociales de 60 segundos y versión institucional.',
            'idList' => 'l3',
            'idMembers' => ['m3'],
            'due' => date('c', strtotime('+2 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b4', 'name' => 'Audiovisual', 'color' => 'orange']]
        ],
        [
            'id' => 'c15',
            'name' => 'Grabación de Spot radial: Campaña Seguridad Vial',
            'desc' => 'Locución institucional y edición de sonido con efectos.',
            'idList' => 'l2',
            'idMembers' => ['m3'],
            'due' => date('c', strtotime('+4 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b4', 'name' => 'Audiovisual', 'color' => 'orange']]
        ],
        [
            'id' => 'c16',
            'name' => 'Animación de logotipo municipal para cierres de video (Motion Graphics)',
            'desc' => 'Render en 4K con transparencia para el banco de medios.',
            'idList' => 'l4',
            'idMembers' => ['m3'],
            'due' => date('c', strtotime('+5 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b4', 'name' => 'Audiovisual', 'color' => 'orange']]
        ],

        // Camila Benítez (Carga Moderada / 4 tareas activas)
        [
            'id' => 'c17',
            'name' => 'Plan de Contenidos y Calendario de Redes Sociales (Mes entrante)',
            'desc' => 'Estrategia para TikTok, Instagram y Facebook institucional.',
            'idList' => 'l2',
            'idMembers' => ['m4'],
            'due' => date('c', strtotime('+3 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b8', 'name' => 'Redes Sociales', 'color' => 'sky']]
        ],
        [
            'id' => 'c18',
            'name' => 'Moderación y respuesta a consultas ciudadanas en canales digitales',
            'desc' => 'Gestión de reclamos vecinales y derivación a las áreas correspondientes.',
            'idList' => 'l3',
            'idMembers' => ['m4'],
            'due' => null,
            'dueComplete' => false,
            'labels' => [['id' => 'b8', 'name' => 'Redes Sociales', 'color' => 'sky']]
        ],
        [
            'id' => 'c19',
            'name' => 'Transmisión en vivo: Sesión Ordinaria del Concejo Deliberante',
            'desc' => 'Configuración de streaming vía YouTube y monitoreo de audio en vivo.',
            'idList' => 'l3',
            'idMembers' => ['m4'],
            'due' => date('c', strtotime('+1 day')),
            'dueComplete' => false,
            'labels' => [['id' => 'b8', 'name' => 'Redes Sociales', 'color' => 'sky']]
        ],
        [
            'id' => 'c20',
            'name' => 'Campaña contra el Dengue: Estrategia de difusión comunitaria',
            'desc' => 'Calendarización de posteos preventivos y respuestas frecuentes.',
            'idList' => 'l4',
            'idMembers' => ['m4'],
            'due' => date('c', strtotime('+6 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b8', 'name' => 'Redes Sociales', 'color' => 'sky']]
        ],

        // Auxiliar Gestión GyC (Carga Baja / 2 tareas activas)
        [
            'id' => 'c21',
            'name' => 'Clasificación y archivo de pedidos de información pública (Ley de Acceso)',
            'desc' => 'Registro de expedientes ingresados y seguimiento de plazos legales.',
            'idList' => 'l3',
            'idMembers' => ['m5'],
            'due' => date('c', strtotime('+5 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b9', 'name' => 'Gestión Documental', 'color' => 'lime']]
        ],
        [
            'id' => 'c22',
            'name' => 'Revisión y actualización del inventario de equipamiento técnico audiovisual',
            'desc' => 'Relevamiento de cámaras, micrófonos e iluminación en depósito.',
            'idList' => 'l2',
            'idMembers' => ['m5'],
            'due' => date('c', strtotime('+7 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b9', 'name' => 'Gestión Documental', 'color' => 'lime']]
        ],

        // Nicolás Herrera (Carga Baja / 1 tarea activa - Disponible)
        [
            'id' => 'c23',
            'name' => 'Optimización y respaldo de la base de datos de contactos de prensa',
            'desc' => 'Verificación de teléfonos y correos de periodistas y corresponsales.',
            'idList' => 'l2',
            'idMembers' => ['m6'],
            'due' => date('c', strtotime('+4 days')),
            'dueComplete' => false,
            'labels' => [['id' => 'b1', 'name' => 'Prensa Oficial', 'color' => 'blue']]
        ],
        [
            'id' => 'c24',
            'name' => 'Envío masivo de invitaciones protocolares: Acto 9 de Julio',
            'desc' => 'Convocatoria a autoridades e instituciones intermedias.',
            'idList' => 'l5',
            'idMembers' => ['m6'],
            'due' => date('c', strtotime('-5 days')),
            'dueComplete' => true,
            'labels' => [['id' => 'b2', 'name' => 'Comunicación Interna', 'color' => 'green']]
        ]
    ];

    $board_info = [
        'id' => $config['board_id'],
        'name' => 'División Gestión de la Información y Comunicación Institucional',
        'desc' => 'Tablero Oficial de Gestión y Coordinación de Proyectos (GyC)',
        'url' => $config['board_url']
    ];

    $processed = process_trello_payload($board_info, $demo_lists, $demo_cards, $demo_members, $config, 'demo_dataset');
    
    if ($error_detail) {
        $processed['meta']['api_error'] = $error_detail;
        $processed['meta']['notice'] = 'Conexión a Trello pendiente. El tablero requiere Clave API y Token de autorización.';
    } else {
        $processed['meta']['notice'] = 'Mostrando datos de la división. Ingrese su API Key y Token para sincronizar en vivo con Trello.';
    }

    return $processed;
}
