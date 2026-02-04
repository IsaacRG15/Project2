const express = require('express');
const cors = require('cors');
const { getPool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware para ejecutar queries con el rol activo
const db = async (req, res, query, params = []) => {
    const role = req.headers['x-role'] || 'rol_consulta'; // Rol viene del frontend
    const pool = getPool(role);
    try {
        const result = await pool.query(query, params);
        return result.rows;
    } catch (err) {
        console.error("DB Error:", err.message);
        throw err; // Lanzamos error para que el frontend lo muestre
    }
};

// --- AUTH (CORREGIDO) ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    let role = null;
    let name = '';

    // AHORA COINCIDEN CON TU SQL
    if(username === 'usuario_admin' && password === 'admin123') { 
        role = 'rol_administracion'; 
        name = 'Administrador Total'; 
    }
    else if(username === 'usuario_operaciones' && password === 'operaciones123') { 
        role = 'rol_operaciones'; 
        name = 'Operador de Vuelo'; 
    }
    else if(username === 'usuario_consulta' && password === 'consulta123') { 
        role = 'rol_consulta'; 
        name = 'Visitante'; 
    }

    if (role) {
        res.json({ success: true, user: { username, role, name } });
    } else {
        // Mensaje de error claro para depurar
        console.log(`Intento fallido: ${username} / ${password}`);
        res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }
});

// --- DASHBOARD STATS ---
app.get('/api/stats', async (req, res) => {
    try {
        // Estas consultas solo funcionan si tienes permisos de lectura
        const bookings = await db(req, res, 'SELECT count(*) FROM bookings.bookings');
        const flights = await db(req, res, 'SELECT count(*) FROM bookings.flights');
        const passengers = await db(req, res, 'SELECT count(*) FROM bookings.tickets');
        const income = await db(req, res, 'SELECT sum(total_amount) FROM bookings.bookings');
        
        res.json({
            bookings: bookings[0].count,
            flights: flights[0].count,
            passengers: passengers[0].count,
            income: income[0].sum
        });
    } catch (e) { 
        res.status(500).send("Error de permisos: No puedes ver estadísticas globales."); 
    }
});

// ==========================================
//  MÓDULO DE REFERENCIAS (Lectura)
// ==========================================

app.get('/api/refs/airports', async (req, res) => {
    try { res.json(await db(req, res, 'SELECT * FROM bookings.airports_data LIMIT 100')); } catch (e) { res.status(500).send(e.message); }
});
app.get('/api/refs/aircrafts', async (req, res) => {
    try { res.json(await db(req, res, 'SELECT * FROM bookings.aircrafts_data')); } catch (e) { res.status(500).send(e.message); }
});
app.get('/api/refs/seats', async (req, res) => {
    try { res.json(await db(req, res, 'SELECT * FROM bookings.seats LIMIT 100')); } catch (e) { res.status(500).send(e.message); }
});
app.get('/api/refs/flights', async (req, res) => {
    try { res.json(await db(req, res, 'SELECT flight_id, flight_no, scheduled_departure, status FROM bookings.flights ORDER BY scheduled_departure DESC LIMIT 50')); } catch (e) { res.status(500).send(e.message); }
});

// ==========================================
//  MÓDULO DE OPERACIONES (CRUD)
// ==========================================

// --- 1. BOOKINGS (Reservas) ---
app.get('/api/bookings', async (req, res) => {
    try { res.json(await db(req, res, 'SELECT * FROM bookings.bookings ORDER BY book_date DESC LIMIT 50')); } catch (e) { res.status(500).send(e.message); }
});

// INSERT (Usa SP si existe, o INSERT directo)
app.post('/api/bookings', async (req, res) => {
    const { book_ref, total_amount } = req.body;
    try {
        // Intentamos usar el SP mencionado en el PDF si aplica, o insert directo para probar triggers
        // TRIGGER CHECK: total_amount positivo
        const q = `INSERT INTO bookings.bookings (book_ref, book_date, total_amount) VALUES ($1, NOW(), $2)`;
        await db(req, res, q, [book_ref, total_amount]);
        res.json({ success: true });
    } catch (e) { res.status(400).send(e.message); }
});

app.delete('/api/bookings/:ref', async (req, res) => {
    try {
        await db(req, res, 'DELETE FROM bookings.bookings WHERE book_ref = $1', [req.params.ref]);
        res.json({ success: true });
    } catch (e) { res.status(400).send(e.message); }
});

// --- 2. TICKETS ---
app.get('/api/tickets', async (req, res) => {
    try { res.json(await db(req, res, 'SELECT * FROM bookings.tickets ORDER BY ticket_no DESC LIMIT 50')); } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/tickets', async (req, res) => {
    const { ticket_no, book_ref, passenger_id, passenger_name, contact_data } = req.body;
    try {
        // TRIGGER CHECK: Mayúsculas en nombre
        const q = `INSERT INTO bookings.tickets (ticket_no, book_ref, passenger_id, passenger_name, contact_data) VALUES ($1, $2, $3, $4, $5)`;
        await db(req, res, q, [ticket_no, book_ref, passenger_id, passenger_name, contact_data]);
        res.json({ success: true });
    } catch (e) { res.status(400).send(e.message); }
});

// --- 3. BOARDING PASSES (Pases de Abordaje) ---
app.get('/api/boarding', async (req, res) => {
    try { res.json(await db(req, res, 'SELECT * FROM bookings.boarding_passes LIMIT 50')); } catch (e) { res.status(500).send(e.message); }
});

app.post('/api/boarding', async (req, res) => {
    const { ticket_no, flight_id, boarding_no, seat_no } = req.body;
    try {
        // TRIGGER CHECK: Valida si el asiento existe en el avión de ese vuelo
        const q = `INSERT INTO bookings.boarding_passes (ticket_no, flight_id, boarding_no, seat_no) VALUES ($1, $2, $3, $4)`;
        await db(req, res, q, [ticket_no, flight_id, boarding_no, seat_no]);
        res.json({ success: true });
    } catch (e) { res.status(400).send(e.message); }
});

// ==========================================
//  MÓDULO DE REPORTES (Vistas)
// ==========================================
app.get('/api/reports/:view', async (req, res) => {
    const views = {
        'itinerario': 'bookings.v_itinerario_publico',
        'abordaje': 'bookings.v_lista_abordaje',
        'gestion': 'bookings.v_gestion_vuelos',
        'flota': 'bookings.v_control_flota',
        'ingresos': 'bookings.v_analisis_ingresos'
    };
    const viewName = views[req.params.view];
    if (!viewName) return res.status(404).send("Vista no encontrada");

    try {
        res.json(await db(req, res, `SELECT * FROM ${viewName} LIMIT 100`));
    } catch (e) { res.status(500).send(e.message); }
});

app.listen(3001, () => console.log('Servidor Bookings corriendo en puerto 3001'));
