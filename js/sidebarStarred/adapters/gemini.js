/**
 * Gemini Sidebar Starred Adapter
 *
 * Gemini 侧边栏 DOM 结构：
 *   SIDE-NAVIGATION-V2 > BARD-SIDENAV-CONTAINER > BARD-SIDENAV
 *     > SIDE-NAVIGATION-CONTENT > .sidenav-with-history-container
 *       > .overflow-container > INFINITE-SCROLLER
 *         ├── .side-nav-entry-container  (New Chat)
 *         ├── .gems-list-container       (Gems)
 *         ├── .ait-sidebar-starred       ← 收藏区域（插入位置）
 *         └── .chat-history              ← 聊天历史（参考锚点）
 *
 * 策略：
 *   findSidebarContainer → .chat-history 的父元素（INFINITE-SCROLLER）
 *   findInsertionPoint   → insertBefore(.chat-history)
 */

class GeminiSidebarStarredAdapter extends BaseSidebarStarredAdapter {
    matches() {
        return matchesPlatform(location.href, 'gemini');
    }

    findSidebarContainer() {
        const chatHistory = document.querySelector('.chat-history');
        if (chatHistory?.parentElement) return chatHistory.parentElement;

        return document.querySelector('side-navigation-v2') || null;
    }

    findInsertionPoint() {
        const chatHistory = document.querySelector('.chat-history');
        if (chatHistory && chatHistory.parentElement) {
            return { parent: chatHistory.parentElement, reference: chatHistory, position: 'before' };
        }

        // fallback：从 conversation 元素向上找可滚动容器
        const conv = document.querySelector('[data-test-id="conversation"]');
        if (conv) {
            let el = conv.parentElement;
            while (el && el !== document.body) {
                const style = getComputedStyle(el);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    return { parent: el, reference: null, position: 'prepend' };
                }
                el = el.parentElement;
            }
        }

        return null;
    }

    getPlatformClass() {
        return 'gemini';
    }
}
