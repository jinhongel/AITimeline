/**
 * Formula Tab - 复制公式设置
 * 
 * 功能：
 * - LaTeX 开关：独立控制 LaTeX 复制（带格式选择）
 * - MathML 开关：独立控制 MathML 复制（Word 兼容）
 * - 两者都开启时，点击公式弹出菜单选择
 */

class FormulaTab extends BaseTab {
    constructor() {
        super();
        this.id = 'formula';
        this.name = chrome.i18n.getMessage('kpxvmz');
        this.icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 3H4l5 8-5 8h10"/>
            <path d="M14 15l3 3 5-6"/>
        </svg>`;
    }
    
    render() {
        const container = document.createElement('div');
        container.className = 'formula-settings';
        
        const formatOptionsHtml = FORMULA_FORMATS.map(format => `
            <label class="format-option">
                <input type="radio" name="formula-format" value="${format.id}">
                <span class="format-radio"></span>
                <span class="format-label">${format.label}</span>
            </label>
        `).join('');
        
        container.innerHTML = `
            <div class="setting-section">
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-label">${chrome.i18n.getMessage('formulaMathMLTitle') || '复制 MathML 公式'}</div>
                        <div class="setting-hint">${chrome.i18n.getMessage('formulaMathMLHint') || '点击公式复制为 MathML 格式，可直接粘贴到 Word'}</div>
                    </div>
                    <label class="ait-toggle-switch">
                        <input type="checkbox" id="formula-mathml-toggle">
                        <span class="ait-toggle-slider"></span>
                    </label>
                </div>
            </div>
            
            <div class="setting-section">
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-label">${chrome.i18n.getMessage('formulaLatexTitle') || '复制 LaTeX 公式'}</div>
                        <div class="setting-hint">${chrome.i18n.getMessage('formulaLatexHint') || '点击公式复制为 LaTeX 格式'}</div>
                        <div class="format-inline" id="format-section" style="display: none;">
                            <div class="format-inline-title">${chrome.i18n.getMessage('formulaFormatTitle') || '选择复制格式'}</div>
                            <div class="format-options">
                                ${formatOptionsHtml}
                            </div>
                        </div>
                    </div>
                    <label class="ait-toggle-switch">
                        <input type="checkbox" id="formula-latex-toggle">
                        <span class="ait-toggle-slider"></span>
                    </label>
                </div>
            </div>
        `;
        
        return container;
    }
    
    async mounted() {
        super.mounted();
        
        const latexToggle = document.getElementById('formula-latex-toggle');
        const mathmlToggle = document.getElementById('formula-mathml-toggle');
        const formatSection = document.getElementById('format-section');
        const formatRadios = document.querySelectorAll('input[name="formula-format"]');
        
        if (!latexToggle || !mathmlToggle) return;
        
        try {
            const result = await chrome.storage.local.get(['formulaLatexEnabled', 'formulaMathMLEnabled', 'formulaFormat']);
            
            const latexEnabled = result.formulaLatexEnabled !== false;
            const mathmlEnabled = result.formulaMathMLEnabled === true;
            
            latexToggle.checked = latexEnabled;
            mathmlToggle.checked = mathmlEnabled;
            
            if (formatSection) {
                formatSection.style.display = latexEnabled ? 'block' : 'none';
            }
            
            const currentFormat = result.formulaFormat || 'none';
            formatRadios.forEach(radio => {
                radio.checked = radio.value === currentFormat;
            });
        } catch (e) {
            console.error('[FormulaTab] Failed to load state:', e);
            latexToggle.checked = true;
            mathmlToggle.checked = false;
        }
        
        this.addEventListener(latexToggle, 'change', async (e) => {
            try {
                const enabled = e.target.checked;
                await chrome.storage.local.set({ formulaLatexEnabled: enabled });
                if (formatSection) {
                    formatSection.style.display = enabled ? 'block' : 'none';
                }
                // 至少保持一个开启
                if (!enabled && !mathmlToggle.checked) {
                    await chrome.storage.local.set({ formulaEnabled: false });
                } else {
                    await chrome.storage.local.set({ formulaEnabled: true });
                }
            } catch (e) {
                console.error('[FormulaTab] Failed to save state:', e);
                latexToggle.checked = !latexToggle.checked;
            }
        });
        
        this.addEventListener(mathmlToggle, 'change', async (e) => {
            try {
                const enabled = e.target.checked;
                await chrome.storage.local.set({ formulaMathMLEnabled: enabled });
                if (!enabled && !latexToggle.checked) {
                    await chrome.storage.local.set({ formulaEnabled: false });
                } else {
                    await chrome.storage.local.set({ formulaEnabled: true });
                }
            } catch (e) {
                console.error('[FormulaTab] Failed to save state:', e);
                mathmlToggle.checked = !mathmlToggle.checked;
            }
        });
        
        formatRadios.forEach(radio => {
            this.addEventListener(radio, 'change', async (e) => {
                try {
                    await chrome.storage.local.set({ formulaFormat: e.target.value });
                } catch (e) {
                    console.error('[FormulaTab] Failed to save format:', e);
                }
            });
        });
    }
    
    unmounted() {
        super.unmounted();
    }
}

