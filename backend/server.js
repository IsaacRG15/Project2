// server.js (Backend completo con ORDER BY estables + errores PostgreSQL detallados)

const express = require("express");
const cors = require("cors");
const { getPool } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Helper: formatea error de PostgreSQL (pg) para que el frontend vea:
 * - code (23503 FK, 23514 CHECK, 23505 UNIQUE, etc.)
 * - constraint (nombre exacto de la restricción)
 * - detail / table / column / schema / where
 */
function formatPgError(err) {
  return {
    code: err.code || null,
    message: err.message || String(err),
    constraint: err.constraint || null,
    detail: err.detail || null,
    schema: err.schema || null,
    table: err.table || null,
    column: err.column || null,
    dataType: err.dataType || null,
    where: err.where || null,
    hint: err.hint || null,
  };
}

/**
 * Ejecuta queries con el rol activo (viene del frontend por header x-role)
 * IMPORTANTE: aquí NO convertimos el error en texto plano; lo lanzamos para el handler global.
 */
const db = async (req, res, query, params = []) => {
  const role = req.headers["x-role"] || "rol_consulta";
  const pool = getPool(role);
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error("DB Error:", err.message);
    throw err; // <-- clave: que suba al error handler para no perder metadata
  }
};

/**
 * Helper para CALL a procedimientos (PostgreSQL)
 */
const callProc = async (req, res, procName, params = []) => {
  const placeholders = params.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `CALL ${procName}(${placeholders});`;
  await db(req, res, sql, params);
};

/**
 * Normaliza input JSONB
 */
const normalizeJsonb = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return { es: value };
  if (typeof value === "object") return value;
  return { es: String(value) };
};

/**
 * Convierte strings vacíos a null (útil para timestamps opcionales)
 */
const emptyToNull = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

/**
 * Intenta convertir ISO string a Date (si viene null, regresa null)
 * Si viene algo inválido, lanzamos error 400 manual (para que sea claro)
 */
const parseIsoToDateOrNull = (v, fieldName = "fecha") => {
  const x = emptyToNull(v);
  if (x === null) return null;
  const d = new Date(x);
  if (isNaN(d.getTime())) {
    const err = new Error(`Formato inválido para ${fieldName}. Usa ISO: 2026-02-04T12:30:00Z`);
    err.code = "22P02"; // data exception-ish
    throw err;
  }
  return d;
};

// ==========================================
// AUTH
// ==========================================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  let role = null;
  let name = "";

  if (username === "usuario_admin" && password === "admin123") {
    role = "rol_administracion";
    name = "Administrador Total";
  } else if (username === "usuario_operaciones" && password === "operaciones123") {
    role = "rol_operaciones";
    name = "Operador de Vuelo";
  } else if (username === "usuario_consulta" && password === "consulta123") {
    role = "rol_consulta";
    name = "Visitante";
  }

  if (role) {
    res.json({ success: true, user: { username, role, name } });
  } else {
    console.log(`Intento fallido: ${username} / ${password}`);
    res.status(401).json({ success: false, error: "Credenciales inválidas" });
  }
});

// ==========================================
// DASHBOARD STATS
// ==========================================
app.get("/api/stats", async (req, res, next) => {
  try {
    const bookings = await db(req, res, "SELECT count(*) FROM bookings.bookings");
    const flights = await db(req, res, "SELECT count(*) FROM bookings.flights");
    const passengers = await db(req, res, "SELECT count(*) FROM bookings.tickets");
    const income = await db(req, res, "SELECT sum(total_amount) FROM bookings.bookings");

    res.json({
      bookings: bookings[0].count,
      flights: flights[0].count,
      passengers: passengers[0].count,
      income: income[0].sum,
    });
  } catch (e) {
    next(e);
  }
});

// ==========================================
//  REFERENCIAS (Lectura) - legacy / helpers
// ==========================================
app.get("/api/refs/airports", async (req, res, next) => {
  try {
    res.json(
      await db(req, res, "SELECT * FROM bookings.airports_data ORDER BY airport_code LIMIT 100")
    );
  } catch (e) {
    next(e);
  }
});

app.get("/api/refs/aircrafts", async (req, res, next) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.aircrafts_data ORDER BY aircraft_code"));
  } catch (e) {
    next(e);
  }
});

app.get("/api/refs/seats", async (req, res, next) => {
  try {
    res.json(
      await db(
        req,
        res,
        "SELECT * FROM bookings.seats ORDER BY aircraft_code, seat_no LIMIT 100"
      )
    );
  } catch (e) {
    next(e);
  }
});

app.get("/api/refs/flights", async (req, res, next) => {
  try {
    res.json(
      await db(
        req,
        res,
        `SELECT flight_id, flight_no, scheduled_departure, status
         FROM bookings.flights
         ORDER BY scheduled_departure DESC, flight_id DESC
         LIMIT 50`
      )
    );
  } catch (e) {
    next(e);
  }
});

// ==========================================
// ✅ FLIGHTS (GET + PUT + DELETE)
// ==========================================
// -------- FLIGHTS (CRUD COMPLETO: GET + POST + PUT + DELETE) --------
app.get("/api/flights", async (req, res) => {
  try {
    res.json(
      await db(
        req,
        res,
        `SELECT
          flight_id,
          flight_no,
          scheduled_departure,
          scheduled_arrival,
          status,
          departure_airport,
          arrival_airport,
          aircraft_code,
          actual_departure,
          actual_arrival
        FROM bookings.flights
        ORDER BY scheduled_departure DESC
        LIMIT 200`
      )
    );
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// CREAR VUELO
app.post("/api/flights", async (req, res) => {
  const { 
    flight_no, scheduled_departure, scheduled_arrival, 
    departure_airport, arrival_airport, status, aircraft_code 
  } = req.body;

  try {
    const q = `
      INSERT INTO bookings.flights 
      (flight_no, scheduled_departure, scheduled_arrival, departure_airport, arrival_airport, status, aircraft_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await db(req, res, q, [
      flight_no, scheduled_departure, scheduled_arrival, 
      departure_airport, arrival_airport, status, aircraft_code
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// EDITAR VUELO
app.put("/api/flights/:flight_id", async (req, res) => {
  const { flight_id } = req.params;
  const { 
    flight_no, scheduled_departure, scheduled_arrival, 
    departure_airport, arrival_airport, status, aircraft_code 
  } = req.body;

  try {
    const q = `
      UPDATE bookings.flights
      SET flight_no = $1,
          scheduled_departure = $2,
          scheduled_arrival = $3,
          departure_airport = $4,
          arrival_airport = $5,
          status = $6,
          aircraft_code = $7
      WHERE flight_id = $8
    `;
    await db(req, res, q, [
      flight_no, scheduled_departure, scheduled_arrival, 
      departure_airport, arrival_airport, status, aircraft_code, flight_id
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ELIMINAR VUELO
app.delete("/api/flights/:flight_id", async (req, res) => {
  const { flight_id } = req.params;
  try {
    await db(req, res, "DELETE FROM bookings.flights WHERE flight_id = $1", [
      flight_id,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ==========================================
// ✅ SEATS (GET + PUT + DELETE)  PK compuesta
// ==========================================
// -------- SEATS (CRUD: GET + POST + DELETE) --------
// Nota: Seats tiene llave compuesta (aircraft_code + seat_no), usualmente se borra y crea de nuevo en vez de editar.

app.get("/api/seats", async (req, res) => {
  try {
    res.json(
      await db(
        req,
        res,
        `SELECT aircraft_code, seat_no, fare_conditions
         FROM bookings.seats
         ORDER BY aircraft_code, seat_no
         LIMIT 500`
      )
    );
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// CREAR ASIENTO
app.post("/api/seats", async (req, res) => {
  const { aircraft_code, seat_no, fare_conditions } = req.body;
  try {
    const q = `
      INSERT INTO bookings.seats (aircraft_code, seat_no, fare_conditions)
      VALUES ($1, $2, $3)
    `;
    await db(req, res, q, [aircraft_code, seat_no, fare_conditions]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ELIMINAR ASIENTO (PK COMPUESTA)
app.delete("/api/seats/:aircraft_code/:seat_no", async (req, res) => {
  const { aircraft_code, seat_no } = req.params;
  try {
    await db(
      req,
      res,
      `DELETE FROM bookings.seats WHERE aircraft_code = $1 AND seat_no = $2`,
      [aircraft_code, seat_no]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ==========================================
// ✅ TICKET_FLIGHTS (GET + DELETE) PK compuesta
// ==========================================
app.get("/api/ticket_flights", async (req, res, next) => {
  try {
    res.json(
      await db(
        req,
        res,
        `SELECT ticket_no, flight_id, fare_conditions, amount
         FROM bookings.ticket_flights
         ORDER BY flight_id DESC, ticket_no DESC
         LIMIT 200`
      )
    );
  } catch (e) {
    next(e);
  }
});

app.delete("/api/ticket_flights/:ticket_no/:flight_id", async (req, res, next) => {
  const { ticket_no, flight_id } = req.params;
  try {
    await db(
      req,
      res,
      `DELETE FROM bookings.ticket_flights WHERE ticket_no = $1 AND flight_id = $2`,
      [ticket_no, flight_id]
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// ==========================================
// CATÁLOGOS (CRUD por procedimientos)
// ==========================================

// --------------------------
// AIRCRAFTS (aircrafts_data)
// --------------------------
app.get("/api/aircrafts", async (req, res, next) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.aircrafts_data ORDER BY aircraft_code"));
  } catch (e) {
    next(e);
  }
});

app.get("/api/aircrafts/:code", async (req, res, next) => {
  try {
    const rows = await db(
      req,
      res,
      "SELECT * FROM bookings.aircrafts_data WHERE aircraft_code = $1",
      [req.params.code]
    );
    if (!rows[0]) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// INSERT (CAST ::jsonb)
app.post("/api/aircrafts", async (req, res, next) => {
  const { aircraft_code, model, range } = req.body;
  try {
    const modelJson = normalizeJsonb(model);
    const sql = `CALL bookings.sp_aircrafts_insert($1, $2::jsonb, $3);`;
    await db(req, res, sql, [aircraft_code, JSON.stringify(modelJson), range]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// UPDATE RANGE
app.put("/api/aircrafts/:code/range", async (req, res, next) => {
  const { new_range } = req.body;
  try {
    await callProc(req, res, "bookings.sp_aircrafts_update_range", [req.params.code, new_range]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// DELETE
app.delete("/api/aircrafts/:code", async (req, res, next) => {
  try {
    await callProc(req, res, "bookings.sp_aircrafts_delete", [req.params.code]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// ------------------------
// AIRPORTS (airports_data)
// ------------------------
app.get("/api/airports", async (req, res, next) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.airports_data ORDER BY airport_code"));
  } catch (e) {
    next(e);
  }
});

app.get("/api/airports/:code", async (req, res, next) => {
  try {
    const rows = await db(
      req,
      res,
      "SELECT * FROM bookings.airports_data WHERE airport_code = $1",
      [req.params.code]
    );
    if (!rows[0]) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// INSERT
app.post("/api/airports", async (req, res, next) => {
  const { airport_code, airport_name, city, coordinates, timezone } = req.body;

  try {
    const nameJson = normalizeJsonb(airport_name);
    const cityJson = normalizeJsonb(city);

    // soporta coordinates como {x,y} (tu frontend manda object)
    const x = coordinates?.x;
    const y = coordinates?.y;

    const sql = `CALL bookings.sp_airports_insert($1, $2::jsonb, $3::jsonb, point($4,$5), $6);`;
    await db(req, res, sql, [
      airport_code,
      JSON.stringify(nameJson),
      JSON.stringify(cityJson),
      x,
      y,
      timezone,
    ]);

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// UPDATE TIMEZONE
app.put("/api/airports/:code/timezone", async (req, res, next) => {
  const { timezone } = req.body;
  try {
    await callProc(req, res, "bookings.sp_airports_update_timezone", [req.params.code, timezone]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// DELETE
app.delete("/api/airports/:code", async (req, res, next) => {
  try {
    await callProc(req, res, "bookings.sp_airports_delete", [req.params.code]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// ---------------------
// BOOKINGS (bookings)
// ---------------------
app.get("/api/bookings", async (req, res, next) => {
  try {
    res.json(
      await db(
        req,
        res,
        "SELECT * FROM bookings.bookings ORDER BY book_date DESC, book_ref DESC LIMIT 50"
      )
    );
  } catch (e) {
    next(e);
  }
});

app.get("/api/bookings/:ref", async (req, res, next) => {
  try {
    const rows = await db(req, res, "SELECT * FROM bookings.bookings WHERE book_ref = $1", [
      req.params.ref,
    ]);
    if (!rows[0]) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// INSERT
app.post("/api/bookings", async (req, res, next) => {
  const { book_ref, total_amount } = req.body;
  try {
    const book_date = new Date();
    await callProc(req, res, "bookings.sp_bookings_insert", [book_ref, book_date, total_amount]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// UPDATE
app.put("/api/bookings/:ref", async (req, res, next) => {
  const { total_amount } = req.body;
  try {
    await callProc(req, res, "bookings.sp_bookings_update_total", [req.params.ref, total_amount]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// DELETE
app.delete("/api/bookings/:ref", async (req, res, next) => {
  try {
    await callProc(req, res, "bookings.sp_bookings_delete", [req.params.ref]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// ==========================================
// OPERACIONES (CRUD sin procedimientos)
// ==========================================

// --- TICKETS ---
app.get("/api/tickets", async (req, res, next) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.tickets ORDER BY ticket_no DESC LIMIT 50"));
  } catch (e) {
    next(e);
  }
});

app.get("/api/tickets/:ticket_no", async (req, res, next) => {
  try {
    const rows = await db(req, res, "SELECT * FROM bookings.tickets WHERE ticket_no = $1", [
      req.params.ticket_no,
    ]);
    if (!rows[0]) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

app.post("/api/tickets", async (req, res, next) => {
  const { ticket_no, book_ref, passenger_id, passenger_name, contact_data } = req.body;
  try {
    const q = `
      INSERT INTO bookings.tickets (ticket_no, book_ref, passenger_id, passenger_name, contact_data)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await db(req, res, q, [ticket_no, book_ref, passenger_id, passenger_name, contact_data]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.put("/api/tickets/:ticket_no", async (req, res, next) => {
  const { ticket_no } = req.params;
  const { book_ref, passenger_id, passenger_name, contact_data } = req.body;

  try {
    const q = `
      UPDATE bookings.tickets
      SET book_ref = $1,
          passenger_id = $2,
          passenger_name = $3,
          contact_data = $4
      WHERE ticket_no = $5
    `;
    await db(req, res, q, [book_ref, passenger_id, passenger_name, contact_data, ticket_no]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/tickets/:ticket_no", async (req, res, next) => {
  const { ticket_no } = req.params;
  try {
    await db(req, res, `DELETE FROM bookings.tickets WHERE ticket_no = $1`, [ticket_no]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// --- BOARDING PASSES ---
app.get("/api/boarding", async (req, res, next) => {
  try {
    res.json(
      await db(
        req,
        res,
        "SELECT * FROM bookings.boarding_passes ORDER BY flight_id DESC, boarding_no ASC LIMIT 50"
      )
    );
  } catch (e) {
    next(e);
  }
});

app.get("/api/boarding/:ticket_no", async (req, res, next) => {
  try {
    const rows = await db(req, res, "SELECT * FROM bookings.boarding_passes WHERE ticket_no = $1", [
      req.params.ticket_no,
    ]);
    if (!rows[0]) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

app.post("/api/boarding", async (req, res, next) => {
  const { ticket_no, flight_id, boarding_no, seat_no } = req.body;
  try {
    const q = `
      INSERT INTO bookings.boarding_passes (ticket_no, flight_id, boarding_no, seat_no)
      VALUES ($1, $2, $3, $4)
    `;
    await db(req, res, q, [ticket_no, flight_id, boarding_no, seat_no]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.put("/api/boarding/:ticket_no", async (req, res, next) => {
  const { ticket_no } = req.params;
  const { flight_id, boarding_no, seat_no } = req.body;

  try {
    const q = `
      UPDATE bookings.boarding_passes
      SET flight_id = $1,
          boarding_no = $2,
          seat_no = $3
      WHERE ticket_no = $4
    `;
    await db(req, res, q, [flight_id, boarding_no, seat_no, ticket_no]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

app.delete("/api/boarding/:ticket_no", async (req, res, next) => {
  const { ticket_no } = req.params;
  try {
    await db(req, res, `DELETE FROM bookings.boarding_passes WHERE ticket_no = $1`, [ticket_no]);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// ==========================================
// REPORTES (Vistas) + ORDER BY recomendado
// ==========================================
app.get("/api/reports/:view", async (req, res, next) => {
  const views = {
    itinerario: "bookings.v_itinerario_publico",
    abordaje: "bookings.v_lista_abordaje",
    gestion: "bookings.v_gestion_vuelos",
    flota: "bookings.v_control_flota",
    ingresos: "bookings.v_analisis_ingresos",
  };

  const key = req.params.view;
  const viewName = views[key];
  if (!viewName) return res.status(404).send("Vista no encontrada");

  const orderBy =
    {
      itinerario: "ORDER BY scheduled_departure DESC, flight_id DESC",
      abordaje: "ORDER BY flight_no ASC, boarding_no ASC",
      gestion: "ORDER BY scheduled_departure DESC, flight_id DESC",
      flota: "ORDER BY aircraft_code ASC",
      ingresos: "ORDER BY fecha_compra DESC",
    }[key] || "";

  try {
    res.json(await db(req, res, `SELECT * FROM ${viewName} ${orderBy} LIMIT 100`));
  } catch (e) {
    next(e);
  }
});

// ==========================================
// ✅ ERROR HANDLER GLOBAL (lo más importante)
// - Devuelve MENSAJE + metadata de Postgres
// - Así tu frontend puede mostrar: code, constraint, detail, etc.
// ==========================================
app.use((err, req, res, next) => {
  const pg = formatPgError(err);

  // Heurística para status:
  // 23xxx = integrity constraint violation (FK/UNIQUE/CHECK/NOT NULL)
  // 22xxx = data exception (tipo inválido, etc.)
  const code = pg.code || "";
  let status = 500;

  if (code.startsWith("23") || code.startsWith("22")) status = 400;
  if (code === "42501") status = 403; // insufficient_privilege

  res.status(status).json({
    success: false,
    error: pg.message,
    db: pg,
  });
});

app.listen(3001, () => console.log("Servidor Bookings corriendo en puerto 3001"));
