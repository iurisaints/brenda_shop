// --- CONFIGURAÇÕES ---
const stripe = Stripe('pk_test_SUA_CHAVE_PUBLICA_AQUI');
// Variável global para guardar os produtos carregados
let allProducts = [];

const formatMoney = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// 1. Carrega os Produtos
async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const products = await res.json();

        // SALVA NA MEMÓRIA GLOBAL PARA USAR DEPOIS
        allProducts = products;

        const loader = document.getElementById('loading');
        const container = document.getElementById('products');

        loader.style.display = 'none';

        if (products.length === 0) {
            container.innerHTML = '<p style="text-align:center; width:100%">Nenhum produto disponível.</p>';
            return;
        }

        products.forEach(p => {
            const div = document.createElement('div');
            div.className = 'card';

            const imageHTML = p.image_url
                ? `<img src="${p.image_url}" alt="${p.title}">`
                : `<i class="fas fa-file-pdf fa-3x"></i>`;

            // CORREÇÃO AQUI: O botão chama a função passando apenas o ID
            div.innerHTML = `
                    <div class="card-img-top">${imageHTML}</div>
                    <div class="card-body">
                        <span class="badge">PDF Digital</span>
                        <h3 class="card-title">${p.title}</h3>
                        <p class="description">${p.description || 'Sem descrição.'}</p>
                        
                        <div class="price-row">
                            <div class="price-tag">${formatMoney(p.price)}</div>
                        </div>

                        <button class="btn-buy" onclick="addItemById(${p.id}, this)">
                            <i class="fas fa-cart-plus"></i> ADICIONAR AO CARRINHO
                        </button>
                    </div>
                `;
            container.appendChild(div);
        });

    } catch (err) {
        console.error(err);
        document.getElementById('loading').innerHTML = "<p>Erro ao carregar vitrine.</p>";
    }
}

// 2. Nova Função Segura para Adicionar
function addItemById(id, btnElement) {
    // Busca o produto completo na nossa lista global usando o ID
    const product = allProducts.find(p => p.id === id);

    if (product) {
        // Chama a função do cart.js passando o objeto perfeito
        addToCart(product);
    } else {
        alert("Erro ao encontrar produto.");
    }
}

// 3. Função de Compra Direta (Sem carrinho - opcional, mas mantida)
async function buyNow(id) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "login.html";
        return;
    }
    // ... lógica antiga de checkout direto se precisar ...
}