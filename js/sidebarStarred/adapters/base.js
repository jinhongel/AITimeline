/**
 * Base Sidebar Starred Adapter
 *
 * 侧边栏收藏列表适配器基类。
 * 每个 AI 平台的侧边栏 DOM 结构不同，需要平台适配器提供：
 *   - 侧边栏容器定位
 *   - 收藏区域插入点
 *   - 平台专属样式类名
 */

class BaseSidebarStarredAdapter {
    /**
     * 是否匹配当前页面
     * @returns {boolean}
     */
    matches() {
        throw new Error('BaseSidebarStarredAdapter.matches() must be implemented');
    }

    /**
     * 查找侧边栏容器（用于 MutationObserver 监听）
     * @returns {HTMLElement|null}
     */
    findSidebarContainer() {
        throw new Error('BaseSidebarStarredAdapter.findSidebarContainer() must be implemented');
    }

    /**
     * 获取插入信息：在侧边栏的哪个位置插入收藏区域
     * @returns {{ parent: HTMLElement, reference: HTMLElement|null, position: 'before'|'after'|'prepend'|'append' }|null}
     */
    findInsertionPoint() {
        throw new Error('BaseSidebarStarredAdapter.findInsertionPoint() must be implemented');
    }

    /**
     * 获取平台 CSS 类名（用于平台专属样式）
     * @returns {string}
     */
    getPlatformClass() {
        return '';
    }

    /**
     * 侧边栏可见的最大收藏条目数
     * @returns {number}
     */
    getMaxVisibleItems() {
        return 20;
    }

    /**
     * 获取适配器名称
     * @returns {string}
     */
    getName() {
        return this.constructor.name.replace('SidebarStarredAdapter', '');
    }
}
