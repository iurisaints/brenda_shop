-- 1. Cria o Banco (se estiver local)
-- Se estiver no Railway, ignore esta linha e use o banco padrão dele
CREATE DATABASE IF NOT EXISTS brenda_shop;
USE brenda_shop;

-- 2. Tabela de Usuários (Login e Cadastro)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Armazena o hash (criptografia)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Produtos (Seus PDFs)
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL, -- Formato correto para dinheiro (ex: 29.90)
    image_url VARCHAR(500), -- URL da capa (pode ser link externo ou local)
    firebase_filename VARCHAR(255) NOT NULL, -- Nome EXATO do arquivo no Firebase Storage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Pedidos (Suporta Carrinho)
-- Um carrinho com 3 itens vai gerar 3 linhas aqui, todas com o mesmo stripe_session_id
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stripe_session_id VARCHAR(255) NOT NULL, -- ID do pagamento no Stripe
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending' (aguardando) ou 'paid' (pago)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Vínculos (Chaves Estrangeiras)
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ==========================================
-- DADOS DE TESTE (OPCIONAL - APENAS PARA INICIAR)
-- ==========================================

-- Inserir Produtos Iniciais
INSERT INTO products (title, description, price, image_url, firebase_filename) VALUES 
('Planejamento Anual BNCC', 'Guia completo com atividades alinhadas à base.', 49.90, 'https://placehold.co/300x200/102340/white?text=Planejamento', 'planejamento_bncc.pdf'),
('Kit Jogos Pedagógicos', 'PDF pronto para imprimir e recortar.', 29.90, 'https://placehold.co/300x200/7A1218/white?text=Jogos', 'kit_jogos.pdf'),
('Apostila de Alfabetização', 'Método fônico com 50 páginas de exercícios.', 35.00, 'https://placehold.co/300x200/3D4F70/white?text=Apostila', 'apostila_alfa.pdf');

-- Nota: Os arquivos 'planejamento_bncc.pdf', etc., PRECISAM estar no seu Firebase Storage.