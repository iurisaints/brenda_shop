require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
// Configura multer para guardar arquivo na memória RAM temporariamente
const upload = multer({ storage: multer.memoryStorage() });

// Configuração Firebase
let serviceAccount;

if (process.env.FIREBASE_CREDENTIALS) {
    // Se estiver no Railway (Produção), lê da variável de ambiente
    serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} else {
    // Se estiver no seu PC (Local), lê do arquivo
    serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_BUCKET
});

const app = express();
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_super_secreto_da_brenda';

// --- MIDDLEWARE DE SEGURANÇA ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Middleware: Só deixa passar se for ADMIN
function checkAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Acesso negado. Apenas admins.' });
    }
}

// --- ROTAS DE AUTENTICAÇÃO ---

// 1. Cadastro
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    // Criptografar senha
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
        [name, email, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email já cadastrado.' });
                return res.status(500).json({ error: 'Erro ao cadastrar.' });
            }
            res.status(201).json({ message: 'Usuário criado!' });
        });
});

// Rota de Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Agora selecionamos também o 'role' do banco
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (results.length === 0) return res.status(400).json({ error: 'Usuário não encontrado' });

        const user = results[0];

        // Verifica a senha (bcrypt)
        if (await bcrypt.compare(password, user.password)) {

            // --- AQUI ESTÁ A MUDANÇA IMPORTANTE ---
            // Adicionamos 'role: user.role' dentro do Token
            const token = jwt.sign(
                { id: user.id, name: user.name, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Devolvemos também o role para o Frontend saber para onde redirecionar
            res.json({ token, name: user.name, role: user.role });
        } else {
            res.status(403).json({ error: 'Senha incorreta' });
        }
    });
});

// --- ROTAS DA LOJA ---

// Listar Produtos (Público)
app.get('/api/products', (req, res) => {
    const sql = 'SELECT id, title, description, price, image_url FROM products';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ROTA: CRIA PAGAMENTO E REGISTRA PEDIDO PENDENTE
// --- ROTA DE CHECKOUT COM DEBUG ---
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
    console.log("1. Iniciando checkout...");
    const { cartItems } = req.body;
    const userId = req.user.id;

    // 1. Validação básica
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error("ERRO FATAL: MP_ACCESS_TOKEN não encontrado no .env");
        return res.status(500).json({ error: "Servidor sem token do Mercado Pago" });
    }

    if (!cartItems || cartItems.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });

    // 2. Busca produtos
    const ids = cartItems.map(item => item.id);
    const query = 'SELECT id, title, price FROM products WHERE id IN (?)';
    
    db.query(query, [ids], async (err, products) => {
        if (err) {
            console.error("Erro no Banco:", err);
            return res.status(500).json(err);
        }

        console.log("2. Produtos encontrados:", products.length);

        const orderReference = `ORDER-${userId}-${Date.now()}`;
        
        // 3. Monta Itens (Garante que tudo é número/string correto)
        const items = products.map(product => ({
            id: String(product.id),
            title: product.title,
            quantity: 1,
            unit_price: Number(product.price), // Garante que é número
            currency_id: 'BRL'
        }));

        // 4. Prepara URLs (Com fallback forçado para garantir que não vá vazio)
        // Se o .env estiver vazio, ele usa o localhost
        const domain = process.env.DOMAIN_URL || 'http://localhost:3000';
        
        // Remove barra no final se tiver (pra não ficar http://site.com//meus-pedidos)
        const cleanDomain = domain.replace(/\/$/, ""); 

        const backUrls = {
            success: `${cleanDomain}/meus-pedidos.html`,
            failure: `${cleanDomain}/index.html`,
            pending: `${cleanDomain}/meus-pedidos.html`
        };

        console.log("3. URLs configuradas:", backUrls);

        try {
            console.log("4. Enviando para o Mercado Pago...");
            
            const preference = new Preference(client);
            const result = await preference.create({
                body: {
                    items: items,
                    back_urls: backUrls,
                    //auto_return: 'approved',
                    external_reference: orderReference,
                }
            });

            console.log("5. SUCESSO MP! URL:", result.init_point);

            // 5. Salva no banco
            const values = products.map(p => [orderReference, userId, p.id, 'pending']);
            const sql = 'INSERT INTO orders (payment_id, user_id, product_id, status) VALUES ?';
            
            db.query(sql, [values], (err) => {
                if(err) {
                    console.error("Erro ao salvar pedido no banco:", err);
                    return res.status(500).json({ error: 'Erro ao salvar pedido.' });
                }
                res.json({ url: result.init_point });
            });

        } catch (e) {
            // AQUI ONDE VAMOS DESCOBRIR O ERRO
            console.error("--- ERRO MERCADO PAGO ---");
            console.error(JSON.stringify(e, null, 2)); // Imprime o erro detalhado
            
            if (e.cause) {
                console.error("CAUSA:", e.cause);
            }
            
            res.status(500).json({ error: 'Erro no Mercado Pago (Olhe o terminal)' });
        }
    });
});

// Listar MEUS Pedidos (Protegido)
app.get('/api/my-orders', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const sql = `
        SELECT orders.id, orders.status, products.title, products.firebase_filename, orders.stripe_session_id, orders.created_at
        FROM orders
        JOIN products ON orders.product_id = products.id
        WHERE orders.user_id = ? AND orders.status = 'paid'
        ORDER BY orders.created_at DESC
    `;
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// Webhook Simulado (Para validar o pagamento e liberar download)
// Nota: Em produção real, usa-se Webhooks do Stripe. Aqui faremos via verificação no load da página meus-pedidos para simplificar.
app.post('/api/check-payment', authenticateToken, async (req, res) => {
    // Verifica pagamentos pendentes deste usuário
    const userId = req.user.id;

    // Busca pedidos pendentes
    db.query('SELECT stripe_session_id FROM orders WHERE user_id = ? AND status = "pending"', [userId], async (err, orders) => {
        if (!orders) return res.json({ updated: 0 });

        for (let order of orders) {
            const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
            if (session.payment_status === 'paid') {
                db.query('UPDATE orders SET status = "paid" WHERE stripe_session_id = ?', [order.stripe_session_id]);
            }
        }
        res.json({ message: 'Checked' });
    });
});

// Gerar Link de Download (Protegido e Validado)
app.post('/api/get-download-link', authenticateToken, (req, res) => {
    const { productId } = req.body;

    // Gera um link para nossa rota de stream
    // Precisamos validar se o usuário comprou este produto antes (segurança extra recomendada aqui)
    const downloadUrl = `${process.env.DOMAIN_URL}/api/download-db/${productId}?token=${req.headers.authorization.split(' ')[1]}`;
    res.json({ url: downloadUrl });
});

// --- ROTAS DO PAINEL ADMIN ---

// 1. Dashboard: Retorna estatísticas de vendas
app.get('/api/admin/stats', authenticateToken, checkAdmin, (req, res) => {
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM orders WHERE status = 'paid') as total_sales,
            (SELECT SUM(p.price) FROM orders o JOIN products p ON o.product_id = p.id WHERE o.status = 'paid') as total_revenue,
            (SELECT COUNT(*) FROM users) as total_users
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results[0]);
    });
});

// 2. Adicionar Novo Produto (para o banco)
app.post('/api/admin/products', authenticateToken, checkAdmin, upload.single('pdfFile'), (req, res) => {
    try {
        const { title, description, price, image_url } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'Arquivo PDF obrigatório' });

        const sql = `INSERT INTO products (title, description, price, image_url, file_data, file_name, file_type) VALUES (?, ?, ?, ?, ?, ?, ?)`;

        db.query(sql, [title, description, price, image_url, file.buffer, file.originalname, file.mimetype], (err, result) => {
            if (err) {
                console.error(err); // Útil para debugar se o arquivo for muito grande
                return res.status(500).json({ error: 'Erro ao salvar no banco.' });
            }
            res.json({ message: 'Produto e Arquivo salvos no Banco!' });
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

//ROTA QUE ENTREGA O ARQUIVO (STREAM)
app.get('/api/download-db/:id', (req, res) => {
    const { id } = req.params;
    const { token } = req.query;

    if (!token) return res.status(403).send("Acesso negado.");

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send("Token inválido.");

        // Busca o arquivo pesado (LONGBLOB) só agora
        db.query('SELECT file_data, file_name, file_type FROM products WHERE id = ?', [id], (err, results) => {
            if (results.length === 0) return res.status(404).send("Arquivo não encontrado.");

            const product = results[0];

            // Configura o navegador para baixar
            res.setHeader('Content-Type', product.file_type);
            res.setHeader('Content-Disposition', `attachment; filename="${product.file_name}"`);

            // Envia o arquivo binário
            res.send(product.file_data);
        });
    });
});

// ROTA: VERIFICA E LIBERA O PEDIDO
app.post('/api/verify-payment', authenticateToken, async (req, res) => {
    const { payment_id, external_reference } = req.body;

    // Se a URL trouxe o 'external_reference', usamos ele para atualizar os pedidos
    if (external_reference) {

        // Vamos checar no MP se esse pagamento está mesmo aprovado (Segurança)
        try {
            const payment = new Payment(client);
            const paymentData = await payment.get({ id: payment_id });

            if (paymentData.status === 'approved') {
                // Atualiza TODOS os pedidos com aquela referência
                const sql = 'UPDATE orders SET status = "paid" WHERE payment_id = ?';
                db.query(sql, [external_reference], (err) => {
                    if (err) return res.status(500).json(err);
                    res.json({ status: 'paid', message: 'Pagamento Aprovado!' });
                });
            } else {
                res.json({ status: 'pending', message: 'Pagamento em processamento.' });
            }
        } catch (e) {
            res.status(500).json({ error: 'Erro ao consultar Mercado Pago' });
        }
    } else {
        res.status(400).json({ error: 'Dados insuficientes.' });
    }
});

// ROTA: LISTAR APENAS ITENS PAGOS (Para mostrar na tela)
// Nota: Juntamos com a tabela products para pegar o Título, mas NÃO pegamos o arquivo (file_data)
app.get('/api/my-orders', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const sql = `
        SELECT o.id, o.status, p.title, p.id as product_id, o.created_at
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.user_id = ? AND o.status = 'paid'
        ORDER BY o.created_at DESC
    `;
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));