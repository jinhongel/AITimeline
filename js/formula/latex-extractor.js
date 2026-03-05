/**
 * LaTeX Extractor - LaTeX 源码提取器
 * 支持多种平台的公式格式，完全独立的提取逻辑
 * 
 * 支持的平台：
 * - ChatGPT (KaTeX + annotation)
 * - Gemini (KaTeX + data-math)
 * - DeepSeek (KaTeX + annotation)
 * - 豆包 (data-custom-copy-text)
 * - Grok (KaTeX + annotation)
 * - 维基百科 (MathML + annotation)
 * - MathJax (script[type="math/tex"])
 */

class LatexExtractor {
    /**
     * 从公式元素中提取 LaTeX 源码
     * 按优先级尝试多种提取方式，自动适配不同平台
     * 
     * @param {Element} formulaElement - 公式 DOM 元素
     * @returns {string|null} - LaTeX 源码，失败返回 null
     */
    static extract(formulaElement) {
        if (!formulaElement) {
            return null;
        }

        // 方法1: 豆包格式 - data-custom-copy-text 属性（当前元素）
        if (formulaElement.hasAttribute('data-custom-copy-text')) {
            return formulaElement.getAttribute('data-custom-copy-text').trim();
        }

        // 方法2: 豆包格式 - 向上查找 .math-inline 父元素
        let mathInlineParent = formulaElement.closest('.math-inline');
        if (mathInlineParent && mathInlineParent.hasAttribute('data-custom-copy-text')) {
            return mathInlineParent.getAttribute('data-custom-copy-text').trim();
        }

        // 方法3: 豆包格式 - data-custom-copy-text 属性（子元素）
        const doubaoChild = formulaElement.querySelector('[data-custom-copy-text]');
        if (doubaoChild) {
            return doubaoChild.getAttribute('data-custom-copy-text').trim();
        }

        // 方法4: 当前元素的 data-math 属性
        if (formulaElement.hasAttribute('data-math')) {
            return formulaElement.getAttribute('data-math').trim();
        }

        // 方法5: Gemini 格式 - 从祖先元素的 data-math 属性获取
        let parent = formulaElement.parentElement;
        while (parent) {
            if (parent.hasAttribute('data-math')) {
                return parent.getAttribute('data-math').trim();
            }
            parent = parent.parentElement;
            if (!parent || parent === document.body) break;
        }

        // 方法6: ChatGPT 格式 - 从 annotation 标签获取
        const annotation = formulaElement.querySelector('annotation[encoding="application/x-tex"]');
        if (annotation) {
            return annotation.textContent.trim();
        }

        // 方法7: 从 .katex-mathml 中的 annotation 获取
        const mathml = formulaElement.querySelector('.katex-mathml annotation');
        if (mathml) {
            return mathml.textContent.trim();
        }

        // 方法8: 维基百科格式 - mwe-math-element 中的 annotation
        // 查找 class 包含 mwe-math-element 的元素
        let mweElement = formulaElement;
        if (!formulaElement.classList.contains('mwe-math-element')) {
            mweElement = formulaElement.closest('.mwe-math-element');
        }
        if (mweElement) {
            const wikiAnnotation = mweElement.querySelector('annotation');
            if (wikiAnnotation) {
                const latex = wikiAnnotation.textContent.trim();
                return latex || null;
            }
        }

        // 方法9: MathJax 格式 - 从兄弟 script 提取
        // 先查 MathJax 自己的下一个兄弟: <MathJax/><script>
        let nextSibling = formulaElement.nextElementSibling;
        if (nextSibling?.tagName === 'SCRIPT' && nextSibling.type?.startsWith('math/tex')) {
            return nextSibling.textContent.trim();
        }
        // 再查父元素的下一个兄弟: <wrapper><MathJax/></wrapper><script>
        if (formulaElement.parentElement) {
            nextSibling = formulaElement.parentElement.nextElementSibling;
            if (nextSibling?.tagName === 'SCRIPT' && nextSibling.type?.startsWith('math/tex')) {
                return nextSibling.textContent.trim();
            }
        }

        // 方法10: 通用 data-latex 属性
        if (formulaElement.hasAttribute('data-latex')) {
            return formulaElement.getAttribute('data-latex').trim();
        }

        // 无法获取公式
        return null;
    }

    /**
     * 从公式元素中提取 MathML
     * temml 作为 content_script 直接加载，同步可用
     * 
     * @param {Element} formulaElement - 公式 DOM 元素
     * @returns {string|null} - MathML XML 字符串，失败返回 null
     */
    static extractMathML(formulaElement) {
        if (!formulaElement) return null;

        const latexSource = formulaElement.getAttribute('data-latex-source');
        if (latexSource) {
            const generated = LatexExtractor.generateMathML(latexSource);
            if (generated) return generated;
        }

        return null;
    }

    /**
     * 用 temml 将 LaTeX 转换为 MathML
     * @param {string} latex - LaTeX 源码
     * @returns {string|null}
     */
    static generateMathML(latex) {
        if (!latex) return null;

        try {
            if (typeof temml !== 'undefined' && temml.renderToString) {
                const rawMathML = temml.renderToString(latex, {
                    displayMode: false,
                    xml: true,
                    annotate: false,
                    throwOnError: false,
                    trust: false
                });

                const cleaned = LatexExtractor.cleanMathML(rawMathML);
                return LatexExtractor.toWordMathML(cleaned);
            }
        } catch (e) {
            console.warn('[LatexExtractor] temml conversion failed:', e);
        }

        return null;
    }

    /**
     * 移除 MathML 中的 annotation 和 semantics 包装
     */
    static cleanMathML(mathml) {
        return mathml
            .replace(/<annotation(?:-xml)?[\s\S]*?<\/annotation(?:-xml)?>/g, '')
            .replace(/<semantics>\s*([\s\S]*?)\s*<\/semantics>/g, '$1');
    }

    /**
     * 转换为 Word 兼容的 MathML（添加 mml: 前缀）
     */
    static toWordMathML(mathml) {
        const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<root xmlns:mml="${MATHML_NS}">${mathml}</root>`,
            'application/xml'
        );
        const mathEl = doc.querySelector('math');
        if (!mathEl) return mathml;

        const SKIP_ATTRS = new Set(['xmlns', 'class', 'style']);

        const serialize = (node) => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            const tag = 'mml:' + node.localName;
            let attrs = '';

            if (node.localName === 'math') {
                attrs += ` xmlns:mml="${MATHML_NS}" display="block"`;
            }

            for (const attr of node.attributes) {
                if (SKIP_ATTRS.has(attr.name)) continue;
                attrs += ` ${attr.name}="${attr.value}"`;
            }

            let children = '';
            for (const child of node.childNodes) {
                children += serialize(child);
            }

            return `<${tag}${attrs}>${children}</${tag}>`;
        };

        return serialize(mathEl);
    }
}

