// O navegador descobre sozinho se está no seu PC ou no Railway
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api';

// Verifica se está logado ao carregar
function checkAuth() {
    const token = localStorage.getItem('token');
    const userNav = document.getElementById('user-nav');
    
    if (token) {
        const name = localStorage.getItem('userName');
        userNav.innerHTML = `
            <span>Olá, ${name}</span>
            <a href="meus-pedidos.html">Meus Pedidos</a>
            <button class="btn-logout" onclick="logout()">Sair</button>
        `;
    } else {
        userNav.innerHTML = `
            <a href="login.html">Entrar</a>
            <a href="cadastro.html" style="background:var(--red-deep); padding:5px 10px; border-radius:4px;">Cadastrar</a>
        `;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
}

// Fetch customizado que já manda o Token
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
        logout(); // Token expirou
        window.location.href = 'login.html';
    }
    return response;

}
