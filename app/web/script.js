// Highlighting Logic
const encryptInput = document.getElementById('encryptInput');
const isJsonToggle = document.getElementById('isJsonToggle');
const jsonPreview = document.getElementById('jsonPreview');
const jsonError = document.getElementById('jsonError');

function syntaxHighlight(json) {
    if (typeof json != 'string') {
        json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function updateJsonPreview() {
    if (!isJsonToggle.checked) {
        jsonPreview.classList.remove('visible');
        jsonError.style.display = 'none';
        return;
    }

    const val = encryptInput.value.trim();
    if (!val) {
        jsonPreview.innerHTML = '';
        jsonPreview.classList.remove('visible');
        return;
    }

    try {
        const obj = JSON.parse(val);
        jsonPreview.innerHTML = syntaxHighlight(obj);
        jsonPreview.classList.add('visible');
        jsonError.style.display = 'none';
    } catch (e) {
        jsonPreview.classList.remove('visible');
        jsonError.style.display = 'block';
    }
}

encryptInput.addEventListener('input', updateJsonPreview);
isJsonToggle.addEventListener('change', updateJsonPreview);

// API Interactions
async function handleEncrypt() {
    const key = document.getElementById('globalKey').value.trim();
    let data = encryptInput.value;
    const isJson = isJsonToggle.checked;
    const resultBox = document.getElementById('encryptResult');

    if (!key) {
        alert("Por favor ingrese la Key Base64");
        return;
    }

    if (isJson) {
        try {
            // Minify JSON before sending if it's JSON mode
            const obj = JSON.parse(data);
            data = JSON.stringify(obj);
        } catch (e) {
            alert("JSON inválido. Corríjalo antes de enviar.");
            return;
        }
    }

    try {
        const params = new URLSearchParams({
            key: key,
            data: data
        });

        const res = await fetch(`/encrypt?${params.toString()}`, {
            method: 'POST'
        });

        const text = await res.text();

        let cleanText = text;
        if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
            cleanText = cleanText.slice(1, -1);
        }

        try {
            cleanText = JSON.parse(text);
        } catch (e) {
            // fallback
        }

        resultBox.innerText = cleanText;
        resultBox.classList.add('visible');
    } catch (err) {
        console.error(err);
        alert("Error al encriptar: " + err.message);
    }
}

async function handleDecrypt() {
    const key = document.getElementById('globalKey').value.trim();
    const dataEncrypted = document.getElementById('decryptInput').value.trim();
    const resultBox = document.getElementById('decryptResult');

    if (!key || !dataEncrypted) {
        alert("Ingrese Key y Datos Encriptados");
        return;
    }

    try {
        const params = new URLSearchParams({
            key: key,
            data_encrypted: dataEncrypted
        });

        const res = await fetch(`/decrypt?${params.toString()}`, {
            method: 'POST'
        });

        const json = await res.json();

        if (json === false) {
            resultBox.innerHTML = '<span style="color:var(--error-color)">Error al desencriptar (False)</span>';
        } else {
            // Pretty print result
            resultBox.innerHTML = syntaxHighlight(json);
        }
        resultBox.classList.add('visible');

    } catch (err) {
        console.error(err);
        alert("Error de red o parsing: " + err.message);
    }
}
