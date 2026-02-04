const express = require("express");
const cors = require("cors");
const { getPool } = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Ejecuta queries con el rol activo (viene del frontend por header x-role)
 */
const db = async (req, res, query, params = []) => {
  const role = req.headers["x-role"] || "rol_consulta";
  const pool = getPool(role);
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error("DB Error:", err.message);
    throw err;
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
  } else if (
    username === "usuario_operaciones" &&
    password === "operaciones123"
  ) {
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
app.get("/api/stats", async (req, res) => {
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
    res
      .status(500)
      .send("Error de permisos: No puedes ver estadísticas globales.");
  }
});

// ==========================================
//  REFERENCIAS (Lectura) - legacy / helpers
// ==========================================
app.get("/api/refs/airports", async (req, res) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.airports_data LIMIT 100"));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get("/api/refs/aircrafts", async (req, res) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.aircrafts_data"));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get("/api/refs/seats", async (req, res) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.seats LIMIT 100"));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get("/api/refs/flights", async (req, res) => {
  try {
    res.json(
      await db(
        req,
        res,
        "SELECT flight_id, flight_no, scheduled_departure, status FROM bookings.flights ORDER BY scheduled_departure DESC LIMIT 50"
      )
    );
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// ==========================================
// ✅ NUEVOS: GET / DELETE (para que tu UI no marque Cannot GET)
// ==========================================

// -------- FLIGHTS (GET + DELETE) --------
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

app.delete("/api/flights/:flight_id", async (req, res) => {
  const { flight_id } = req.params;
  try {
    await db(req, res, "DELETE FROM bookings.flights WHERE flight_id = $1", [
      flight_id,
    ]);
    res.json({ success: true });
  } catch (e) {
    // si falla, normalmente es FK: eso demuestra integridad referencial
    res.status(400).send(e.message);
  }
});

// -------- SEATS (GET + DELETE) --------
// PK compuesta: aircraft_code + seat_no
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

// -------- TICKET_FLIGHTS (GET + DELETE) --------
// PK compuesta: ticket_no + flight_id
app.get("/api/ticket_flights", async (req, res) => {
  try {
    res.json(
      await db(
        req,
        res,
        `SELECT ticket_no, flight_id, fare_conditions, amount
         FROM bookings.ticket_flights
         ORDER BY flight_id DESC
         LIMIT 200`
      )
    );
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.delete("/api/ticket_flights/:ticket_no/:flight_id", async (req, res) => {
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
    res.status(400).send(e.message);
  }
});

// ==========================================
// CATÁLOGOS (CRUD por procedimientos)
// ==========================================

// --------------------------
// AIRCRAFTS (aircrafts_data)
// --------------------------
app.get("/api/aircrafts", async (req, res) => {
  try {
    res.json(
      await db(req, res, "SELECT * FROM bookings.aircrafts_data ORDER BY aircraft_code")
    );
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get("/api/aircrafts/:code", async (req, res) => {
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
    res.status(500).send(e.message);
  }
});

// INSERT (CAST ::jsonb)
app.post("/api/aircrafts", async (req, res) => {
  const { aircraft_code, model, range } = req.body;
  try {
    const modelJson = normalizeJsonb(model);
    const sql = `CALL bookings.sp_aircrafts_insert($1, $2::jsonb, $3);`;
    await db(req, res, sql, [aircraft_code, JSON.stringify(modelJson), range]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// UPDATE RANGE
app.put("/api/aircrafts/:code/range", async (req, res) => {
  const { new_range } = req.body;
  try {
    await callProc(req, res, "bookings.sp_aircrafts_update_range", [
      req.params.code,
      new_range,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// DELETE
app.delete("/api/aircrafts/:code", async (req, res) => {
  try {
    await callProc(req, res, "bookings.sp_aircrafts_delete", [req.params.code]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ------------------------
// AIRPORTS (airports_data)
// ------------------------
app.get("/api/airports", async (req, res) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.airports_data ORDER BY airport_code"));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get("/api/airports/:code", async (req, res) => {
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
    res.status(500).send(e.message);
  }
});

// INSERT
app.post("/api/airports", async (req, res) => {
  const { airport_code, airport_name, city, coordinates, timezone } = req.body;

  try {
    const nameJson = normalizeJsonb(airport_name);
    const cityJson = normalizeJsonb(city);

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
    res.status(400).send(e.message);
  }
});

// UPDATE TIMEZONE
app.put("/api/airports/:code/timezone", async (req, res) => {
  const { timezone } = req.body;
  try {
    await callProc(req, res, "bookings.sp_airports_update_timezone", [
      req.params.code,
      timezone,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// DELETE
app.delete("/api/airports/:code", async (req, res) => {
  try {
    await callProc(req, res, "bookings.sp_airports_delete", [req.params.code]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ---------------------
// BOOKINGS (bookings)
// ---------------------
app.get("/api/bookings", async (req, res) => {
  try {
    res.json(
      await db(req, res, "SELECT * FROM bookings.bookings ORDER BY book_date DESC LIMIT 50")
    );
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get("/api/bookings/:ref", async (req, res) => {
  try {
    const rows = await db(req, res, "SELECT * FROM bookings.bookings WHERE book_ref = $1", [
      req.params.ref,
    ]);
    if (!rows[0]) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// INSERT
app.post("/api/bookings", async (req, res) => {
  const { book_ref, total_amount } = req.body;
  try {
    const book_date = new Date();
    await callProc(req, res, "bookings.sp_bookings_insert", [
      book_ref,
      book_date,
      total_amount,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ✅ PUT (solo una vez)
app.put("/api/bookings/:ref", async (req, res) => {
  const { total_amount } = req.body;
  try {
    await callProc(req, res, "bookings.sp_bookings_update_total", [
      req.params.ref,
      total_amount,
    ]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// DELETE
app.delete("/api/bookings/:ref", async (req, res) => {
  try {
    await callProc(req, res, "bookings.sp_bookings_delete", [req.params.ref]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ==========================================
// OPERACIONES (CRUD sin procedimientos)
// ==========================================

// --- TICKETS ---
app.get("/api/tickets", async (req, res) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.tickets ORDER BY ticket_no DESC LIMIT 50"));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get("/api/tickets/:ticket_no", async (req, res) => {
  try {
    const rows = await db(req, res, "SELECT * FROM bookings.tickets WHERE ticket_no = $1", [
      req.params.ticket_no,
    ]);
    if (!rows[0]) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post("/api/tickets", async (req, res) => {
  const { ticket_no, book_ref, passenger_id, passenger_name, contact_data } = req.body;
  try {
    const q = `
      INSERT INTO bookings.tickets (ticket_no, book_ref, passenger_id, passenger_name, contact_data)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await db(req, res, q, [ticket_no, book_ref, passenger_id, passenger_name, contact_data]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

app.put("/api/tickets/:ticket_no", async (req, res) => {
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
    res.status(400).send(e.message);
  }
});

app.delete("/api/tickets/:ticket_no", async (req, res) => {
  const { ticket_no } = req.params;
  try {
    await db(req, res, `DELETE FROM bookings.tickets WHERE ticket_no = $1`, [ticket_no]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// --- BOARDING PASSES ---
app.get("/api/boarding", async (req, res) => {
  try {
    res.json(await db(req, res, "SELECT * FROM bookings.boarding_passes LIMIT 50"));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get("/api/boarding/:ticket_no", async (req, res) => {
  try {
    const rows = await db(
      req,
      res,
      "SELECT * FROM bookings.boarding_passes WHERE ticket_no = $1",
      [req.params.ticket_no]
    );
    if (!rows[0]) return res.status(404).send("No encontrado");
    res.json(rows[0]);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post("/api/boarding", async (req, res) => {
  const { ticket_no, flight_id, boarding_no, seat_no } = req.body;
  try {
    const q = `
      INSERT INTO bookings.boarding_passes (ticket_no, flight_id, boarding_no, seat_no)
      VALUES ($1, $2, $3, $4)
    `;
    await db(req, res, q, [ticket_no, flight_id, boarding_no, seat_no]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

app.put("/api/boarding/:ticket_no", async (req, res) => {
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
    res.status(400).send(e.message);
  }
});

app.delete("/api/boarding/:ticket_no", async (req, res) => {
  const { ticket_no } = req.params;
  try {
    await db(req, res, `DELETE FROM bookings.boarding_passes WHERE ticket_no = $1`, [ticket_no]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

// ==========================================
// REPORTES (Vistas)
// ==========================================
app.get("/api/reports/:view", async (req, res) => {
  const views = {
    itinerario: "bookings.v_itinerario_publico",
    abordaje: "bookings.v_lista_abordaje",
    gestion: "bookings.v_gestion_vuelos",
    flota: "bookings.v_control_flota",
    ingresos: "bookings.v_analisis_ingresos",
  };

  const viewName = views[req.params.view];
  if (!viewName) return res.status(404).send("Vista no encontrada");

  try {
    res.json(await db(req, res, `SELECT * FROM ${viewName} LIMIT 100`));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.listen(3001, () => console.log("Servidor Bookings corriendo en puerto 3001"));
