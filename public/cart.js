// cart.js
let cart = JSON.parse(localStorage.getItem('brendaCart')) || [];

// Atualiza o numerozinho no ícone do carrinho
function updateCartCount() {
    const count = cart.reduce((acc, item) => acc + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if(badge) badge.innerText = count;
}

// Adicionar ao carrinho
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        alert("Este PDF já está no seu carrinho!");
    } else {
        cart.push({ ...product, quantity: 1 });
        localStorage.setItem('brendaCart', JSON.stringify(cart));
        updateCartCount();
        // Feedback visual simples
        const btn = event.target.closest('button'); // Acha o botão clicado
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Adicionado!';
        btn.style.background = "#28a745";
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = ""; // Volta cor original
        }, 2000);
    }
}

// Remover do carrinho
function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    localStorage.setItem('brendaCart', JSON.stringify(cart));
    updateCartCount();
    renderCartModal(); // Atualiza a tela do modal
}

// Renderiza o HTML dentro do Modal
function renderCartModal() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-value');
    
    // Limpa o HTML atual
    container.innerHTML = '';
    let total = 0;

    if (!cart || cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#888">Seu carrinho está vazio.</p>';
        totalEl.innerText = 'R$ 0,00';
        return;
    }

    cart.forEach(item => {
        // --- CORREÇÃO DE SEGURANÇA AQUI ---
        // Garante que o preço seja tratado como número para soma
        const priceNumber = parseFloat(item.price);
        
        // Se o preço for inválido, considera 0
        const safePrice = isNaN(priceNumber) ? 0 : priceNumber;
        
        total += safePrice;

        // Formata bonitinho para exibir (R$ 29,90)
        const priceDisplay = safePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        const div = document.createElement('div');
        div.className = 'cart-item';
        
        // Adiciona estilo inline para garantir visual caso CSS falhe
        div.style.cssText = "display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center;";

        div.innerHTML = `
            <div>
                <strong>${item.title}</strong><br>
                <small style="color:#666">R$ ${priceDisplay}</small>
            </div>
            <button onclick="removeFromCart(${item.id})" style="color:var(--red-deep, red); border:none; background:none; cursor:pointer; font-size:1.2rem;">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(div);
    });

    // Atualiza o total final
    totalEl.innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Função Finalizar Compra (Checkout do Carrinho)
async function checkoutCart() {
    const token = localStorage.getItem('token');
    
    // 1. Validação de Login
    if(!token) {
        alert("Por favor, faça login para finalizar sua compra.");
        toggleCart(); // Fecha carrinho
        window.location.href = "login.html";
        return;
    }

    // 2. Validação do Carrinho
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
            // MUDANÇA AQUI: Redireciona direto para o Mercado Pago
            window.location.href = data.url;
        } else {
            alert("Erro ao criar pagamento.");
            btn.disabled = false;
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
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        renderCartModal(); // Renderiza antes de mostrar
        modal.style.display = 'flex';
    }
}

// Inicializa contador ao carregar página
document.addEventListener('DOMContentLoaded', updateCartCount);