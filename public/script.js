// ============================================================
// SIVT AI — Frontend Script WARGA (Chat Only)
// ============================================================

let chatSessionId = null;
let currentTheme = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    chatSessionId = localStorage.getItem('sivt_sessionId') || null;
    initChatInput();
    await loadPublicConfig();
});

// ============================================================
// AUTO-EXPAND TEXTAREA
// ============================================================
function initChatInput() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    function autoResize() {
        input.style.height = 'auto';
        const maxH = 140;
        input.style.height = Math.min(input.scrollHeight, maxH) + 'px';
    }

    input.addEventListener('input', autoResize);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    window.resetChatInputHeight = function() {
        input.style.height = 'auto';
        input.style.height = '44px';
    };
}

// ============================================================
// TEMA
// ============================================================
function applyTheme(theme) {
    if (!theme) return;
    currentTheme = theme;
    const root = document.documentElement;
    if (theme.primary) root.style.setProperty('--primary', theme.primary);
    if (theme.primaryDark) root.style.setProperty('--primary-dark', theme.primaryDark);
    if (theme.primaryLight) root.style.setProperty('--primary-light', theme.primaryLight);
    if (theme.accent) root.style.setProperty('--accent', theme.accent);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme.primary) meta.setAttribute('content', theme.primary);

    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader && theme.primary) {
        chatHeader.style.background = theme.primary;
    }
}

// ============================================================
// LOGO SIZE
// ============================================================
const LOGO_SIZES = {
    small:  { chat: 36, login: 80 },
    medium: { chat: 44, login: 90 },
    large:  { chat: 56, login: 110 },
    xlarge: { chat: 72, login: 130 }
};

function applyLogoSize(size) {
    const s = LOGO_SIZES[size] || LOGO_SIZES.medium;
    const logoIcon = document.getElementById('logoIcon');
    if (logoIcon) {
        logoIcon.style.width = s.chat + 'px';
        logoIcon.style.height = s.chat + 'px';
    }
}

// ============================================================
// LOAD PUBLIC CONFIG
// ============================================================
async function loadPublicConfig() {
    try {
        const res = await fetch('/api/config/public');
        const cfg = await res.json();

        document.getElementById('headerTitle').textContent = cfg.aiName || 'SIVT AI';
        document.getElementById('headerTagline').innerHTML =
            `<i class="fas fa-robot me-1"></i>${cfg.tagline || ''}`;

        const logoHtml = cfg.logoUrl
            ? `<img src="${cfg.logoUrl}" alt="logo">`
            : '<i class="fas fa-robot"></i>';

        document.getElementById('logoIcon').innerHTML = logoHtml;
        applyLogoSize(cfg.logoSize || 'medium');

        if (cfg.theme) {
            applyTheme(cfg.theme);
        }

        if (cfg.logoUrl) {
            let fav = document.querySelector('link[rel="icon"]');
            if (!fav) {
                fav = document.createElement('link');
                fav.rel = 'icon';
                document.head.appendChild(fav);
            }
            fav.href = cfg.logoUrl;
        }

        const chatBox = document.getElementById('chatBox');
        chatBox.innerHTML = `
          <div class="bubble bubble-bot">
            <div class="bot-name"><i class="fas fa-robot"></i> ${cfg.aiName || 'SIVT AI'}</div>
            <div>${(cfg.welcomeMessage || '').replace(/\n/g, '<br>')}</div>
            <div class="bubble-time">Online</div>
          </div>
        `;

        const qb = document.getElementById('quickButtons');
        qb.innerHTML = '';
        (cfg.quickButtons || []).forEach(b => {
            const btn = document.createElement('button');
            btn.className = 'btn-quick';
            btn.innerHTML = `<i class="fas fa-circle-question me-1"></i> ${b.label}`;
            btn.onclick = () => sendQuickQuestion(b.question);
            qb.appendChild(btn);
        });
    } catch (err) {
        console.error('Gagal load config:', err);
    }
}

// ============================================================
// FORMAT TEXT
// ============================================================
function formatText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    let html = div.innerHTML;

    html = html.replace(/\*\*(.+?)\*\*/g, '$1');
    html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
    html = html.replace(/^#{1,6}\s+/gm, '');
    html = html.replace(/`([^`]+)`/g, '$1');

    const lines = html.split('\n');
    const out = [];
    let listOpen = false;
    let listType = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === '') {
            if (listOpen) {
                out.push(`</${listType}>`);
                listOpen = false;
                listType = null;
            }
            out.push('<div class="spacer"></div>');
            continue;
        }

        const bulletMatch = line.match(/^[•\-\*]\s+(.+)$/);
        if (bulletMatch) {
            if (!listOpen || listType !== 'ul') {
                if (listOpen) out.push(`</${listType}>`);
                out.push('<ul class="ai-list">');
                listOpen = true;
                listType = 'ul';
            }
            out.push(`<li>${bulletMatch[1]}</li>`);
            continue;
        }

        const numMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
        if (numMatch) {
            if (!listOpen || listType !== 'ol') {
                if (listOpen) out.push(`</${listType}>`);
                out.push('<ol class="ai-list">');
                listOpen = true;
                listType = 'ol';
            }
            out.push(`<li>${numMatch[2]}</li>`);
            continue;
        }

        if (listOpen) {
            out.push(`</${listType}>`);
            listOpen = false;
            listType = null;
        }
        out.push(`<p>${line}</p>`);
    }

    if (listOpen) out.push(`</${listType}>`);
    return out.join('');
}

// ============================================================
// CHAT
// ============================================================
function sendMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    if (window.resetChatInputHeight) window.resetChatInputHeight();
    addMessage(msg, 'user');
    getBotResponse(msg);
}

function sendQuickQuestion(q) {
    addMessage(q, 'user');
    getBotResponse(q);
}

function addMessage(text, sender) {
    const chatBox = document.getElementById('chatBox');
    const bubble = document.createElement('div');
    bubble.className = `bubble bubble-${sender}`;
    if (sender === 'bot') {
        const botName = document.createElement('div');
        botName.className = 'bot-name';
        botName.innerHTML = `<i class="fas fa-robot"></i> SIVT AI`;
        bubble.appendChild(botName);
        const t = document.createElement('div');
        t.textContent = text;
        bubble.appendChild(t);
    } else {
        bubble.style.whiteSpace = 'pre-wrap';
        bubble.textContent = text;
    }
    const time = document.createElement('div');
    time.className = 'bubble-time';
    time.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(time);
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
    return bubble;
}

function addEmptyBotMessage() {
    const chatBox = document.getElementById('chatBox');
    const bubble = document.createElement('div');
    bubble.className = 'bubble bubble-bot';
    const botName = document.createElement('div');
    botName.className = 'bot-name';
    botName.innerHTML = `<i class="fas fa-robot"></i> SIVT AI`;
    bubble.appendChild(botName);
    const textNode = document.createElement('div');
    textNode.className = 'stream-text';
    textNode.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    bubble.appendChild(textNode);
    const time = document.createElement('div');
    time.className = 'bubble-time';
    time.textContent = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    bubble.appendChild(time);
    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
    return { bubble, textNode };
}

async function getBotResponse(question) {
    const { bubble, textNode: botTextEl } = addEmptyBotMessage();
    let fullText = '';
    let pendingSuggestions = null;
    let sourceInfo = '';
    let metaInfo = { provider: null, model: null, source: null };
    let isError = false;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: question, sessionId: chatSessionId })
        });
        if (!response.ok || !response.body) throw new Error('Server tidak merespons.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop();
            for (const line of parts) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;
                let obj;
                try { obj = JSON.parse(jsonStr); } catch (_) { continue; }

                if (obj.sessionId) {
                    chatSessionId = obj.sessionId;
                    localStorage.setItem('sivt_sessionId', chatSessionId);
                }

                if (obj.meta) {
                    if (obj.meta.source === 'memory') {
                        sourceInfo = '<i class="fas fa-brain"></i> dijawab dari memori';
                        metaInfo.source = 'memory';
                    } else if (obj.meta.source === 'redirect') {
                        sourceInfo = '<i class="fas fa-shield-alt"></i> pertanyaan di luar topik';
                        metaInfo.source = 'redirect';
                    } else if (obj.meta.provider) {
                        sourceInfo = `<i class="fas fa-cloud"></i> ${obj.meta.provider} — ${obj.meta.model}`;
                        metaInfo.provider = obj.meta.provider;
                        metaInfo.model = obj.meta.model;
                        metaInfo.source = 'ai';
                    }
                }

                if (obj.delta) {
                    fullText += obj.delta;
                    botTextEl.innerHTML = formatText(fullText);
                    document.getElementById('chatBox').scrollTop = document.getElementById('chatBox').scrollHeight;
                } else if (obj.needSuggestions) {
                    pendingSuggestions = obj.suggestions;
                } else if (obj.error) {
                    isError = true;
                    botTextEl.textContent = 'Error: ' + obj.error;
                }
            }
        }

        if (sourceInfo && fullText.length > 0) {
            const note = document.createElement('div');
            note.style.cssText = 'font-size: 10px; color: var(--primary); margin-top: 6px; opacity: 0.8;';
            note.innerHTML = sourceInfo;
            bubble.appendChild(note);
        }

        if (!isError && fullText.length > 20 && metaInfo.source !== 'redirect') {
            addFeedbackButtons(bubble, question, fullText, metaInfo);
        }

        if (pendingSuggestions && Array.isArray(pendingSuggestions) && pendingSuggestions.length > 0) {
            showSuggestions(pendingSuggestions);
        }
    } catch (err) {
        isError = true;
        botTextEl.textContent = 'Maaf, terjadi kesalahan: ' + err.message;
    }
}

// ============================================================
// FEEDBACK
// ============================================================
function addFeedbackButtons(bubble, question, answer, meta) {
    const fb = document.createElement('div');
    fb.className = 'feedback-buttons';
    fb.innerHTML = `
        <span class="fb-label">Bermanfaat?</span>
        <button class="fb-btn fb-good" title="Jawaban bagus">
            <i class="fas fa-thumbs-up"></i>
        </button>
        <button class="fb-btn fb-bad" title="Jawaban kurang tepat">
            <i class="fas fa-thumbs-down"></i>
        </button>
    `;

    fb.dataset.question = question;
    fb.dataset.answer = answer.slice(0, 500);

    fb.querySelector('.fb-good').onclick = (e) => sendFeedback(e.target.closest('button'), 'good', fb, meta);
    fb.querySelector('.fb-bad').onclick = (e) => sendFeedback(e.target.closest('button'), 'bad', fb, meta);

    bubble.appendChild(fb);
}

async function sendFeedback(btn, rating, container, meta) {
    const question = container.dataset.question;
    const answer = container.dataset.answer;

    try {
        await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question, answer, rating,
                sessionId: chatSessionId,
                provider: meta.provider,
                model: meta.model,
                source: meta.source
            })
        });

        container.innerHTML = rating === 'good'
            ? '<span class="fb-thanks fb-thanks-good"><i class="fas fa-check-circle"></i> Terima kasih!</span>'
            : '<span class="fb-thanks fb-thanks-bad"><i class="fas fa-clipboard-check"></i> Kami akan perbaiki</span>';
    } catch (err) {
        console.error('Feedback error:', err);
        container.innerHTML = '<span class="fb-thanks" style="color:var(--danger);">Gagal kirim</span>';
    }
}

function showSuggestions(suggestions) {
    const chatBox = document.getElementById('chatBox');
    const wrap = document.createElement('div');
    wrap.className = 'suggestions-wrap';
    const title = document.createElement('div');
    title.className = 'suggestions-title';
    title.innerHTML = '<i class="fas fa-lightbulb me-1"></i> Mungkin kamu mau tanya salah satu ini:';
    wrap.appendChild(title);
    const list = document.createElement('div');
    list.className = 'suggestions-list';
    suggestions.forEach(text => {
        const chip = document.createElement('button');
        chip.className = 'suggestion-chip';
        chip.textContent = text;
        chip.onclick = () => { addMessage(text, 'user'); getBotResponse(text); };
        list.appendChild(chip);
    });
    wrap.appendChild(list);
    chatBox.appendChild(wrap);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function resetChat() {
    if (!confirm('Reset percakapan?')) return;
    chatSessionId = null;
    localStorage.removeItem('sivt_sessionId');
    loadPublicConfig();
}