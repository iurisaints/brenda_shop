const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

const app = express();

// Configurações Básicas
app.use(express.json());
app.use(cors());

// Chave para criptografia do Token
const SECRET_KEY = 'sua_chave_secreta_super_segura'; 

// --- CONFIGURAÇÃO DE UPLOAD (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Salva na pasta uploads
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + path.extname(file.originalname);
        cb(null, uniqueSuffix);
    }
});
const upload = multer({ storage: storage });

// Libera acesso público às imagens
app.use('/uploads', express.static('uploads'));

// --- CONEXÃO COM O BANCO ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Verifique se seu usuário é root
    password: 'root',      // Verifique sua senha
    database: 'brenda_shop'
});

db.connect(err => {
    if (err) console.error('Erro ao conectar no MySQL:', err);
    else console.log('MySQL Conectado!');
});

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// ==================================================
// 1. ROTAS DE AUTENTICAÇÃO (LOGIN E CADASTRO)
// ==================================================

// Cadastro
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        
        db.query(sql, [name, email, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: "E-mail já cadastrado." });
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: "Usuário criado com sucesso!" });
        });
    } catch (e) {
        res.status(500).json({ error: "Erro interno" });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(400).json({ error: "Usuário não encontrado." });

        const user = results[0];

        try {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) return res.status(400).json({ error: "Senha incorreta." });

            const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '24h' });

            res.json({
                message: "Login realizado!",
                token,
                id: user.id,
                name: user.name,
                role: user.role
            });
        } catch (e) {
            res.status(500).json({ error: "Erro ao validar senha" });
        }
    });
});

// ==================================================
// 2. ROTAS DE PRODUTOS (COM FOTOS)
// ==================================================

// Listar Produtos
app.get('/api/products', (req, res) => {
    const { search, category } = req.query;
    
    let sql = "SELECT * FROM products WHERE 1=1";
    let params = [];

    if (category && category !== 'Todas') {
        sql += " AND category = ?";
        params.push(category);
    }

    if (search) {
        sql += " AND (title LIKE ? OR description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY id DESC";

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Criar Produto (Admin)
app.post('/api/products', authenticateToken, upload.single('image'), (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { title, price, category, description } = req.body;
    
    // Define imagem (ou placeholder se não enviou nada)
    let image_url = 'https://via.placeholder.com/150';
    if (req.file) {
        image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    const sql = "INSERT INTO products (title, price, category, description, image_url) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [title, price, category, description, image_url], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Produto criado!", id: result.insertId });
    });
});

// Atualizar Produto (Admin)
app.put('/api/products/:id', authenticateToken, upload.single('image'), (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { title, price, category, description } = req.body;
    const { id } = req.params;

    let sql, params;

    if (req.file) {
        // Atualiza COM imagem nova
        const image_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        sql = "UPDATE products SET title=?, price=?, category=?, description=?, image_url=? WHERE id=?";
        params = [title, price, category, description, image_url, id];
    } else {
        // Atualiza SEM mudar imagem
        sql = "UPDATE products SET title=?, price=?, category=?, description=? WHERE id=?";
        params = [title, price, category, description, id];
    }
    
    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Produto atualizado!" });
    });
});

// Deletar Produto (Admin)
app.delete('/api/products/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const sql = "DELETE FROM products WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Produto deletado!" });
    });
});

// ==================================================
// 3. ROTAS DE PEDIDOS
// ==================================================

// Listar Meus Pedidos
app.get('/api/orders', authenticateToken, (req, res) => {
    const userId = req.user.id;

    const sqlOrders = `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`;
    
    db.query(sqlOrders, [userId], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        if (orders.length === 0) return res.json([]);

        // Busca itens para cada pedido
        const promises = orders.map((order) => {
            return new Promise((resolve, reject) => {
                const sqlItems = `SELECT * FROM order_items WHERE order_id = ?`;
                db.query(sqlItems, [order.id], (err, items) => {
                    if (err) return reject(err);
                    order.items = items;
                    resolve(order);
                });
            });
        });

        Promise.all(promises)
            .then(completedOrders => res.json(completedOrders))
            .catch(error => res.status(500).json({ error: "Erro ao buscar itens" }));
    });
});

// Criar Pedido (Simulação de Checkout)
app.post('/api/create-checkout-session', authenticateToken, (req, res) => {
    const { cartItems } = req.body;
    const userId = req.user.id;

    if (!cartItems || cartItems.length === 0) return res.status(400).json({ error: "Carrinho vazio" });

    const total = cartItems.reduce((acc, item) => acc + parseFloat(item.price), 0);

    // 1. Cria Cabeçalho
    const sqlOrder = "INSERT INTO orders (user_id, total, status, created_at) VALUES (?, ?, 'paid', NOW())";
    
    db.query(sqlOrder, [userId, total], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        const orderId = result.insertId;

        // 2. Insere Itens
        cartItems.forEach(item => {
            db.query("INSERT INTO order_items (order_id, product_id, title, price) VALUES (?, ?, ?, ?)", 
            [orderId, item.id, item.title, item.price]);
        });

        res.json({ url: 'meus-pedidos.html' });
    });
});

// Rota Admin Stats (Opcional, mas útil se você voltar com o dashboard)
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const sql = `
        SELECT 
            (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'paid') as revenue,
            (SELECT COUNT(*) FROM orders WHERE status = 'paid') as sales,
            (SELECT COUNT(*) FROM users WHERE role = 'client') as users
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: "Erro stats" });
        res.json(results[0]);
    });
});

// Inicia Servidor
app.listen(3000, () => {
    console.log('SERVIDOR RODANDO CORRETAMENTE NA PORTA 3000');
});