/**
 * Aplicación de Gestión de Carga y Tareas - División GyC
 * Comunicación e Información Institucional
 */

class TrelloWorkloadApp {
    constructor() {
        this.data = null;
        this.activeFilter = 'all';
        this.currentView = 'cards';
        this.searchQuery = '';
        this.selectedMember = null;

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
            const url = `api/trello.php${forceRefresh ? '?refresh=1' : ''}`;
            const res = await fetch(url);
            
            if (!res.ok) {
                throw new Error(`Error HTTP ${res.status}`);
            }

            this.data = await res.json();
            this.updateHeaderAndKPIs();
            this.render();

            if (forceRefresh) {
                this.showToast('Datos actualizados correctamente desde Trello');
            }
        } catch (err) {
            console.error('Error al cargar datos:', err);
            this.showToast('Error al conectar con la API de Trello');
        } finally {
            this.setLoading(false);
        }
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

        const { summary, meta } = this.data;

        // Estado de conexión
        this.statusDot.className = 'status-dot';
        if (meta.source === 'trello_live') {
            this.statusDot.classList.add('live', 'pulse');
            this.statusText.textContent = 'En vivo (Trello)';
            this.bannerNotice.style.display = 'none';
        } else if (meta.source === 'cache') {
            this.statusDot.classList.add('live');
            this.statusText.textContent = `Caché (${meta.cache_age_seconds ? Math.round(meta.cache_age_seconds / 60) + ' min' : 'Reciente'})`;
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

        return this.data.members.filter(member => {
            // Filtro por nivel
            if (this.activeFilter !== 'all' && member.workload.level !== this.activeFilter) {
                return false;
            }

            // Filtro por búsqueda de texto
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

            // Avatar o iniciales
            const avatarHtml = member.avatarUrl
                ? `<div class="member-avatar" style="background-image: url('${member.avatarUrl}');"></div>`
                : `<div class="member-avatar">${this.escapeHtml(member.initials)}</div>`;

            // Resumen de primeras 2 tareas activas
            const activeCards = member.cards.filter(c => !c.isDone);
            const previewTasks = activeCards.slice(0, 2);

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
                    return `
                        <div class="task-mini-item">
                            <div class="task-mini-name">${this.escapeHtml(t.name)}</div>
                            <div class="task-mini-meta">
                                <span class="task-mini-stage">${this.escapeHtml(t.listName)}</span>
                                ${dueHtml}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                tasksListHtml = `<div style="font-size: 0.82rem; color: var(--text-muted); padding: 6px 0;">Sin tareas activas asignadas actualmente.</div>`;
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
                            <span>Tareas prioritarias</span>
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
                // Evitar duplicar tarjetas con múltiples miembros en la vista general
                if (!allCards.some(existing => existing.id === c.id)) {
                    allCards.push({ ...c, assignedTo: m.fullName });
                }
            });
        });

        this.data.lists.forEach(list => {
            const listCards = allCards.filter(c => c.listId === list.id);

            const col = document.createElement('div');
            col.className = 'kanban-column';

            let cardsHtml = listCards.map(c => `
                <div class="kanban-card">
                    <div style="font-weight: 600; color: #FFFFFF; font-size: 0.88rem; margin-bottom: 6px;">
                        ${this.escapeHtml(c.name)}
                    </div>
                    <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; justify-content: space-between;">
                        <span>👤 ${this.escapeHtml(c.assignedTo)}</span>
                        ${c.dueFormatted ? `<span>📅 ${c.dueFormatted.split(' ')[0]}</span>` : ''}
                    </div>
                </div>
            `).join('');

            if (listCards.length === 0) {
                cardsHtml = `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 12px 0; text-align: center;">Sin tarjetas</div>`;
            }

            col.innerHTML = `
                <div class="kanban-column-header">
                    <span class="kanban-column-title">${this.escapeHtml(list.name)}</span>
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
        const member = this.data.members.find(m => m.id === memberId);
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

                const labelsHtml = (card.labels || []).map(l => 
                    `<span class="task-label-chip">${this.escapeHtml(l.name)}</span>`
                ).join('');

                cardEl.innerHTML = `
                    <div class="modal-task-top">
                        <div class="modal-task-title">${this.escapeHtml(card.name)}</div>
                        <span class="task-mini-stage">${this.escapeHtml(card.listName)}</span>
                    </div>
                    ${card.desc ? `<div class="modal-task-desc">${this.escapeHtml(card.desc)}</div>` : ''}
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

            const payload = {
                board_id: document.getElementById('setting-board-id').value.trim(),
                api_key: document.getElementById('setting-api-key').value.trim(),
                api_token: document.getElementById('setting-api-token').value.trim()
            };

            const res = await fetch('api/save_config.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (result.success) {
                this.showToast(result.message || 'Configuración guardada correctamente');
                this.closeSettingsModal();
                // Recargar datos frescos
                await this.loadData(true);
            } else {
                this.showToast(result.message || 'Error al guardar la configuración');
            }
        } catch (err) {
            console.error('Error al guardar ajustes:', err);
            this.showToast('Error de red al guardar configuración');
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
}

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TrelloWorkloadApp();
});
