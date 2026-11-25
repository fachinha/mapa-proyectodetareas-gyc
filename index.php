<?php
require_once __DIR__ . '/config.php';
$config = get_app_config();
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestión de Información y Comunicación | Mapa de Carga y Tareas</title>
    
    <!-- Fuentes Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Estilos de la Aplicación -->
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
    <div class="app-container">
        
        <!-- HEADER INSTITUCIONAL -->
        <header class="main-header">
            <div class="brand-wrapper">
                <div class="brand-icon-box" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                </div>
                <div class="brand-info">
                    <h1>División Gestión de la Información y Comunicación Institucional</h1>
                    <p>Monitoreo de proyectos, asignación de tareas y nivel de ocupación del equipo</p>
                </div>
            </div>

            <div class="header-actions">
                <div class="connection-indicator" id="connection-status-pill">
                    <span class="status-dot live pulse" id="status-dot"></span>
                    <span id="connection-status-text">Cargando datos...</span>
                </div>

                <button class="btn btn-primary" id="btn-refresh" title="Sincronizar datos con Trello">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="refresh-icon">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    <span>Sincronizar Trello</span>
                </button>

                <button class="btn btn-secondary" id="btn-open-settings" title="Configurar conexión con Trello">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    <span>Ajustes API</span>
                </button>

                <a id="btn-header-trello-link" href="https://trello.com/b/3X5asYe2/div-gestion-de-la-informacion-y-comunicacion-institucional" target="_blank" rel="noopener noreferrer" class="btn btn-outline" title="Abrir tablero en Trello">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    <span>Abrir Trello</span>
                </a>
            </div>
        </header>

        <!-- BANNER DE AVISO DE CONEXIÓN (SI APLICA) -->
        <div class="alert-banner" id="banner-api-notice" style="display: none;">
            <div class="alert-content">
                <div class="alert-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <div class="alert-text">
                    <h3 id="banner-title">Conexión con Trello requerida</h3>
                    <p id="banner-desc">Actualmente se visualizan datos del equipo. Ingrese su API Key y Token para sincronización continua y automática.</p>
                </div>
            </div>
            <button class="btn btn-secondary" onclick="app.openSettingsModal()">Configurar Conexión</button>
        </div>

        <!-- RESUMEN OPERATIVO GLOBAL (KPIS) -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-title">Equipo de Trabajo</span>
                    <div class="kpi-icon-wrap icon-blue">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-total-members">-</div>
                <div class="kpi-subtext">Integrantes registrados en el tablero</div>
            </div>

            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-title">Tareas en Curso</span>
                    <div class="kpi-icon-wrap icon-amber">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                        </svg>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-active-tasks">-</div>
                <div class="kpi-subtext" id="kpi-active-subtext">Proyectos activos en ejecución</div>
            </div>

            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-title">En Sobrecarga</span>
                    <div class="kpi-icon-wrap icon-rose">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-overload-members">-</div>
                <div class="kpi-subtext">Integrantes con 7 o más proyectos activos</div>
            </div>

            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-title">Completadas</span>
                    <div class="kpi-icon-wrap icon-emerald">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="kpi-value" id="kpi-completed-tasks">-</div>
                <div class="kpi-subtext">Entregas y publicaciones finalizadas</div>
            </div>
        </div>

        <!-- BARRA DE CONTROLES Y FILTROS -->
        <div class="controls-bar">
            <div class="search-box">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="search-input" class="search-input" placeholder="Buscar por integrante, proyecto o etiqueta...">
            </div>

            <div class="filter-group">
                <button class="filter-btn active" data-filter="all">Todos</button>
                <button class="filter-btn" data-filter="overload">Sobrecarga</button>
                <button class="filter-btn" data-filter="high">Carga Alta</button>
                <button class="filter-btn" data-filter="moderate">Moderada</button>
                <button class="filter-btn" data-filter="low">Disponible</button>
            </div>

            <div class="view-tabs">
                <button class="view-tab active" data-view="cards">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                    <span>Integrantes</span>
                </button>
                <button class="view-tab" data-view="matrix">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                    <span>Comparativa</span>
                </button>
                <button class="view-tab" data-view="kanban">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="5" height="18" rx="1"></rect>
                        <rect x="10" y="3" width="5" height="12" rx="1"></rect>
                        <rect x="17" y="3" width="5" height="15" rx="1"></rect>
                    </svg>
                    <span>Por Etapas</span>
                </button>
            </div>
        </div>

        <!-- CONTENIDO PRINCIPAL: VISTA DE INTEGRANTES (DEFAULT) -->
        <div id="view-cards-container">
            <div class="section-header">
                <h2>Carga de Trabajo por Integrante</h2>
                <p>Nivel de ocupación en base a proyectos asignados y capacidad operativa recomendada.</p>
            </div>

            <div class="members-grid" id="members-cards-grid">
                <!-- Se inyecta dinámicamente mediante app.js -->
            </div>
        </div>

        <!-- CONTENIDO PRINCIPAL: VISTA MATRIZ COMPARATIVA -->
        <div id="view-matrix-container" style="display: none;">
            <div class="section-header">
                <h2>Comparativa de Capacidad y Demanda</h2>
                <p>Monitoreo balanceado para redistribución eficiente de nuevas asignaciones y coberturas.</p>
            </div>

            <div class="matrix-view" id="matrix-rows-container">
                <!-- Se inyecta dinámicamente mediante app.js -->
            </div>
        </div>

        <!-- CONTENIDO PRINCIPAL: VISTA TABLERO POR ETAPAS -->
        <div id="view-kanban-container" style="display: none;">
            <div class="section-header">
                <h2>Distribución de Tareas por Etapa</h2>
                <p>Proyectos clasificados según su estado en las listas oficiales del tablero de Trello.</p>
            </div>

            <div class="kanban-view" id="kanban-columns-container">
                <!-- Se inyecta dinámicamente mediante app.js -->
            </div>
        </div>

    </div>

    <!-- ==========================================================================
       MODAL DE DETALLE DE INTEGRANTE
       ========================================================================== -->
    <div class="modal-overlay" id="member-detail-modal">
        <div class="modal-container">
            <div class="modal-header">
                <div class="modal-title-group">
                    <h2 id="modal-member-name">Detalle del Integrante</h2>
                    <p id="modal-member-username">@usuario</p>
                </div>
                <button class="btn-close-modal" onclick="app.closeMemberModal()" title="Cerrar modal">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            
            <div class="modal-body">
                <div class="modal-kpi-row">
                    <div class="modal-kpi-item">
                        <span>Tareas Activas</span>
                        <strong id="modal-kpi-active">0</strong>
                    </div>
                    <div class="modal-kpi-item">
                        <span>Nivel de Carga</span>
                        <strong id="modal-kpi-level">-</strong>
                    </div>
                    <div class="modal-kpi-item">
                        <span>Finalizadas</span>
                        <strong id="modal-kpi-completed">0</strong>
                    </div>
                </div>

                <div class="section-header" style="margin-bottom: 14px;">
                    <h3 style="font-size: 1.1rem; color: #FFFFFF; font-family: var(--font-heading);">Proyectos y Tareas Asignadas</h3>
                    <p style="font-size: 0.82rem; color: var(--text-secondary);">Listado completo de responsabilidades en curso.</p>
                </div>

                <div class="modal-tasks-list" id="modal-tasks-container">
                    <!-- Tareas del miembro inyectadas dinámicamente -->
                </div>
            </div>
        </div>
    </div>

    <!-- ==========================================================================
       MODAL DE CONFIGURACIÓN TRELLO API
       ========================================================================== -->
    <div class="modal-overlay" id="settings-modal">
        <div class="modal-container" style="max-width: 620px;">
            <div class="modal-header">
                <div class="modal-title-group">
                    <h2>Conexión Oficial con Trello</h2>
                    <p>Sincronice el tablero en vivo de la División GyC</p>
                </div>
                <button class="btn-close-modal" onclick="app.closeSettingsModal()" title="Cerrar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div class="modal-body">
                <div class="config-step">
                    <div class="step-header">
                        <span class="step-num">1</span>
                        <span>Autorizar lectura con tu cuenta institucional</span>
                    </div>
                    <p>
                        Tu Clave API ya está configurada. Para obtener tu <strong>Token</strong> de acceso, haz clic en el siguiente botón, presiona <strong>"Permitir"</strong> y copia el código que te mostrará Trello:
                    </p>
                    <a href="https://trello.com/1/authorize?expiration=never&name=MapaTareasGyC&scope=read&response_type=token&key=b965fb95cbe116da68a5e88b85123d71" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="margin-top: 12px; width: 100%;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
                        <span>Abrir ventana para generar Token</span>
                    </a>
                </div>

                <form id="settings-form" onsubmit="app.handleSaveSettings(event)">
                    <div class="form-group">
                        <label class="form-label" for="setting-board-id">ID o Código del Tablero</label>
                        <input type="text" id="setting-board-id" class="form-control" value="3X5asYe2" placeholder="Ej: 3X5asYe2" required>
                        <div class="form-help">Identificador del tablero en la URL de Trello (3X5asYe2).</div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="setting-api-key">Trello API Key (Clave Pública)</label>
                        <input type="text" id="setting-api-key" class="form-control" value="b965fb95cbe116da68a5e88b85123d71" placeholder="Pegue aquí su API Key de 32 caracteres" autocomplete="off">
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="setting-api-token">Trello Token (Autorización)</label>
                        <input type="text" id="setting-api-token" class="form-control" value="" placeholder="Pegue aquí el Token generado" autocomplete="off" required>
                        <div class="form-help">Código obtenido del botón superior para leer de forma segura las tarjetas del tablero.</div>
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                        <button type="button" class="btn btn-secondary" onclick="app.closeSettingsModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btn-save-settings">
                            <span>Guardar y Probar Conexión</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- NOTIFICACIÓN FLOTANTE (TOAST) -->
    <div class="toast-notice" id="toast-notification">
        <svg id="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span id="toast-message">Operación realizada con éxito</span>
    </div>

    <!-- Script Principal -->
    <script src="assets/js/app.js"></script>
</body>
</html>
