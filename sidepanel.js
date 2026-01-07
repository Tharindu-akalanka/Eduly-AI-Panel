const SYSTEM_PROMPT = `
You are an expert university-level lecturer and exam-focused tutor for ANY subject.

I am a university undergraduate who did NOT attend lectures and ONLY have lecture slides or study materials (PDF/text).
My English level is basic, so I need very clear, simple explanations.

Your tasks:
1. Carefully read and understand the provided content.
2. Explain all topics using very simple, basic English.
3. Break down difficult terms into easy words.
4. Use small, clear real-life examples related to the subject.
5. If formulas, code, diagrams, or processes exist:
   - Explain them step by step in simple language.
6. Convert the content into short, well-structured, exam-oriented notes.
7. Highlight important points likely to appear in exams.
8. Remove unnecessary theory and focus on understanding + exams.
9. Use clear headings, bullet points, and clean formatting.
10. If a topic is difficult, re-explain it in an even simpler way.
11. IMMEDIATE START: Do NOT use phrases like "Hello", "I am your tutor", or "Let's start". Start strictly with the topic explanation.

Teaching style:
- Assume I am a complete beginner.
- No advanced vocabulary.
- Explain slowly and clearly.
- Do not assume prior knowledge.
- NO Small talk.

Goal:
Help me fully understand the subject and pass my exam confidently.
`;

// DOM Elements
const welcomeView = document.getElementById('welcome-view');
const mainView = document.getElementById('main-view');
// setupView removed
const getStartedBtn = document.getElementById('get-started-btn');
const simplifyBtn = document.getElementById('simplify-btn');
const outputContainer = document.getElementById('output');
const loader = document.getElementById('loader');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // We now start with Welcome View visible by default in HTML.
    // If we wanted to skip it for returning users, we'd check localStorage here.
});

// Event Listeners
if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
        showMainView();
    });
}

simplifyBtn.addEventListener('click', async () => {
    resetOutputState();

    try {
        //clear old error first
        const existingError = outputContainer.querySelector('.error-card');
        if (existingError) existingError.remove();

        setLoading(true);
        const text = await getSelectedText();
        const response = await callApiFreeLLM(text);
        renderResult(response);
    } catch (err) {
        handleError(err);
    } finally {
        setLoading(false);
    }
});

// View Switching
function showMainView() {
    if (welcomeView) welcomeView.classList.add('hidden');
    mainView.classList.remove('hidden');
}

function setLoading(isLoading) {
    if (isLoading) {
        const existingError = outputContainer.querySelector('.error-card');
        if (existingError) existingError.remove();

        loader.classList.remove('hidden');
        outputContainer.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
        outputContainer.classList.remove('hidden');
    }
}

// Core Functions
async function getSelectedText() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check for restricted URLs
    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:") || tab.url.startsWith("https://chrome.google.com/webstore")) {
        throw new Error("Cannot access text on this system page. Please try on a normal website.");
    }

    let result = [];
    try {
        result = await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: () => window.getSelection().toString()
        });
    } catch (err) {
        if (err.message.includes("Cannot access contents of url")) {
            throw new Error("Please allow 'Access to file URLs' in extension settings.");
        }
        throw err;
    }

    const texts = result
        .map(frame => frame.result)
        .filter(text => text && text.trim().length > 0);

    let text = texts.join('\n\n').trim();

    // Generalized Fallback: If standard selection failed, try to copy programmatically.
    // This helps with PDFs, some iframes, and Shadow DOM where getSelection() might be empty.
    if (!text) {
        try {
            // Check what's currently in the clipboard to avoid reading stale data
            const oldClipboard = await navigator.clipboard.readText().catch(() => "");

            await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                func: () => {
                    // Only try to copy if this frame has focus or selection
                    // But for PDFs, focus might be tricky, so let's just try copying
                    // if it doesn't throw errors.
                    try {
                        document.execCommand('copy');
                    } catch (e) { }
                }
            });

            // Wait a tiny bit for clipboard to update
            // Increased to 500ms for heavy PDF viewers
            await new Promise(r => setTimeout(r, 500));

            const newClipboard = await navigator.clipboard.readText();

            // Only use clipboard if it changed ... OR if it's a local file (manual copy fallback)
            const isLocal = tab.url.startsWith('file://');
            if ((newClipboard && newClipboard !== oldClipboard) || (isLocal && newClipboard && newClipboard.trim().length > 0)) {
                // Guard against the specific icon bug
                if (!newClipboard.match(/icons\/.*\.png/)) {
                    text = newClipboard;
                }
            }
        } catch (e) {
            console.warn("Clipboard fallback failed:", e);
        }
    }

    if (!text || text.trim().length === 0) {
        // Specific help for local PDFs
        if (tab.url.startsWith('file://')) {
            throw new Error("Could not Auto-Copy. Please highlight the text, press Ctrl+C (Copy) manually, and try again.");
        }
        throw new Error("No text found. Please highlight some text on the web page first.");
    }

    return text;
}

// 1. Initial Truncation to safe limit (approx 1800 characters to avoid 500 errors)
// Previous limit of 4500 was causing 500 errors. API seems flaky above 3000 total chars.
// 1800 user chars + 1200 prompt chars = 3000 total.
if (userText.length > 1800) {
    console.warn(`Text too long (${userText.length} chars). Truncating to 1800.`);
    userText = userText.substring(0, 1800) + "... [truncated]";
}

const constructPayload = (useSystemPrompt, text) => {
    if (useSystemPrompt) {
        return SYSTEM_PROMPT + "\n\nUser Input:\n" + text;
    } else {
        return "Explain this simply:\n\n" + text;
    }
};

const sendRequest = async (payload) => {
    const response = await fetch('https://apifreellm.com/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: payload
        })
    });
    return response;
};

try {
    // Try with full system prompt first
    let response = await sendRequest(constructPayload(true, userText));

    // If 500, retry with simplified prompt AND shorter text (aggressive fallback)
    if (response.status === 500) {
        console.warn("Got 500 Error. Retrying with simplified prompt and shorter text...");
        // Reduce to 1000 chars for the retry to be very safe
        const shorterText = userText.length > 1000 ? userText.substring(0, 1000) + "... [truncated]" : userText;
        response = await sendRequest(constructPayload(false, shorterText));
    }

    if (!response.ok) {
        console.error("API Response Status:", response.status, response.statusText);

        let errorMsg = `Status ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData.error) errorMsg += `: ${errorData.error}`;
            else if (errorData.message) errorMsg += `: ${errorData.message}`;
        } catch (e) {
            const textBody = await response.text();
            if (textBody) errorMsg += `: ${textBody.substring(0, 50)}...`;
        }

        if (response.status === 429) {
            throw new Error("Rate limit reached. Please wait 5 seconds.");
        }

        // Helpful message for persistent 500s
        if (response.status === 500) {
            throw new Error("Server Error (500). The text might be too complex. Try selecting a shorter section.");
        }

        throw new Error(`API Request failed (${errorMsg})`);
    }

    const data = await response.json();
    return data.response || data.message || "No response text found.";
} catch (err) {
    console.error("Fetch error:", err);
    throw err;
}
}

function renderResult(markdown) {
    const existingError = outputContainer.querySelector('.error-card');
    if (existingError) existingError.remove();

    const lines = markdown.split('\n');
    let html = '';
    let listStack = [];
    let lastIndent = 0;
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        const formatLine = (text) => text
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>');

        if (trimmed.startsWith('|')) {
            while (listStack.length > 0) { html += `</${listStack.pop()}>`; }
            lastIndent = 0;
            if (!inTable) {
                html += '<div class="table-wrapper"><table>';
                inTable = true;
                const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
                const isHeader = nextLine.startsWith('|') && nextLine.includes('---');
                html += isHeader ? '<thead><tr>' : '<tbody><tr>';
                trimmed.split('|').forEach((cell, index, arr) => {
                    if (index === 0 || index === arr.length - 1) return;
                    html += isHeader ? `<th>${formatLine(cell.trim())}</th>` : `<td>${formatLine(cell.trim())}</td>`;
                });
                html += isHeader ? '</tr></thead>' : '</tr></tbody>';
                if (isHeader) { html += '<tbody>'; i++; }
            } else {
                if (trimmed.includes('---')) continue;
                html += '<tr>';
                trimmed.split('|').forEach((cell, index, arr) => {
                    if (index === 0 || index === arr.length - 1) return;
                    html += `<td>${formatLine(cell.trim())}</td>`;
                });
                html += '</tr>';
            }
            continue;
        } else if (inTable) {
            html += '</tbody></table></div>';
            inTable = false;
        }

        const listMatch = line.match(/^(\s*)([\-\*]|\d+\.)\s+(.*)/);
        if (listMatch) {
            if (inTable) { html += '</tbody></table></div>'; inTable = false; }
            const indentStr = listMatch[1];
            const marker = listMatch[2];
            const content = listMatch[3];
            const currentIndent = Math.floor(indentStr.length / 2);
            const isOrdered = /^\d+\./.test(marker);
            const type = isOrdered ? 'ol' : 'ul';
            if (currentIndent > lastIndent) {
                const diff = currentIndent - lastIndent;
                for (let j = 0; j < diff; j++) { html += `<${type}>`; listStack.push(type); }
            } else if (currentIndent < lastIndent) {
                const diff = lastIndent - currentIndent;
                for (let j = 0; j < diff; j++) { if (listStack.length > 0) html += `</${listStack.pop()}>`; }
            } else {
                if (listStack.length === 0) { html += `<${type}>`; listStack.push(type); }
            }
            html += `<li>${formatLine(content)}</li>`;
            lastIndent = currentIndent;
            continue;
        } else {
            while (listStack.length > 0) { html += `</${listStack.pop()}>`; }
            lastIndent = 0;
        }

        if (trimmed.startsWith('#### ')) { html += `<h4>${formatLine(trimmed.substring(5))}</h4>`; }
        else if (trimmed.startsWith('### ')) { html += `<h3>${formatLine(trimmed.substring(4))}</h3>`; }
        else if (trimmed.startsWith('## ')) { html += `<h2>${formatLine(trimmed.substring(3))}</h2>`; }
        else if (trimmed.startsWith('# ')) { html += `<h1>${formatLine(trimmed.substring(2))}</h1>`; }
        else if (trimmed.match(/^\*\*Topic Name\*\*:?/i) || trimmed.startsWith("Topic:")) {
            let content = trimmed.replace(/^\*\*Topic Name\*\*:?/, '').replace(/^Topic:/, '').trim();
            html += `<h1>${formatLine(content)}</h1>`;
        }
        else if (trimmed.match(/^(simple explanation|key points|example|quick summary)[:]?$/i) || trimmed.match(/^\*\*(simple explanation|key points|example|quick summary)[:]?\*\*$/i)) {
            let content = trimmed.replace(/\*/g, '').replace(':', '').trim();
            html += `<h3>${content}</h3>`;
        }
        else { html += `<p>${formatLine(trimmed)}</p>`; }
    }
    while (listStack.length > 0) { html += `</${listStack.pop()}>`; }
    if (inTable) html += '</tbody></table></div>';
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = html;
    const emptyState = outputContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    outputContainer.insertBefore(card, outputContainer.firstChild);
}

function handleError(error) {
    console.error(error);

    // 🔥 force remove all previous errors
    document.querySelectorAll('.error-card').forEach(e => e.remove());

    const errorHtml = `
        <div class="result-card" style="border-top: 2px solid #ff4444; padding-top: 1rem;">
            <h3 style="color: #ff4444; margin-top: 0;">⚠️ Error</h3>
            <p style="color: #e1e1e1;">${error.message}</p>
        </div>`;

    const existingError = outputContainer.querySelector('.error-card');
    if (existingError) existingError.remove();

    // We can just reuse showErrorHtml if we want, or implement simpler version here
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-card';
    errorDiv.innerHTML = errorHtml;

    const emptyState = outputContainer.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    outputContainer.insertBefore(errorDiv, outputContainer.firstChild);
}

function resetOutputState() {
    // Remove old errors
    document.querySelectorAll('.error-card').forEach(e => e.remove());

    // Remove old results
    document.querySelectorAll('.result-card').forEach(r => r.remove());
}
