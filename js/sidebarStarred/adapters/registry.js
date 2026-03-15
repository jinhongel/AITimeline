/**
 * Sidebar Starred Adapter Registry
 *
 * 管理所有平台的侧边栏收藏适配器。
 */

class SidebarStarredAdapterRegistry {
    constructor() {
        this.adapters = [];
        this._registerAdapters();
    }

    _registerAdapters() {
        if (typeof GeminiSidebarStarredAdapter !== 'undefined') {
            this.adapters.push(new GeminiSidebarStarredAdapter());
        }
    }

    /**
     * 获取匹配当前页面的适配器
     * @returns {BaseSidebarStarredAdapter|null}
     */
    getAdapter() {
        for (const adapter of this.adapters) {
            try {
                if (adapter.matches()) return adapter;
            } catch (e) {
                console.error('[SidebarStarredRegistry] Adapter check failed:', e);
            }
        }
        return null;
    }
}

if (typeof window.sidebarStarredAdapterRegistry === 'undefined') {
    window.sidebarStarredAdapterRegistry = new SidebarStarredAdapterRegistry();
}
