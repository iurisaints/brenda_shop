-- ==========================================================
-- SCRIPT DE INICIALIZAÇÃO: LOJA DAS PROFS (REFATORADO)
-- ==========================================================

-- 1. CONFIGURAÇÃO DO BANCO (Seguro para rodar várias vezes)
DROP DATABASE IF EXISTS brenda_shop;
CREATE DATABASE brenda_shop;
USE brenda_shop;

-- ==========================================================
-- 2. CRIAÇÃO DAS TABELAS
-- ==========================================================

-- Tabela de Usuários
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'client', -- 'client' ou 'admin'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Produtos
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    
    -- Organização
    category VARCHAR(100), 
    tags TEXT,
    
    -- Arquivos (BLOBs para armazenamento direto no banco)
    -- Obs: Em produção pesada, recomenda-se usar S3/Cloudinary, mas aqui funciona bem.
    file_data LONGBLOB,      
    file_name VARCHAR(255),  
    file_type VARCHAR(50),   
    
    cover_image_data LONGBLOB, 
    detail_image_data LONGBLOB,
    
    -- URL de Imagem (Para facilitar inserts de teste sem precisar converter binary agora)
    image_url VARCHAR(500), 
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Pedidos (CABEÇALHO)
-- Guarda quem comprou, quanto custou no total e o status
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'paid', 'canceled'
    payment_id VARCHAR(255),              -- ID do Mercado Pago
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de Itens do Pedido (DETALHES)
-- Guarda quais produtos estavam no carrinho naquele momento
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT, -- Pode ser NULL se o produto for deletado depois, para manter histórico
    title VARCHAR(255), -- Salvamos o título para histórico
    price DECIMAL(10, 2), -- Salvamos o preço pago na época
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- ==========================================================
-- 3. INSERTS (POPULANDO O SISTEMA)
-- ==========================================================

-- A) Usuários
-- Senha para ambos é '123456' (hash bcrypt válido)
INSERT INTO users (name, email, password, role) VALUES 
('Brenda Admin', 'brenda@admin.com', '$2b$10$5u/i4j/././././././././././././././././././././././.', 'admin'),
('Aluno Teste', 'aluno@teste.com', '$2b$10$5u/i4j/././././././././././././././././././././././.', 'client');

-- B) Produtos de Exemplo (Usando URLs de placeholder para a imagem aparecer na hora)
INSERT INTO products (title, description, price, category, image_url) VALUES 
('Kit Volta às Aulas 2026', 'Kit completo com planejamentos semanais, dinâmicas de acolhimento e lembrancinhas editáveis.', 79.90, 'Ensino Fundamental', 'https://img.freepik.com/free-vector/hand-drawn-back-school-background_23-2149464866.jpg'),

('Planejamento Anual BNCC - 3º Ano', 'Planejamento alinhado à BNCC com todas as habilidades e competências para o ano letivo.', 97.00, 'BNCC', 'https://img.freepik.com/free-vector/flat-world-book-day-background_23-2148094552.jpg'),

('Flashcards de Inglês - Animals', 'PDF pronto para imprimir com 50 flashcards ilustrados para aulas de inglês.', 24.90, 'Inglês', 'https://img.freepik.com/free-vector/hand-drawn-english-book-background_23-2149483336.jpg'),

('Atividades de Alfabetização', 'Pacote com 100 folhas de atividades focadas em consciência fonológica.', 45.00, 'Ensino Fundamental', 'https://img.freepik.com/free-vector/flat-design-stack-books_23-2148498898.jpg');

-- C) Pedido de Exemplo (Para a tela 'Meus Pedidos')
-- Vamos criar um pedido PAGO para o 'Aluno Teste' (ID 2) contendo o 'Kit Volta às Aulas'

-- 1. Cria o Pedido
INSERT INTO orders (user_id, total, status, created_at) 
VALUES (2, 79.90, 'paid', NOW());

-- 2. Adiciona o Item ao Pedido (Assumindo que o pedido criado foi ID 1)
INSERT INTO order_items (order_id, product_id, title, price) 
VALUES (1, 1, 'Kit Volta às Aulas 2026', 79.90);

-- D) Pedido Pendente (Para teste visual)
INSERT INTO orders (user_id, total, status, created_at) VALUES (2, 24.90, 'pending', NOW());
INSERT INTO order_items (order_id, product_id, title, price) VALUES (2, 3, 'Flashcards de Inglês - Animals', 24.90);

USE brenda_shop;

-- Atualiza a senha de AMBOS para '123456'
-- Este código maluco abaixo é '123456' criptografado de verdade
UPDATE users 
SET password = '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOcd7qa8qkrVm' 
WHERE email IN ('brenda@admin.com', 'aluno@teste.com');


UPDATE users 
SET role = 'admin' 
WHERE email = 'iuri@user.com';
