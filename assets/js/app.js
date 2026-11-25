/**
 * Aplicación de Gestión de Carga y Tareas - División GyC
 * Comunicación e Información Institucional
 * Compatible con Cloudflare Pages (Frontend estático) y servidores PHP (XAMPP/Apache)
 */

// Áreas y tableros asociados (se buscan por nombre entre los tableros accesibles con el token)
const AREAS = {
    general: { label: 'General' },
    empleo: {
        label: 'Empleo',
        boards: ['calendario de contenido oil'],
        labels: ['empleo', 'expo laboral']
    },
    capacitaciones: {
        label: 'Capacitaciones',
        boards: ['centro de formacion profesional'],
        labels: ['capacitacion']
    },
    pymes: {
        label: 'Emprendimientos y Pymes',
        boards: ['calendario de contenido emprendimientos', 'comunicacion pic'],
        labels: ['emprendimiento', 'pyme']
    }
};

const BOARD_DISPLAY_NAMES = {
    empleo: ['Calendario de Contenido OIL'],
    capacitaciones: ['Centro de Formación Profesional'],
    pymes: ['Calendario de Contenido Emprendimientos y Pymes', 'Comunicación PIC']
};

const normalizeText = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

class TrelloWorkloadApp {
    constructor() {
        this.data = null;
        this.raw = null;
        this.activeArea = 'general';
        this.activeFilter = 'all';
        this.currentView = 'cards';
        this.searchQuery = '';
        this.selectedMember = null;

        // Configuración en cliente
        this.boardId = localStorage.getItem('trello_board_id') || '3X5asYe2';
        // Credenciales por defecto (cuenta con acceso a los tableros de todas las áreas)
        const DEFAULT_KEY = 'e9a19f646cbd6d89b0226c9552b850b4';
        const DEFAULT_TOKEN = 'ATTA012d2cead40358b05c1eead8855cf4c084318b54992248ae5c72b6906d3b0e6cB276DF46';
        const storedKey = localStorage.getItem('trello_api_key');
        const useStored = storedKey && storedKey !== 'b965fb95cbe116da68a5e88b85123d71';
        this.apiKey = useStored ? storedKey : DEFAULT_KEY;
        this.apiToken = useStored ? (localStorage.getItem('trello_api_token') || DEFAULT_TOKEN) : DEFAULT_TOKEN;

        this.initElements();
        this.bindEvents();
        this.loadData();
    }

    initElements() {
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('connection-status-text');
        this.bannerNotice = document.getElementById('banner-api-notice');
        this.bannerTitle = document.getElementById('banner-title');
        this.bannerDesc = document.getElementById('banner-desc');
        this.btnRefresh = document.getElementById('btn-refresh');
        this.refreshIcon = document.getElementById('refresh-icon');

        // KPIs
        this.kpiTotalMembers = document.getElementById('kpi-total-members');
        this.kpiActiveTasks = document.getElementById('kpi-active-tasks');
        this.kpiOverloadMembers = document.getElementById('kpi-overload-members');
        this.kpiCompletedTasks = document.getElementById('kpi-completed-tasks');

        // Contenedores de vistas
        this.cardsGrid = document.getElementById('members-cards-grid');
        this.matrixContainer = document.getElementById('matrix-rows-container');
        this.kanbanContainer = document.getElementById('kanban-columns-container');

        this.viewCardsContainer = document.getElementById('view-cards-container');
        this.viewMatrixContainer = document.getElementById('view-matrix-container');
        this.viewKanbanContainer = document.getElementById('view-kanban-container');

        // Modales
        this.memberModal = document.getElementById('member-detail-modal');
        this.settingsModal = document.getElementById('settings-modal');

        // Toast
        this.toastNotice = document.getElementById('toast-notification');
        this.toastMessage = document.getElementById('toast-message');

        // Prellenar inputs de ajustes
        const inputBoard = document.getElementById('setting-board-id');
        const inputKey = document.getElementById('setting-api-key');
        const inputToken = document.getElementById('setting-api-token');
        if (inputBoard) inputBoard.value = this.boardId;
        if (inputKey && this.apiKey) inputKey.value = this.apiKey;
        if (inputToken && this.apiToken) inputToken.value = this.apiToken;
    }

    bindEvents() {
        // Refrescar datos
        this.btnRefresh.addEventListener('click', () => this.loadData(true));

        // Botón Ajustes
        document.getElementById('btn-open-settings').addEventListener('click', () => this.openSettingsModal());

        // Búsqueda en tiempo real
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            this.render();
        });

        // Selector de área
        const areaTabs = document.querySelectorAll('.area-tab');
        areaTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                areaTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.setArea(tab.dataset.area);
            });
        });

        // Filtros de nivel de carga
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilter = btn.dataset.filter;
                this.render();
            });
        });

        // Pestañas de vista
        const viewTabs = document.querySelectorAll('.view-tab');
        viewTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                viewTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.switchView(tab.dataset.view);
            });
        });

        // Cerrar modales con tecla Escape y clic en fondo
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMemberModal();
                this.closeSettingsModal();
            }
        });

        this.memberModal.addEventListener('click', (e) => {
            if (e.target === this.memberModal) this.closeMemberModal();
        });

        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) this.closeSettingsModal();
        });
    }

    async loadData(forceRefresh = false) {
        try {
            this.setLoading(true);

            // 1. Si tenemos credenciales en el cliente (Cloudflare Pages o directo)
            if (this.apiKey && this.apiToken && this.boardId) {
                // Revisar caché cliente en sessionStorage (5 minutos)
                const cacheKey = `trello_raw_v2_${this.boardId}`;
                const cached = sessionStorage.getItem(cacheKey);
                const cacheTime = sessionStorage.getItem(`${cacheKey}_time`);

                if (!forceRefresh && cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 300000) {
                    this.raw = JSON.parse(cached);
                    this.raw.source = 'cache';
                    this.applyArea();
                    return;
                }

                // Petición directa a Trello REST API (CORS habilitado por Trello)
                try {
                    this.raw = await this.fetchDirectFromTrello();
                    sessionStorage.setItem(cacheKey, JSON.stringify(this.raw));
                    sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());
                    this.applyArea();
                    if (forceRefresh) this.showToast('Datos actualizados en vivo desde Trello');
                    return;
                } catch (trelloErr) {
                    console.warn('Error al consultar directamente a Trello:', trelloErr);
                    // Si falla la petición directa, seguir intentando backend o caché
                }
            }

            // 2. Si no hay credenciales en cliente o estamos en PHP, intentar api/trello.php
            try {
                const url = `api/trello.php${forceRefresh ? '?refresh=1' : ''}`;
                const res = await fetch(url);
                if (res.ok) {
                    this.raw = null;
                    this.data = await res.json();
                    this.updateHeaderAndKPIs();
                    this.updateAreaUI();
                    this.render();
                    if (forceRefresh) this.showToast('Datos actualizados');
                    return;
                }
            } catch (backendErr) {
                // Modo estático puro (Cloudflare Pages sin PHP)
            }

            // 3. Fallback: Dataset institucional de alta fidelidad
            this.raw = this.getDemoInstitutionalDataset();
            this.applyArea();
            if (forceRefresh) this.showToast('Tablero actualizado (Modo Demostración)');

        } catch (err) {
            console.error('Error general al cargar datos:', err);
            this.showToast('Error al procesar datos del tablero');
        } finally {
            this.setLoading(false);
        }
    }

    async fetchDirectFromTrello() {
        const key = encodeURIComponent(this.apiKey);
        const token = encodeURIComponent(this.apiToken);
        const auth = `key=${key}&token=${token}`;

        // 1. Descubrir los tableros de cada área entre los accesibles con este token
        const targets = [{ id: this.boardId, area: null, isMain: true }];
        try {
            const res = await fetch(`https://api.trello.com/1/members/me/boards?filter=open&fields=name,shortLink&${auth}`);
            if (res.ok) {
                const myBoards = await res.json();
                myBoards.forEach(b => {
                    if (b.id === this.boardId || b.shortLink === this.boardId) return;
                    const n = normalizeText(b.name);
                    const areaKey = Object.keys(AREAS).find(k => (AREAS[k].boards || []).some(p => n.includes(p)));
                    if (areaKey) targets.push({ id: b.id, area: areaKey, isMain: false });
                });
            }
        } catch (ignore) {}

        // 2. Descargar cada tablero (lists, cards y members en una sola llamada)
        const boardQuery = 'fields=name,desc,url,shortLink&lists=open&list_fields=name,closed,pos'
            + '&cards=open&card_fields=name,desc,idList,idMembers,labels,due,dueComplete,dateLastActivity,url'
            + '&members=all&member_fields=fullName,username,avatarUrl,initials';

        const payloads = await Promise.all(targets.map(async t => {
            try {
                const res = await fetch(`https://api.trello.com/1/boards/${encodeURIComponent(t.id)}?${boardQuery}&${auth}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return { target: t, board: await res.json() };
            } catch (err) {
                if (t.isMain) throw new Error('No se pudo autenticar con Trello. Verifique API Key y Token.');
                console.warn('No se pudo leer el tablero', t.id, err);
                return null;
            }
        }));

        // 3. Unificar datos de todos los tableros
        const raw = { mainBoard: null, boards: [], lists: [], cards: [], members: [], source: 'trello_live' };
        const memberIndex = {};

        payloads.filter(Boolean).forEach(({ target, board }) => {
            const boardInfo = {
                id: board.id,
                name: board.name,
                url: board.url,
                area: target.area,
                isMain: target.isMain,
                memberIds: (board.members || []).map(m => m.id)
            };
            raw.boards.push(boardInfo);
            if (target.isMain) raw.mainBoard = { id: board.id, name: board.name, desc: board.desc, url: board.url };

            (board.lists || []).forEach(l => raw.lists.push({ ...l, idBoard: board.id, boardName: board.name }));

            (board.members || []).forEach(m => {
                if (!memberIndex[m.id]) {
                    memberIndex[m.id] = true;
                    raw.members.push(m);
                }
            });

            (board.cards || []).forEach(c => {
                raw.cards.push({
                    ...c,
                    idBoard: board.id,
                    boardName: board.name,
                    areas: this.detectCardAreas(c, target.area)
                });
            });
        });

        return raw;
    }

    detectCardAreas(card, boardArea) {
        if (boardArea) return [boardArea];
        const labelNames = (card.labels || []).map(l => normalizeText(l.name));
        return Object.keys(AREAS).filter(k =>
            (AREAS[k].labels || []).some(p => labelNames.some(n => n.includes(p)))
        );
    }

    setArea(area) {
        this.activeArea = AREAS[area] ? area : 'general';
        this.applyArea();
    }

    // Construye la vista (this.data) a partir de los datos crudos, según el área seleccionada
    applyArea() {
        if (!this.raw) {
            this.updateAreaUI();
            this.render();
            return;
        }

        const raw = this.raw;
        const area = this.activeArea;
        let { cards, lists, members } = raw;

        if (area !== 'general') {
            const areaBoards = raw.boards.filter(b => b.area === area);
            cards = cards.filter(c => (c.areas || []).includes(area));

            const usedLists = new Set(cards.map(c => c.idList));
            const areaBoardIds = new Set(areaBoards.map(b => b.id));
            lists = lists.filter(l => usedLists.has(l.id) || areaBoardIds.has(l.idBoard));

            const memberIds = new Set();
            cards.forEach(c => (c.idMembers || []).forEach(id => memberIds.add(id)));
            areaBoards.forEach(b => b.memberIds.forEach(id => memberIds.add(id)));
            members = members.filter(m => memberIds.has(m.id));
        }

        const mainBoard = raw.mainBoard || { id: this.boardId };
        this.data = this.processTrelloPayload(mainBoard, lists, cards, members, raw.source || 'trello_live');
        this.data.multiBoard = raw.boards.length > 1;
        if (raw.notice) this.data.meta.notice = raw.notice;

        this.updateHeaderAndKPIs();
        this.updateAreaUI();
        this.render();
    }

    updateAreaUI() {
        const area = this.activeArea;
        const title = document.getElementById('cards-section-title');
        const notice = document.getElementById('area-notice');
        if (title) {
            title.textContent = area === 'general'
                ? 'Carga de Trabajo por Integrante'
                : `Carga de Trabajo por Integrante · ${AREAS[area].label}`;
        }
        if (!notice) return;

        if (area === 'general' || !this.raw) {
            const extra = this.raw ? this.raw.boards.filter(b => !b.isMain).map(b => b.name) : [];
            notice.style.display = extra.length ? 'block' : 'none';
            notice.textContent = extra.length ? `Tableros incluidos: ${[this.raw.mainBoard?.name, ...extra].filter(Boolean).join(' · ')}` : '';
            return;
        }

        const found = this.raw.boards.filter(b => b.area === area).map(b => b.name);
        const missing = (BOARD_DISPLAY_NAMES[area] || []).filter(name => {
            const n = normalizeText(name);
            return !found.some(f => normalizeText(f).includes(n) || n.includes(normalizeText(f)));
        });

        let text = found.length ? `Tableros: ${found.join(' · ')}. ` : '';
        text += 'Incluye tarjetas del tablero principal con la etiqueta del área.';
        if (missing.length) {
            text += ` Sin acceso todavía a: ${missing.join(', ')} (la cuenta conectada debe ser miembro de esos tableros).`;
        }
        notice.textContent = text;
        notice.style.display = 'block';
    }

    processTrelloPayload(board, lists, cards, members, source = 'trello_live') {
        const listMap = {};
        const doneListIds = {};
        
        lists.forEach(l => {
            listMap[l.id] = l.name;
            const lower = (l.name || '').toLowerCase();
            if (lower.includes('listo') || lower.includes('finaliz') || lower.includes('hecho') || lower.includes('complet') || lower.includes('terminad') || lower.includes('archiv')) {
                doneListIds[l.id] = true;
            }
        });

        const membersData = {};
        members.forEach(m => {
            const avatar = m.avatarUrl ? `${m.avatarUrl}/170.png` : null;
            membersData[m.id] = {
                id: m.id,
                fullName: m.fullName || 'Sin nombre',
                username: m.username || 'usuario',
                initials: m.initials || m.fullName.substring(0, 2).toUpperCase(),
                avatarUrl: avatar,
                cards: [],
                stats: { total: 0, active: 0, completed: 0, overdue: 0, due_soon: 0 },
                workload: { level: 'low', label: 'Disponible', badge_class: 'status-low', percentage: 0, description: 'Carga liviana de tareas' },
                lists_distribution: {}
            };
        });

        const unassignedCards = [];
        const now = Date.now();
        const in48h = now + (48 * 3600 * 1000);

        let totalActive = 0;
        let totalCompleted = 0;
        let totalOverdue = 0;

        cards.forEach(card => {
            const isDone = Boolean(card.dueComplete) || Boolean(doneListIds[card.idList]);
            const listName = listMap[card.idList] || 'Sin lista';

            let dueStatus = 'normal';
            let dueFormatted = null;
            if (card.due) {
                const dueDate = new Date(card.due);
                const dueTime = dueDate.getTime();
                dueFormatted = `${String(dueDate.getDate()).padStart(2, '0')}/${String(dueDate.getMonth() + 1).padStart(2, '0')}/${dueDate.getFullYear()}`;
                
                if (!isDone) {
                    if (dueTime < now) {
                        dueStatus = 'overdue';
                        totalOverdue++;
                    } else if (dueTime <= in48h) {
                        dueStatus = 'due_soon';
                    }
                }
            }

            if (isDone) totalCompleted++;
            else totalActive++;

            const cardItem = {
                id: card.id,
                name: card.name || 'Sin título',
                desc: card.desc || '',
                listId: card.idList,
                listName: listName,
                isDone: isDone,
                due: card.due,
                dueFormatted: dueFormatted,
                dueStatus: dueStatus,
                labels: (card.labels || []).map(l => ({
                    id: l.id || '',
                    name: l.name || 'Etiqueta',
                    color: l.color || 'sky'
                })),
                url: card.url || '#',
                boardName: card.boardName || '',
                areas: card.areas || [],
                dateLastActivity: card.dateLastActivity || null
            };

            const assigned = card.idMembers || [];
            if (assigned.length === 0) {
                unassignedCards.push(cardItem);
            } else {
                assigned.forEach(mId => {
                    if (membersData[mId]) {
                        membersData[mId].cards.push(cardItem);
                        membersData[mId].stats.total++;
                        if (isDone) {
                            membersData[mId].stats.completed++;
                        } else {
                            membersData[mId].stats.active++;
                            if (dueStatus === 'overdue') membersData[mId].stats.overdue++;
                            else if (dueStatus === 'due_soon') membersData[mId].stats.due_soon++;
                        }
                    }
                });
            }
        });

        // Calcular niveles de carga
        let overloadCount = 0;
        let highCount = 0;

        Object.values(membersData).forEach(m => {
            const active = m.stats.active;
            const pct = Math.round((active / 5) * 100);

            let level, label, badgeClass, desc;
            if (active <= 2) {
                level = 'low';
                label = 'Disponible';
                badgeClass = 'status-low';
                desc = 'Carga baja. Disponibilidad alta para nuevos proyectos.';
            } else if (active <= 4) {
                level = 'moderate';
                label = 'Moderada';
                badgeClass = 'status-moderate';
                desc = 'Carga equilibrada y productiva.';
            } else if (active <= 6) {
                level = 'high';
                label = 'Alta';
                badgeClass = 'status-high';
                desc = 'Carga de trabajo elevada. Cerca de capacidad máxima.';
                highCount++;
            } else {
                level = 'overload';
                label = 'Sobrecarga';
                badgeClass = 'status-overload';
                desc = 'Sobrecarga crítica. Se sugiere redistribuir proyectos.';
                overloadCount++;
            }

            m.workload = {
                level: level,
                label: label,
                badge_class: badgeClass,
                percentage: pct,
                description: desc
            };
        });

        // Ordenar miembros por tareas activas descendente
        const sortedMembers = Object.values(membersData).sort((a, b) => b.stats.active - a.stats.active);

        return {
            board: {
                id: board.id || this.boardId,
                name: board.name || 'División Gestión de la Información y Comunicación Institucional',
                desc: board.desc || 'Tablero Oficial de Gestión y Coordinación de Proyectos (GyC)',
                url: board.url || `https://trello.com/b/${this.boardId}`
            },
            summary: {
                total_members: sortedMembers.length,
                total_cards: cards.length,
                total_active: totalActive,
                total_completed: totalCompleted,
                total_overdue: totalOverdue,
                unassigned_count: unassignedCards.length,
                overload_count: overloadCount,
                high_count: highCount
            },
            lists: lists,
            members: sortedMembers,
            unassigned_cards: unassignedCards,
            meta: {
                source: source,
                timestamp: new Date().toISOString(),
                has_api_credentials: Boolean(this.apiKey && this.apiToken)
            }
        };
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.btnRefresh.style.pointerEvents = 'none';
            this.refreshIcon.style.animation = 'spin 1s linear infinite';
            this.statusText.textContent = 'Sincronizando...';
        } else {
            this.btnRefresh.style.pointerEvents = 'auto';
            this.refreshIcon.style.animation = 'none';
        }
    }

    updateHeaderAndKPIs() {
        if (!this.data) return;

        const { summary, meta, board } = this.data;

        // Actualizar enlace directo a Trello en el header si existe
        const headerLink = document.getElementById('btn-header-trello-link');
        if (headerLink && board && board.url) {
            headerLink.href = board.url;
        }

        // Estado de conexión
        this.statusDot.className = 'status-dot';
        if (meta.source === 'trello_live') {
            this.statusDot.classList.add('live', 'pulse');
            this.statusText.textContent = 'En vivo (Trello)';
            this.bannerNotice.style.display = 'none';
        } else if (meta.source === 'cache') {
            this.statusDot.classList.add('live');
            this.statusText.textContent = 'Caché sincronizado';
            this.bannerNotice.style.display = 'none';
        } else {
            this.statusDot.style.backgroundColor = '#F59E0B';
            this.statusText.textContent = 'Modo Demostración';
            this.bannerNotice.style.display = 'flex';
            if (meta.notice) {
                this.bannerDesc.textContent = meta.notice;
            }
        }

        // KPIs
        this.kpiTotalMembers.textContent = summary.total_members;
        this.kpiActiveTasks.textContent = summary.total_active;
        this.kpiOverloadMembers.textContent = summary.overload_count;
        this.kpiCompletedTasks.textContent = summary.total_completed;
    }

    switchView(viewName) {
        this.currentView = viewName;
        this.viewCardsContainer.style.display = viewName === 'cards' ? 'block' : 'none';
        this.viewMatrixContainer.style.display = viewName === 'matrix' ? 'block' : 'none';
        this.viewKanbanContainer.style.display = viewName === 'kanban' ? 'block' : 'none';
        this.render();
    }

    getFilteredMembers() {
        if (!this.data || !this.data.members) return [];

        let membersList = [...this.data.members];

        // Incluir tarjeta de proyectos generales sin asignar si existen
        if (this.data.unassigned_cards && this.data.unassigned_cards.length > 0) {
            const activeUnassigned = this.data.unassigned_cards.filter(c => !c.isDone);
            const unassignedMember = {
                id: 'unassigned_pool',
                fullName: 'Banco de Proyectos (Sin Asignar)',
                username: 'general_gyc',
                initials: 'GyC',
                isUnassignedPool: true,
                cards: this.data.unassigned_cards,
                stats: {
                    total: this.data.unassigned_cards.length,
                    active: activeUnassigned.length,
                    completed: this.data.unassigned_cards.filter(c => c.isDone).length,
                    overdue: this.data.unassigned_cards.filter(c => c.dueStatus === 'overdue').length,
                    due_soon: this.data.unassigned_cards.filter(c => c.dueStatus === 'due_soon').length
                },
                workload: {
                    level: 'moderate',
                    label: 'Pendientes',
                    badge_class: 'status-moderate',
                    percentage: Math.min(Math.round((activeUnassigned.length / 5) * 100), 100),
                    description: 'Proyectos y tareas generales a la espera de ser asignados a un integrante del área.'
                }
            };

            // Solo mostrarlo si el filtro es 'all' o si coincide con la búsqueda
            if (this.activeFilter === 'all') {
                membersList.push(unassignedMember);
            }
        }

        return membersList.filter(member => {
            if (this.activeFilter !== 'all' && member.workload.level !== this.activeFilter) {
                return false;
            }

            if (this.searchQuery) {
                const nameMatch = member.fullName.toLowerCase().includes(this.searchQuery);
                const userMatch = member.username.toLowerCase().includes(this.searchQuery);
                const taskMatch = member.cards.some(c => 
                    c.name.toLowerCase().includes(this.searchQuery) ||
                    (c.labels && c.labels.some(l => l.name.toLowerCase().includes(this.searchQuery)))
                );
                return nameMatch || userMatch || taskMatch;
            }

            return true;
        });
    }

    render() {
        if (this.currentView === 'cards') {
            this.renderCardsView();
        } else if (this.currentView === 'matrix') {
            this.renderMatrixView();
        } else if (this.currentView === 'kanban') {
            this.renderKanbanView();
        }
    }

    renderCardsView() {
        const members = this.getFilteredMembers();
        this.cardsGrid.innerHTML = '';

        if (members.length === 0) {
            this.cardsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px; background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
                    <p style="color: var(--text-secondary); font-size: 1.05rem;">No se encontraron integrantes que coincidan con los filtros aplicados.</p>
                </div>
            `;
            return;
        }

        members.forEach(member => {
            const cardEl = document.createElement('div');
            cardEl.className = `member-card ${member.workload.badge_class}`;

            const avatarHtml = member.avatarUrl
                ? `<div class="member-avatar" style="background-image: url('${member.avatarUrl}');"></div>`
                : `<div class="member-avatar">${this.escapeHtml(member.initials)}</div>`;

            // Ordenar: tareas activas primero (priorizando vencimientos próximos o atrasados), luego completadas; mostrar hasta 5
            const sortedCards = [...member.cards].sort((a, b) => {
                if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
                if (a.dueStatus === 'overdue' && b.dueStatus !== 'overdue') return -1;
                if (b.dueStatus === 'overdue' && a.dueStatus !== 'overdue') return 1;
                if (a.due && b.due) return new Date(a.due) - new Date(b.due);
                return 0;
            });

            const previewTasks = sortedCards.slice(0, 5);

            let tasksListHtml = '';
            if (previewTasks.length > 0) {
                tasksListHtml = previewTasks.map(t => {
                    let dueHtml = '';
                    if (t.dueFormatted) {
                        const dueClass = t.dueStatus === 'overdue' ? 'overdue' : (t.dueStatus === 'due_soon' ? 'due_soon' : '');
                        dueHtml = `<span class="due-indicator ${dueClass}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${t.dueFormatted.split(' ')[0]}
                        </span>`;
                    }
                    const labelsMini = (t.labels || []).slice(0, 2).map(l => {
                        const colorClass = l.color ? `label-${l.color}` : '';
                        return `<span class="task-label-chip ${colorClass}">${this.escapeHtml(l.name)}</span>`;
                    }).join('');

                    const stageHtml = t.isDone
                        ? `<span class="task-mini-stage" style="background: #DCFCE7; color: #16A34A; border: 1px solid #86EFAC;">✓ ${this.escapeHtml(t.listName)}</span>`
                        : `<span class="task-mini-stage">${this.escapeHtml(t.listName)}</span>`;

                    return `
                        <div class="task-mini-item ${t.isDone ? 'is-done-item' : ''}">
                            <div class="task-mini-name">${this.escapeHtml(t.name)}</div>
                            <div class="task-mini-meta">
                                ${stageHtml}
                                ${dueHtml}
                                ${labelsMini}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                tasksListHtml = `<div style="font-size: 0.82rem; color: var(--text-muted); padding: 8px 0;">Sin tareas asignadas actualmente.</div>`;
            }

            cardEl.innerHTML = `
                <div>
                    <div class="member-top">
                        <div class="member-profile">
                            ${avatarHtml}
                            <div class="member-names">
                                <h3>${this.escapeHtml(member.fullName)}</h3>
                                <span>@${this.escapeHtml(member.username)}</span>
                            </div>
                        </div>
                        <div class="workload-badge ${member.workload.badge_class}">
                            <span class="badge-dot"></span>
                            <span>${this.escapeHtml(member.workload.label)}</span>
                        </div>
                    </div>

                    <div class="capacity-box">
                        <div class="capacity-header">
                            <span class="capacity-title">Ocupación estimada</span>
                            <span class="capacity-score">${member.stats.active} tareas (${member.workload.percentage}%)</span>
                        </div>
                        <div class="capacity-bar-track">
                            <div class="capacity-bar-fill ${member.workload.badge_class}" style="width: ${Math.min(member.workload.percentage, 100)}%;"></div>
                        </div>
                        <div class="capacity-desc">${this.escapeHtml(member.workload.description)}</div>
                    </div>

                    <div class="member-tasks-preview">
                        <div class="preview-title">
                            <span>Tareas asignadas (${Math.min(previewTasks.length, 5)} de ${member.stats.total})</span>
                            <span class="preview-counter">${member.stats.active} activas</span>
                        </div>
                        <div class="tasks-mini-list">
                            ${tasksListHtml}
                        </div>
                    </div>
                </div>

                <div class="member-footer">
                    <button class="btn-view-member" onclick="app.openMemberModal('${member.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span>Ver todas las tareas (${member.stats.total})</span>
                    </button>
                </div>
            `;

            this.cardsGrid.appendChild(cardEl);
        });
    }

    renderMatrixView() {
        const members = this.getFilteredMembers();
        this.matrixContainer.innerHTML = '';

        if (members.length === 0) {
            this.matrixContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">Sin resultados.</p>`;
            return;
        }

        members.forEach(m => {
            const row = document.createElement('div');
            row.className = 'matrix-row';

            const fillWidth = Math.min(m.workload.percentage, 100);

            row.innerHTML = `
                <div class="matrix-member-info">
                    <div class="matrix-member-name">${this.escapeHtml(m.fullName)}</div>
                    <div class="matrix-member-meta">${m.stats.active} tareas activas · ${m.stats.completed} finalizadas</div>
                </div>
                <div class="matrix-bar-wrap">
                    <div class="matrix-bar-track">
                        <div class="matrix-bar-fill capacity-bar-fill ${m.workload.badge_class}" style="width: ${fillWidth}%;">
                            ${fillWidth > 15 ? m.workload.percentage + '%' : ''}
                        </div>
                    </div>
                </div>
                <div class="matrix-badge-wrap">
                    <div class="workload-badge ${m.workload.badge_class}">
                        <span class="badge-dot"></span>
                        <span>${this.escapeHtml(m.workload.label)}</span>
                    </div>
                </div>
            `;
            this.matrixContainer.appendChild(row);
        });
    }

    renderKanbanView() {
        if (!this.data || !this.data.lists) return;
        this.kanbanContainer.innerHTML = '';

        const allCards = [];
        this.data.members.forEach(m => {
            m.cards.forEach(c => {
                if (!allCards.some(existing => existing.id === c.id)) {
                    allCards.push({ ...c, assignedTo: m.fullName });
                }
            });
        });

        if (this.data.unassigned_cards) {
            this.data.unassigned_cards.forEach(c => {
                if (!allCards.some(existing => existing.id === c.id)) {
                    allCards.push({ ...c, assignedTo: 'Sin asignar' });
                }
            });
        }

        this.data.lists.forEach(list => {
            const listCards = allCards.filter(c => c.listId === list.id);

            const col = document.createElement('div');
            col.className = 'kanban-column';

            let cardsHtml = listCards.map(c => {
                const labelsMini = (c.labels || []).map(l => {
                    const colorClass = l.color ? `label-${l.color}` : '';
                    return `<span class="task-label-chip ${colorClass}">${this.escapeHtml(l.name)}</span>`;
                }).join('');

                return `
                <div class="kanban-card">
                    <div style="font-weight: 600; color: #FFFFFF; font-size: 0.88rem; margin-bottom: 6px;">
                        ${this.escapeHtml(c.name)}
                    </div>
                    ${labelsMini ? `<div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px;">${labelsMini}</div>` : ''}
                    <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
                        <span>👤 ${this.escapeHtml(c.assignedTo)}</span>
                        ${c.dueFormatted ? `<span>📅 ${c.dueFormatted.split(' ')[0]}</span>` : ''}
                    </div>
                </div>
                `;
            }).join('');

            if (listCards.length === 0) {
                cardsHtml = `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 12px 0; text-align: center;">Sin tarjetas</div>`;
            }

            col.innerHTML = `
                <div class="kanban-column-header">
                    <span class="kanban-column-title">${this.escapeHtml(list.name)}${this.data.multiBoard && list.boardName ? `<small class="kanban-board-name">${this.escapeHtml(list.boardName)}</small>` : ''}</span>
                    <span class="kanban-column-count">${listCards.length}</span>
                </div>
                <div class="kanban-cards">
                    ${cardsHtml}
                </div>
            `;

            this.kanbanContainer.appendChild(col);
        });
    }

    openMemberModal(memberId) {
        if (!this.data) return;
        const member = (this.getFilteredMembers() || []).find(m => m.id === memberId) || (this.data.members || []).find(m => m.id === memberId);
        if (!member) return;

        this.selectedMember = member;

        document.getElementById('modal-member-name').textContent = member.fullName;
        document.getElementById('modal-member-username').textContent = `@${member.username}`;
        document.getElementById('modal-kpi-active').textContent = member.stats.active;
        document.getElementById('modal-kpi-level').textContent = member.workload.label;
        document.getElementById('modal-kpi-completed').textContent = member.stats.completed;

        const tasksContainer = document.getElementById('modal-tasks-container');
        tasksContainer.innerHTML = '';

        if (member.cards.length === 0) {
            tasksContainer.innerHTML = `<p style="color: var(--text-muted); padding: 20px 0; text-align: center;">Este integrante no posee tarjetas asignadas en el tablero.</p>`;
        } else {
            member.cards.forEach(card => {
                const cardEl = document.createElement('div');
                cardEl.className = 'modal-task-card';

                const labelsHtml = (card.labels || []).map(l => {
                    const colorClass = l.color ? `label-${l.color}` : '';
                    return `<span class="task-label-chip ${colorClass}">${this.escapeHtml(l.name)}</span>`;
                }).join('');

                cardEl.innerHTML = `
                    <div class="modal-task-top">
                        <div class="modal-task-title">${this.escapeHtml(card.name)}</div>
                        <span class="task-mini-stage">${this.escapeHtml(card.listName)}</span>
                    </div>
                    ${card.desc ? `<div class="modal-task-desc">${this.escapeHtml(card.desc)}</div>` : ''}
                    ${this.data.multiBoard && card.boardName ? `<div class="modal-task-board">Tablero: ${this.escapeHtml(card.boardName)}</div>` : ''}
                    <div class="modal-task-meta">
                        <div class="task-labels-wrap">
                            ${labelsHtml || '<span style="color: var(--text-muted); font-size: 0.74rem;">Sin etiquetas</span>'}
                        </div>
                        <div style="display: flex; align-items: center; gap: 14px;">
                            ${card.dueFormatted ? `<span class="due-indicator ${card.dueStatus}">📅 ${card.dueFormatted}</span>` : ''}
                            ${card.url && card.url !== '#' ? `
                                <a href="${card.url}" target="_blank" rel="noopener noreferrer" class="btn-open-trello">
                                    <span>Trello</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                </a>
                            ` : ''}
                        </div>
                    </div>
                `;
                tasksContainer.appendChild(cardEl);
            });
        }

        this.memberModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeMemberModal() {
        this.memberModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    openSettingsModal() {
        this.settingsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeSettingsModal() {
        this.settingsModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    async handleSaveSettings(e) {
        e.preventDefault();
        const btn = document.getElementById('btn-save-settings');
        const originalText = btn.innerHTML;

        try {
            btn.innerHTML = '<span>Probando y guardando...</span>';
            btn.style.pointerEvents = 'none';

            const boardId = document.getElementById('setting-board-id').value.trim();
            const apiKey = document.getElementById('setting-api-key').value.trim();
            const apiToken = document.getElementById('setting-api-token').value.trim();

            if (apiKey && apiToken) {
                // Probar directamente con Trello API
                const testRes = await fetch(`https://api.trello.com/1/boards/${encodeURIComponent(boardId)}?fields=name&key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(apiToken)}`);
                if (!testRes.ok) {
                    throw new Error(`Trello rechazó la conexión (Código ${testRes.status}). Verifique la clave y el token.`);
                }
                const testData = await testRes.json();
                this.showToast(`¡Conexión exitosa con el tablero "${testData.name || boardId}"!`);
            }

            // Guardar en localStorage para Cloudflare Pages
            this.boardId = boardId;
            this.apiKey = apiKey;
            this.apiToken = apiToken;
            localStorage.setItem('trello_board_id', boardId);
            localStorage.setItem('trello_api_key', apiKey);
            localStorage.setItem('trello_api_token', apiToken);

            // Limpiar caché de sesión
            sessionStorage.removeItem(`trello_cache_${boardId}`);

            // También intentar guardar en backend PHP si está disponible
            try {
                fetch('api/save_config.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ board_id: boardId, api_key: apiKey, api_token: apiToken })
                });
            } catch (ignore) {}

            this.closeSettingsModal();
            await this.loadData(true);

        } catch (err) {
            console.error('Error al guardar ajustes:', err);
            this.showToast(err.message || 'Error al conectar con Trello');
        } finally {
            btn.innerHTML = originalText;
            btn.style.pointerEvents = 'auto';
        }
    }

    showToast(message) {
        this.toastMessage.textContent = message;
        this.toastNotice.classList.add('show');
        setTimeout(() => {
            this.toastNotice.classList.remove('show');
        }, 4000);
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    getDemoInstitutionalDataset() {
        const demoLists = [
            { id: 'l1', name: 'Bandeja de Entrada / Solicitudes' },
            { id: 'l2', name: 'En Planificación y Guion' },
            { id: 'l3', name: 'En Producción / Diseño / Redacción' },
            { id: 'l4', name: 'En Revisión Institucional' },
            { id: 'l5', name: 'Listo / Publicado' }
        ];

        const demoMembers = [
            { id: 'm1', fullName: 'Lucas Rossi', username: 'lucas_rossi', initials: 'LR', avatarUrl: null },
            { id: 'm2', fullName: 'Mariana Gómez', username: 'mariana_gomez', initials: 'MG', avatarUrl: null },
            { id: 'm3', fullName: 'Esteban Morales', username: 'esteban_morales', initials: 'EM', avatarUrl: null },
            { id: 'm4', fullName: 'Camila Benítez', username: 'camila_benitez', initials: 'CB', avatarUrl: null },
            { id: 'm5', fullName: 'Auxiliar Gestión GyC', username: 'auxiliargestiondelainformacion', initials: 'AG', avatarUrl: null },
            { id: 'm6', fullName: 'Nicolás Herrera', username: 'nicolas_herrera', initials: 'NH', avatarUrl: null }
        ];

        const inDays = (d) => new Date(Date.now() + (d * 86400000)).toISOString();

        const demoCards = [
            { id: 'c1', name: 'Campaña de Vacunación Municipal 2026: Redacción de gacetillas', desc: 'Notas de prensa y partes oficiales.', idList: 'l3', idMembers: ['m1'], due: inDays(1), dueComplete: false, labels: [{ id: 'b1', name: 'Prensa Oficial', color: 'blue' }] },
            { id: 'c2', name: 'Boletín Semanal de Novedades del Municipio: Edición #48', desc: 'Recopilación de proyectos y redacción.', idList: 'l3', idMembers: ['m1'], due: inDays(2), dueComplete: false, labels: [{ id: 'b2', name: 'Comunicación Interna', color: 'green' }] },
            { id: 'c3', name: 'Monitoreo de medios y clipping matutino diario', desc: 'Relevamiento de menciones en prensa.', idList: 'l3', idMembers: ['m1'], due: inDays(4), dueComplete: false, labels: [{ id: 'b3', name: 'Monitoreo', color: 'purple' }] },
            { id: 'c4', name: 'Cobertura fotográfica y testimonios: Nuevo centro de salud', desc: 'Visita con equipo audiovisual.', idList: 'l2', idMembers: ['m1', 'm3'], due: inDays(3), dueComplete: false, labels: [{ id: 'b4', name: 'Audiovisual', color: 'orange' }] },
            { id: 'c5', name: 'Actualización de comunicados en el Portal Web', desc: 'Publicación de ordenanzas.', idList: 'l3', idMembers: ['m1'], due: inDays(5), dueComplete: false, labels: [{ id: 'b5', name: 'Portal Web', color: 'cyan' }] },
            { id: 'c6', name: 'Informe mensual de impacto en medios (Octubre)', desc: 'Métricas completadas.', idList: 'l5', idMembers: ['m1'], due: inDays(-3), dueComplete: true, labels: [{ id: 'b1', name: 'Prensa Oficial', color: 'blue' }] },

            { id: 'c7', name: 'Diseño de identidad visual para Festival Cultural Ciudad', desc: 'Sistema de cartelería y programas.', idList: 'l3', idMembers: ['m2'], due: inDays(1), dueComplete: false, labels: [{ id: 'b6', name: 'Diseño Gráfico', color: 'pink' }] },
            { id: 'c8', name: 'Plantillas de Instagram Stories y Feed para áreas municipales', desc: 'Kit de 20 piezas editables.', idList: 'l3', idMembers: ['m2'], due: inDays(3), dueComplete: false, labels: [{ id: 'b6', name: 'Diseño Gráfico', color: 'pink' }] },
            { id: 'c9', name: 'Folletería digital e impresa: Taller de Empleo Juvenil', desc: 'Flyers y trípticos.', idList: 'l2', idMembers: ['m2'], due: inDays(2), dueComplete: false, labels: [{ id: 'b6', name: 'Diseño Gráfico', color: 'pink' }] },
            { id: 'c10', name: 'Infografía interactiva sobre Presupuesto Participativo', desc: 'Visualización de obras votadas.', idList: 'l3', idMembers: ['m2', 'm5'], due: inDays(-1), dueComplete: false, labels: [{ id: 'b7', name: 'Infografías', color: 'yellow' }] },
            { id: 'c11', name: 'Manual de Normas Gráficas y Uso de Marca Municipal', desc: 'Ajuste tipográfico y color.', idList: 'l4', idMembers: ['m2'], due: inDays(6), dueComplete: false, labels: [{ id: 'b6', name: 'Diseño Gráfico', color: 'pink' }] },
            { id: 'c12', name: 'Banners de señalética para el Centro Cívico Municipal', desc: 'Diseño de tótems indicativos.', idList: 'l3', idMembers: ['m2'], due: inDays(4), dueComplete: false, labels: [{ id: 'b6', name: 'Diseño Gráfico', color: 'pink' }] },
            { id: 'c13', name: 'Posters para Jornada de Donación de Sangre', desc: 'Gráfica urgente de salud.', idList: 'l1', idMembers: ['m2'], due: inDays(0.5), dueComplete: false, labels: [{ id: 'b6', name: 'Diseño Gráfico', color: 'pink' }] },

            { id: 'c14', name: 'Edición de video resumen: Inauguración de nuevo Polideportivo', desc: 'Corte dinámico de 60 segundos.', idList: 'l3', idMembers: ['m3'], due: inDays(2), dueComplete: false, labels: [{ id: 'b4', name: 'Audiovisual', color: 'orange' }] },
            { id: 'c15', name: 'Grabación de Spot radial: Campaña Seguridad Vial', desc: 'Locución institucional.', idList: 'l2', idMembers: ['m3'], due: inDays(4), dueComplete: false, labels: [{ id: 'b4', name: 'Audiovisual', color: 'orange' }] },
            { id: 'c16', name: 'Animación de logotipo municipal para cierres de video', desc: 'Motion graphics en 4K.', idList: 'l4', idMembers: ['m3'], due: inDays(5), dueComplete: false, labels: [{ id: 'b4', name: 'Audiovisual', color: 'orange' }] },

            { id: 'c17', name: 'Plan de Contenidos y Calendario de Redes Sociales', desc: 'Estrategia integral de redes.', idList: 'l2', idMembers: ['m4'], due: inDays(3), dueComplete: false, labels: [{ id: 'b8', name: 'Redes Sociales', color: 'sky' }] },
            { id: 'c18', name: 'Moderación y respuesta a consultas ciudadanas en redes', desc: 'Canales digitales vecinales.', idList: 'l3', idMembers: ['m4'], due: null, dueComplete: false, labels: [{ id: 'b8', name: 'Redes Sociales', color: 'sky' }] },
            { id: 'c19', name: 'Transmisión en vivo: Sesión Concejo Deliberante', desc: 'Streaming por YouTube.', idList: 'l3', idMembers: ['m4'], due: inDays(1), dueComplete: false, labels: [{ id: 'b8', name: 'Redes Sociales', color: 'sky' }] },
            { id: 'c20', name: 'Campaña contra el Dengue: Estrategia de difusión', desc: 'Consejos preventivos comunitarios.', idList: 'l4', idMembers: ['m4'], due: inDays(6), dueComplete: false, labels: [{ id: 'b8', name: 'Redes Sociales', color: 'sky' }] },

            { id: 'c21', name: 'Clasificación y archivo de pedidos de información pública', desc: 'Ley de Acceso a la Información.', idList: 'l3', idMembers: ['m5'], due: inDays(5), dueComplete: false, labels: [{ id: 'b9', name: 'Gestión Documental', color: 'lime' }] },
            { id: 'c22', name: 'Revisión y actualización del inventario técnico audiovisual', desc: 'Cámaras y microfonía.', idList: 'l2', idMembers: ['m5'], due: inDays(7), dueComplete: false, labels: [{ id: 'b9', name: 'Gestión Documental', color: 'lime' }] },

            { id: 'c23', name: 'Optimización de base de datos de periodistas locales', desc: 'Teléfonos y correos oficiales.', idList: 'l2', idMembers: ['m6'], due: inDays(4), dueComplete: false, labels: [{ id: 'b1', name: 'Prensa Oficial', color: 'blue' }] },
            { id: 'c24', name: 'Envío de invitaciones protocolares: Acto Ciudad', desc: 'Convocatoria oficial.', idList: 'l5', idMembers: ['m6'], due: inDays(-5), dueComplete: true, labels: [{ id: 'b2', name: 'Comunicación Interna', color: 'green' }] }
        ];

        const boardInfo = {
            id: this.boardId,
            name: 'División Gestión de la Información y Comunicación Institucional',
            desc: 'Tablero Oficial de Gestión y Coordinación de Proyectos (GyC)',
            url: `https://trello.com/b/${this.boardId}/div-gestion-de-la-informacion-y-comunicacion-institucional`
        };

        const cardsWithAreas = demoCards.map(c => ({ ...c, areas: this.detectCardAreas(c, null) }));
        return {
            mainBoard: boardInfo,
            boards: [{ id: boardInfo.id, name: boardInfo.name, url: boardInfo.url, area: null, isMain: true, memberIds: demoMembers.map(m => m.id) }],
            lists: demoLists,
            cards: cardsWithAreas,
            members: demoMembers,
            source: 'demo_dataset',
            notice: 'Mostrando datos de la división. Ingrese su API Key y Token en Ajustes para sincronizar en vivo con Trello.'
        };
    }
}

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TrelloWorkloadApp();
});
