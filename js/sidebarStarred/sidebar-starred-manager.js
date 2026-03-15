/**
 * Sidebar Starred Manager
 *
 * 侧边栏收藏列表：文件夹可展开/收起，收藏项可点击跳转。
 */

class SidebarStarredManager {
    static CONTAINER_CLASS = 'ait-sidebar-starred';
    static STORAGE_KEY_FOLDER_STATES = 'sidebarStarredFolderStates';
    static REINJECT_INTERVAL = 3000;
    static STORAGE_DEBOUNCE = 300;

    constructor(adapter) {
        this.adapter = adapter;
        this.container = null;
        this.folderManager = new FolderManager(StorageAdapter);
        this.folderStates = {};
        this.isDestroyed = false;

        this._storageListener = null;
        this._reinjectTimer = null;
        this._refreshDebounceTimer = null;

        const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform) || (navigator.userAgentData && navigator.userAgentData.platform === 'macOS');
        const gTop = isMac ? '#6CC4F8' : '#FFD666';
        const gBot = isMac ? '#3B9FE7' : '#E5A520';
        this._folderClosed = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><defs><linearGradient id="ss-fc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${gTop}"/><stop offset="100%" stop-color="${gBot}"/></linearGradient></defs><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" fill="url(#ss-fc)"/></svg>`;
        this._folderOpen = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none"><defs><linearGradient id="ss-fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${gTop}"/><stop offset="100%" stop-color="${gBot}"/></linearGradient></defs><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="url(#ss-fo)" stroke-width="2" fill="none"/></svg>`;
    }

    async init() {
        if (this.isDestroyed) return false;

        const saved = await StorageAdapter.get(SidebarStarredManager.STORAGE_KEY_FOLDER_STATES);
        this.folderStates = saved && typeof saved === 'object' ? saved : {};

        const ok = this._injectIntoSidebar();
        if (!ok) return false;

        await this._refreshContent();
        this._startStorageListener();
        this._startReinjectCheck();
        return true;
    }

    destroy() {
        this.isDestroyed = true;
        if (this._storageListener) { StorageAdapter.removeChangeListener(this._storageListener); this._storageListener = null; }
        if (this._reinjectTimer) { clearInterval(this._reinjectTimer); this._reinjectTimer = null; }
        if (this._refreshDebounceTimer) { clearTimeout(this._refreshDebounceTimer); this._refreshDebounceTimer = null; }
        if (this.container?.parentNode) this.container.parentNode.removeChild(this.container);
        this.container = null;
    }

    // ==================== Injection ====================

    _injectIntoSidebar() {
        const existing = document.querySelector(`.${SidebarStarredManager.CONTAINER_CLASS}`);
        if (existing) { this.container = existing; return true; }

        const info = this.adapter.findInsertionPoint();
        if (!info) return false;

        this.container = this._buildContainer();
        const { parent, reference, position } = info;
        try {
            if (position === 'before') parent.insertBefore(this.container, reference);
            else if (position === 'after') parent.insertBefore(this.container, reference?.nextSibling || null);
            else if (position === 'prepend') parent.insertBefore(this.container, parent.firstChild);
            else parent.appendChild(this.container);
            return true;
        } catch (e) { console.error('[SidebarStarred] Injection failed:', e); return false; }
    }

    // ==================== DOM ====================

    _buildContainer() {
        const root = document.createElement('div');
        root.className = `${SidebarStarredManager.CONTAINER_CLASS} ${this.adapter.getPlatformClass()}`;

        const header = document.createElement('div');
        header.className = 'ait-ss-header';

        const title = document.createElement('span');
        title.className = 'ait-ss-title';
        title.textContent = chrome.i18n.getMessage('vnkxpm') || 'Starred';

        const addBtn = document.createElement('button');
        addBtn.className = 'ait-ss-add-btn';
        addBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
        addBtn.addEventListener('click', (e) => { e.stopPropagation(); this._handleCreateFolder(); });

        header.appendChild(title);
        header.appendChild(addBtn);
        root.appendChild(header);

        const list = document.createElement('div');
        list.className = 'ait-ss-list';
        root.appendChild(list);

        return root;
    }

    _buildFolder(folder, items, children = []) {
        const isOpen = this.folderStates[folder.id] === true;

        const el = document.createElement('div');
        el.className = 'ait-ss-folder';
        el.dataset.folderId = folder.id;

        // 文件夹行
        const row = document.createElement('div');
        row.className = 'ait-ss-folder-row';
        row.addEventListener('click', () => this._toggleFolder(folder.id));

        const chevron = document.createElement('span');
        chevron.className = `ait-ss-chevron${isOpen ? ' open' : ''}`;
        chevron.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>';

        const icon = document.createElement('span');
        icon.className = 'ait-ss-folder-icon';
        if (folder.icon) {
            icon.textContent = folder.icon;
        } else {
            icon.innerHTML = isOpen ? this._folderOpen : this._folderClosed;
        }

        const name = document.createElement('span');
        name.className = 'ait-ss-name';
        name.textContent = folder.name;

        row.appendChild(chevron);
        row.appendChild(icon);
        row.appendChild(name);
        el.appendChild(row);

        // 内容区
        const body = document.createElement('div');
        body.className = `ait-ss-body${isOpen ? ' open' : ''}`;

        const inner = document.createElement('div');
        for (const item of items) inner.appendChild(this._buildItem(item));
        for (const child of children) {
            const childEl = this._buildFolder(child, child.items || [], child.children || []);
            if (childEl) inner.appendChild(childEl);
        }
        body.appendChild(inner);
        el.appendChild(body);

        return el;
    }

    _buildItem(item) {
        const el = document.createElement('div');
        el.className = 'ait-ss-item';
        el.textContent = item.theme || item.question || 'Untitled';
        el.title = item.theme || item.question || '';
        el.addEventListener('click', () => this._handleItemClick(item));
        return el;
    }

    // ==================== Rendering ====================

    async _refreshContent() {
        if (this.isDestroyed || !this.container) return;
        const tree = await this.folderManager.getStarredByFolder();
        const list = this.container.querySelector('.ait-ss-list');
        if (!list) return;

        list.innerHTML = '';

        if (tree.folders.length === 0 && tree.uncategorized.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ait-ss-empty';
            empty.textContent = chrome.i18n.getMessage('jwvnkp') || 'No starred items';
            list.appendChild(empty);
            return;
        }

        // 用户文件夹
        for (const folder of tree.folders) {
            list.appendChild(this._buildFolder(folder, folder.items, folder.children || []));
        }

        // 未归类的收藏项（没有文件夹，直接展示）
        for (const item of tree.uncategorized) {
            list.appendChild(this._buildItem(item));
        }
    }

    // ==================== Interactions ====================

    _toggleFolder(folderId) {
        this.folderStates[folderId] = !this.folderStates[folderId];
        StorageAdapter.set(SidebarStarredManager.STORAGE_KEY_FOLDER_STATES, this.folderStates);

        const el = this.container.querySelector(`[data-folder-id="${folderId}"]`);
        if (!el) return;
        const chevron = el.querySelector(':scope > .ait-ss-folder-row > .ait-ss-chevron');
        const body = el.querySelector(':scope > .ait-ss-body');
        const icon = el.querySelector(':scope > .ait-ss-folder-row > .ait-ss-folder-icon');
        const isOpen = this.folderStates[folderId];
        if (chevron) chevron.classList.toggle('open', isOpen);
        if (body) body.classList.toggle('open', isOpen);
        if (icon && !icon.textContent.trim()) {
            icon.innerHTML = isOpen ? this._folderOpen : this._folderClosed;
        }
    }

    async _handleCreateFolder() {
        if (!window.folderEditModal) return;
        try {
            const result = await window.folderEditModal.show({
                mode: 'create',
                title: chrome.i18n.getMessage('kxvpmz') || 'New Folder',
                placeholder: chrome.i18n.getMessage('vzkpmx') || 'Folder name',
                requiredMessage: chrome.i18n.getMessage('kmxpvz') || 'Name is required',
                maxLength: 10
            });
            if (!result) return;
            const exists = await this.folderManager.isFolderNameExists(result.name, null);
            if (exists) { window.globalToastManager?.error(chrome.i18n.getMessage('kpvzmx') || 'Name already exists'); return; }
            await this.folderManager.createFolder(result.name, null, result.icon);
            window.globalToastManager?.success(chrome.i18n.getMessage('xzvkpm') || 'Created');
            await this._refreshContent();
        } catch (error) { console.error('[SidebarStarred] Create folder failed:', error); }
    }

    _handleItemClick(item) {
        const url = item.url || `https://${item.urlWithoutProtocol}`;
        const nodeKey = item.nodeId !== undefined ? item.nodeId : item.index;
        const needsScroll = nodeKey !== undefined && nodeKey !== -1;
        const isSamePage = location.href === url || location.href.replace(/^https?:\/\//, '') === url.replace(/^https?:\/\//, '');

        if (isSamePage) {
            const tm = window.timelineManager;
            if (needsScroll && tm) {
                const marker = this._findMarker(tm, nodeKey);
                if (marker?.element) tm.smoothScrollTo(marker.element);
            }
        } else if (this._isSameSite(url)) {
            if (needsScroll && window.timelineManager) window.timelineManager.setNavigateDataForUrl(url, nodeKey);
            location.href = url;
        } else {
            if (needsScroll && window.timelineManager) window.timelineManager.setNavigateDataForUrl(url, nodeKey);
            window.open(url, '_blank');
        }
    }

    _findMarker(tm, nodeKey) {
        if (nodeKey == null) return null;
        if (tm.adapter?.findMarkerByStoredIndex) return tm.adapter.findMarkerByStoredIndex(nodeKey, tm.markers, tm.markerMap);
        if (tm.adapter?.generateTurnIdFromIndex) { const m = tm.markerMap?.get(tm.adapter.generateTurnIdFromIndex(nodeKey)); if (m) return m; }
        if (typeof nodeKey === 'number' && nodeKey >= 0 && nodeKey < tm.markers.length) return tm.markers[nodeKey];
        return null;
    }

    _isSameSite(url) {
        try { const u = new URL(url); if (u.hostname === location.hostname) return true; const m = h => h.split('.').slice(-2).join('.'); return m(u.hostname) === m(location.hostname); } catch { return false; }
    }

    // ==================== Observers ====================

    _startStorageListener() {
        this._storageListener = (changes, areaName) => {
            if (areaName !== 'local') return;
            if (changes.chatTimelineStars || changes.folders) {
                if (this._refreshDebounceTimer) clearTimeout(this._refreshDebounceTimer);
                this._refreshDebounceTimer = setTimeout(() => this._refreshContent(), SidebarStarredManager.STORAGE_DEBOUNCE);
            }
        };
        StorageAdapter.addChangeListener(this._storageListener);
    }

    _startReinjectCheck() {
        this._reinjectTimer = setInterval(() => {
            if (this.isDestroyed) return;
            if (!document.querySelector(`.${SidebarStarredManager.CONTAINER_CLASS}`)) {
                this.container = null;
                if (this._injectIntoSidebar()) this._refreshContent();
            }
        }, SidebarStarredManager.REINJECT_INTERVAL);
    }
}
