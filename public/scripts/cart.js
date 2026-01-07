// --- LÓGICA DE MULTI-USUÁRIO ---

// Descobre qual "gaveta" usar no LocalStorage
function getCartKey() {
    const userId = localStorage.getItem('userId');
    // Se tiver ID (logado), usa 'cart_123'. Se não, usa 'cart_guest'
    return userId ? `cart_${userId}` : 'cart_guest';
}

// Inicializa o carrinho pegando da gaveta correta
let cart = JSON.parse(localStorage.getItem(getCartKey())) || [];

// Função Centralizada para Salvar (Evita repetir código)
function saveCart() {
    localStorage.setItem(getCartKey(), JSON.stringify(cart));
    updateCartCount();
}

// --- FUNÇÕES DO CARRINHO ---

// Atualiza o numerozinho no ícone
function updateCartCount() {
    const count = cart.reduce((acc, item) => acc + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if(badge) badge.innerText = count;
}

// Adicionar ao carrinho
function addToCart(product) {
    // Recarrega o carrinho para garantir que está sincronizado (caso tenha mudado de aba)
    cart = JSON.parse(localStorage.getItem(getCartKey())) || [];

    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        alert("Este PDF já está no seu carrinho!");
    } else {
        // Adiciona e SALVA
        cart.push({ ...product, quantity: 1 });
        saveCart(); // <--- Usa a função nova

        // Feedback visual
        if (event && event.target) {
            const btn = event.target.closest('button');
            if (btn) {
                const originalText = btn.innerHTML;
                const originalColor = btn.style.background;
                
                btn.innerHTML = '<i class="fas fa-check"></i> Adicionado!';
                btn.style.background = "#28a745";
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = originalColor;
                }, 2000);
            }
        }
    }
}

// Remover do carrinho
function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    saveCart(); // <--- Salva na chave correta
    renderCartModal(); // Atualiza a tela
}

// Renderiza o HTML dentro do Modal
function renderCartModal() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-value');
    
    container.innerHTML = '';
    let total = 0;

    if (!cart || cart.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#888;">
                <i class="fas fa-shopping-basket" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
                <p>Seu carrinho está vazio.</p>
            </div>`;
        totalEl.innerText = 'R$ 0,00';
        return;
    }

    cart.forEach(item => {
        const priceNumber = parseFloat(item.price);
        const safePrice = isNaN(priceNumber) ? 0 : priceNumber;
        
        total += safePrice;

        const priceDisplay = safePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        const div = document.createElement('div');
        div.className = 'cart-item';
        // CSS Inline para garantir visual
        div.style.cssText = "display:flex; justify-content:space-between; padding:15px 0; border-bottom:1px solid #eee; align-items:center;";

        div.innerHTML = `
            <div style="flex:1">
                <strong style="color:var(--blue-navy);">${item.title}</strong><br>
                <small style="color:#666">PDF Digital • R$ ${priceDisplay}</small>
            </div>
            <button onclick="removeFromCart(${item.id})" title="Remover" style="color:#e74c3c; border:none; background:none; cursor:pointer; font-size:1.1rem; padding:10px;">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        container.appendChild(div);
    });

    totalEl.innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Checkout
async function checkoutCart() {
    const token = localStorage.getItem('token');
    
    // 1. Validação de Login
    if(!token) {
        // Salva o carrinho atual antes de mandar pro login (segurança extra)
        saveCart();
        alert("Por favor, faça login para finalizar sua compra.");
        toggleCart();
        window.location.href = "login.html";
        return;
    }

    if (cart.length === 0) {
        alert("Seu carrinho está vazio.");
        return;
    }

    const btn = document.getElementById('btn-checkout-final');
    const originalText = btn.innerText;
    
    btn.innerText = 'AGUARDE...';
    btn.disabled = true;

    try {
        const res = await authFetch(`${API_URL}/create-checkout-session`, {
            method: 'POST',
            body: JSON.stringify({ cartItems: cart })
        });
        
        const data = await res.json();

        if (data.url) {
            window.location.href = data.url;
        } else {
            alert("Erro ao criar pagamento: " + (data.error || "Desconhecido"));
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (e) {
        console.error("Erro rede:", e);
        alert("Erro de conexão com o servidor.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Abrir/Fechar Modal
function toggleCart() {
    const modal = document.getElementById('cart-modal');
    // Recarrega o carrinho ao abrir para garantir dados frescos
    cart = JSON.parse(localStorage.getItem(getCartKey())) || [];
    
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        renderCartModal();
        modal.style.display = 'flex';
    }
}

// Inicializa
document.addEventListener('DOMContentLoaded', updateCartCount);