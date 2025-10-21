const PUBLIC_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRPfw5MIs5xcHo4Hl2A-EdFwPHZGllZEaZoFWmpYQWiP_gulHHybxK79TdlEcW47zk9m5nvWabO3REr/pubhtml';
const DEBUG = true;

function parseCSV(text) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === ',' && !inQuotes) {
            row.push(current);
            current = '';
            continue;
        }

        if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && next === '\n') continue;
            if (current !== '' || row.length) {
                row.push(current);
                rows.push(row);
                row = [];
                current = '';
            }
            continue;
        }

        current += ch;
    }

    if (current !== '' || row.length) {
        row.push(current);
        rows.push(row);
    }

    return rows;
}

function toCsvUrl(url) {
    try {
        const u = new URL(url);
        if (u.searchParams.get('output') === 'csv') return url;
        if (u.pathname.endsWith('/pubhtml')) {
            return url.replace('/pubhtml', '/pub?output=csv');
        }
        if (u.pathname.endsWith('/pub')) {
            if (u.search) return url + '&output=csv';
            return url + '?output=csv';
        }
        if (u.search) return url + '&output=csv';
        return url + '?output=csv';
    } catch (e) {
        return url;
    }
}

function parseHTMLTableToRows(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return [];
    const rows = [];
    const trs = table.querySelectorAll('tr');
    trs.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('th,td')).map(td => td.textContent.trim());
        rows.push(cells);
    });
    return rows;
}

async function loadDogs() {
    const loadingEl = document.getElementById('loading');
    try {
    const csvUrl = toCsvUrl(PUBLIC_SHEET_CSV_URL);
    if (DEBUG) console.log('[dogs.js] usando URL (csv attempt):', csvUrl);
    let resp = await fetch(csvUrl);

        let text = await resp.text();
        let parsed;

        if (text.trim().startsWith('<') && text.toLowerCase().includes('<table')) {
            parsed = parseHTMLTableToRows(text);
        } else {
            parsed = parseCSV(text);
        }

        if (DEBUG) console.log('[dogs.js] parsed length:', parsed && parsed.length);
        if (!parsed || parsed.length === 0) {
            if (DEBUG) console.log('[dogs.js] tentativa com PUBLIC_SHEET_CSV_URL original');
            resp = await fetch(PUBLIC_SHEET_CSV_URL);
            text = await resp.text();
            if (text.trim().startsWith('<') && text.toLowerCase().includes('<table')) {
                parsed = parseHTMLTableToRows(text);
            } else {
                parsed = parseCSV(text);
            }
        }

        if (DEBUG) console.log('[dogs.js] parsed final length:', parsed && parsed.length);
        if (!parsed || parsed.length === 0) throw new Error('Nenhum dado encontrado');

        const header = parsed[0].map(h => h.trim());
        const rows = parsed.slice(1).filter(r => r.length > 0);

        const dogsGrid = document.getElementById('dogsGrid');
        dogsGrid.innerHTML = '';

        const findIndex = name => {
            const low = name.toLowerCase();
            return header.findIndex(h => h && h.toLowerCase().includes(low));
        };

        let idxNome = findIndex('nome');
        let idxSexo = findIndex('sexo');
        let idxPeso = findIndex('peso');
        let idxPelagem = findIndex('pelagem');
        let idxAno = findIndex('ano');
        let idxRaca = (findIndex('raça') >= 0) ? findIndex('raça') : findIndex('raca');
        let idxFoto = findIndex('foto') >= 0 ? findIndex('foto') : findIndex('imagem');

        if (DEBUG) console.log('[dogs.js] header detected:', header);

        if (idxNome < 0) idxNome = 0;
        if (idxSexo < 0) idxSexo = 1;
        if (idxPeso < 0) idxPeso = 2;
        if (idxPelagem < 0) idxPelagem = 3;
        if (idxAno < 0) idxAno = 4;
        if (idxRaca < 0) idxRaca = 5;
        if (idxFoto < 0) idxFoto = 6;
        if (DEBUG) console.log('[dogs.js] column indexes:', {idxNome, idxSexo, idxPeso, idxPelagem, idxAno, idxRaca, idxFoto});

        rows.forEach(columns => {
            const nome = columns[idxNome] || 'Nome -';
            const sexo = columns[idxSexo] || '-';
            const peso = columns[idxPeso] || '-';
            const pelagem = columns[idxPelagem] || '-';
            const ano = columns[idxAno] || '-';
            const raca = (columns[idxRaca] || '-');
            const foto = (columns[idxFoto] && columns[idxFoto].trim()) ? columns[idxFoto] : 'IMGs/placeholder-dog.jpg';

            const params = new URLSearchParams({
                nome, sexo, peso, pelagem, ano, raca, foto
            }).toString();
            dogsGrid.innerHTML += `<a href="detalhe.html?${params}" target="_blank" class="text-decoration-none text-reset">${createDogCard(nome, sexo, peso, pelagem, ano, raca, foto)}</a>`;
        });

        if (rows.length === 0) {
            dogsGrid.innerHTML = `<div class="col-12 text-center"><p class="text-muted">Nenhum cão disponível no momento.</p></div>`;
        }
    } catch (err) {
        console.error('Erro ao carregar dados da planilha publicada:', err);
        const dogsGrid = document.getElementById('dogsGrid');
        dogsGrid.innerHTML = `<div class="col-12 text-center"><p class="text-danger">Erro no carregamento</p></div>`;
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function createDogCard(nome, sexo, peso, pelagem, anoNascimento, raca, foto) {
    return `
        <div class="col-12 col-md-6 col-lg-4 mb-4">
            <div class="dog-card">
                <div class="dog-image">
                    <img src="${foto}" alt="Foto de ${nome}" onerror="this.src='IMGs/placeholder-dog.jpg'">
                </div>
                <div class="dog-info">
                    <h3 class="dog-name">${nome}</h3>
                    <div class="dog-details">
                        <p>Sexo: ${sexo}</p>
                        <p>Peso: ${peso}</p>
                        <p>Pelagem: ${pelagem}</p>
                        <p>Ano de nascimento: ${anoNascimento}</p>
                        <p>Raça: ${raca}</p>
                    </div>
                    <div class="dog-buttons">
                        <button class="dog-btn adote-btn" onclick="iniciarAdocao('${nome}')">
                            Adote
                        </button>
                        <button class="dog-btn apadrinhe-btn" onclick="iniciarApadrinhamento('${nome}')">
                            Apadrinhe
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function iniciarAdocao(nomeCao) {
    const whatsappNumber = '5511999999999';
    const message = `Olá! Gostaria de saber mais sobre a adoção do(a) ${nomeCao}`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function iniciarApadrinhamento(nomeCao) {
    const whatsappNumber = '5511999999999';
    const message = `Olá! Gostaria de saber mais sobre como apadrinhar o(a) ${nomeCao}`;
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

window.addEventListener('load', loadDogs);