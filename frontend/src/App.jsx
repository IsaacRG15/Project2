import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plane,
  User,
  CreditCard,
  FileText,
  AlertTriangle,
  LogOut,
  Shield,
  Database,
  Plus,
  Trash2,
  X,
  Users,
  Activity,
  Map,
  Save,
  Pencil,
  MapPin,
  Armchair,
} from "lucide-react";

// --- CONFIGURACIÓN API ---
const API_URL = "http://localhost:3001/api";

/** =========================
 *  DICCIONARIOS ES -> Labels
 *  ========================= */
const VIEW_TITLES_ES = {
  dashboard: "Panel",

  // Catálogos
  airports: "Aeropuertos",
  aircrafts: "Aeronaves",
  flights: "Vuelos",
  seats: "Asientos",

  // Operaciones
  bookings: "Reservas",
  tickets: "Boletos",
  boarding: "Pases de abordar",

  // Reportes
  rep_itinerario: "Reporte: Itinerario público",
  rep_abordaje: "Reporte: Lista de abordaje",
  rep_gestion: "Reporte: Gestión operativa de vuelos",
  rep_flota: "Reporte: Control de flota",
  rep_ingresos: "Reporte: Análisis de ingresos",
};

const COL_ES = {
  // airports
  airport_code: "Código aeropuerto",
  airport_name: "Nombre aeropuerto",
  city: "Ciudad",
  coordinates: "Coordenadas",
  timezone: "Zona horaria",

  // aircrafts
  aircraft_code: "Código aeronave",
  model: "Modelo",
  range: "Alcance",

  // flights
  flight_id: "ID vuelo",
  flight_no: "No. vuelo",
  scheduled_departure: "Salida programada",
  scheduled_arrival: "Llegada programada",
  actual_departure: "Salida real",
  actual_arrival: "Llegada real",
  departure_airport: "Aeropuerto salida",
  arrival_airport: "Aeropuerto llegada",
  status: "Estatus",

  // seats
  seat_no: "Asiento",
  fare_conditions: "Clase",

  // bookings
  book_ref: "Referencia",
  book_date: "Fecha de reserva",
  total_amount: "Importe total",

  // tickets
  ticket_no: "No. de boleto",
  passenger_id: "ID pasajero",
  passenger_name: "Nombre del pasajero",
  contact_data: "Contacto",

  // boarding_passes
  boarding_no: "No. de abordaje",

  // Extras reportes
  departure_city: "Ciudad salida",
  departure_airport_name: "Aeropuerto salida (nombre)",
  arrival_city: "Ciudad llegada",
  arrival_airport_name: "Aeropuerto llegada (nombre)",
  aircraft_model: "Modelo aeronave",
  total_seats: "Total de asientos",
  fecha_compra: "Fecha compra",
  total_reservas: "Total reservas",
  ingresos_totales: "Ingresos totales",
};

function colLabel(key) {
  if (COL_ES[key]) return COL_ES[key];
  return String(key).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Render “bonito” para JSON/objects y textos largos */
function smartCell(value, { clamp = 2 } = {}) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const txt = JSON.stringify(value);
    return (
      <span className={`block text-xs font-mono text-slate-700 break-words line-clamp-${clamp}`}>
        {txt}
      </span>
    );
  }
  if (typeof value === "string" && value.includes("T") && value.includes("Z")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  return String(value);
}

/** Auto-hide mensajes */
function useAutoHide(value, setValue, ms = 2500) {
  const t = useRef(null);
  useEffect(() => {
    if (!value) return;
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setValue(null), ms);
    return () => t.current && clearTimeout(t.current);
  }, [value, setValue, ms]);
}

/**
 * ✅ Lee respuesta de error del backend:
 * - Si es JSON: { success:false, error:"...", db:{code,constraint,detail,...} }
 * - Si es texto: lo devuelve tal cual
 */
async function readApiError(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    const j = await res.json().catch(() => null);
    if (!j) return `Error HTTP ${res.status}`;
    return formatDbError(j);
  }
  const t = await res.text().catch(() => "");
  return t || `Error HTTP ${res.status}`;
}

/**
 * ✅ Formatea bonito el error de BD (constraint, code, detail)
 * Muestra primero el nombre de la restricción cuando existe.
 */
function formatDbError(payload) {
  // payload puede venir como {error, db:{...}} del backend
  const base = payload?.error || payload?.message || "Error en la operación";
  const db = payload?.db || payload; // por si algún día mandas directo db

  const parts = [];

  // Primera línea "bonita"
  if (db?.constraint) parts.push(`${db.constraint}`);
  else if (db?.code) parts.push(`Código SQL: ${db.code}`);

  // Mensaje principal
  parts.push(base);

  // Detalles opcionales (muy útiles en FK/UNIQUE)
  if (db?.detail) parts.push(`Detalle: ${db.detail}`);
  if (db?.table) parts.push(`Tabla: ${db.table}`);
  if (db?.column) parts.push(`Columna: ${db.column}`);

  return parts.filter(Boolean).join("\n");
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useAutoHide(success, setSuccess, 2300);
  useAutoHide(error, setError, 4500);

  if (!user) return <Login onLogin={setUser} onError={setError} error={error} />;

  const viewTitle = VIEW_TITLES_ES[view] || "Sistema";

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-700 overflow-hidden">
      <style>{`
        .nice-scroll::-webkit-scrollbar{ width: 10px; height: 10px; }
        .nice-scroll::-webkit-scrollbar-track{ background: transparent; }
        .nice-scroll::-webkit-scrollbar-thumb{ background: #cbd5e1; border-radius: 999px; border: 2px solid #f1f5f9; }
        .nice-scroll::-webkit-scrollbar-thumb:hover{ background: #94a3b8; }
        .line-clamp-2{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .line-clamp-3{ display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
        /* Animación suave */
        .animate-fade-in{ animation: fadeIn .25s ease-out; }
        @keyframes fadeIn { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)} }
      `}</style>

      {/* TOP NAV */}
      <header className="h-20 border-b border-slate-200 flex items-center gap-6 px-6 bg-white/90 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4 min-w-max">
          <div className="leading-tight">
            <h1 className="font-extrabold text-slate-900 text-base tracking-wider">
              AERO<span className="text-sky-600">SYS</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
              Control de vuelos v2
            </p>
          </div>
        </div>

        <div className="hidden xl:block min-w-max">
          <h2 className="text-lg font-black text-slate-900 tracking-wide flex items-center gap-2">
            <span className="w-1 h-5 bg-sky-500 rounded-full mr-2"></span>
            {viewTitle}
          </h2>
          <p className="text-xs text-slate-500 ml-5 font-mono">CONEXIÓN SEGURA ESTABLECIDA</p>
        </div>

        <nav className="flex-1 overflow-x-auto nice-scroll pr-2">
          <div className="flex items-center gap-3 min-w-max">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mr-1">
              Principal
            </span>
            <TopNavBtn icon={<Activity size={16} />} label="Panel" active={view === "dashboard"} onClick={() => setView("dashboard")} />

            <div className="h-6 w-px bg-slate-200 mx-2" />

            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mr-1">
              Catálogos
            </span>
            <TopNavBtn icon={<MapPin size={16} />} label="Aeropuertos" active={view === "airports"} onClick={() => setView("airports")} />
            <TopNavBtn icon={<Plane size={16} className="-rotate-45" />} label="Aeronaves" active={view === "aircrafts"} onClick={() => setView("aircrafts")} />
            <TopNavBtn icon={<Plane size={16} />} label="Vuelos" active={view === "flights"} onClick={() => setView("flights")} />
            <TopNavBtn icon={<Armchair size={16} />} label="Asientos" active={view === "seats"} onClick={() => setView("seats")} />

            <div className="h-6 w-px bg-slate-200 mx-2" />

            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mr-1">
              Operaciones
            </span>
            <TopNavBtn icon={<CreditCard size={16} />} label="Reservas" active={view === "bookings"} onClick={() => setView("bookings")} />
            <TopNavBtn icon={<User size={16} />} label="Boletos" active={view === "tickets"} onClick={() => setView("tickets")} />
            <TopNavBtn icon={<FileText size={16} />} label="Pases" active={view === "boarding"} onClick={() => setView("boarding")} />

            <div className="h-6 w-px bg-slate-200 mx-2" />

            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mr-1">
              Reportes
            </span>
            <TopNavBtn icon={<Map size={16} />} label="Itinerario" active={view === "rep_itinerario"} onClick={() => setView("rep_itinerario")} />
            <TopNavBtn icon={<Users size={16} />} label="Abordaje" active={view === "rep_abordaje"} onClick={() => setView("rep_abordaje")} />
            <TopNavBtn icon={<Plane size={16} />} label="Gestión vuelos" active={view === "rep_gestion"} onClick={() => setView("rep_gestion")} />
            <TopNavBtn icon={<Plane size={16} className="-rotate-45" />} label="Control flota" active={view === "rep_flota"} onClick={() => setView("rep_flota")} />
            <TopNavBtn icon={<Activity size={16} />} label="Ingresos" active={view === "rep_ingresos"} onClick={() => setView("rep_ingresos")} />
          </div>
        </nav>

        <div className="flex items-center gap-3 min-w-max">
          <div className="hidden lg:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
            <div
              className={`w-3 h-3 rounded-full shadow-[0_0_10px]
              ${
                user.role && user.role.includes("admin")
                  ? "bg-red-500 shadow-red-500/30"
                  : "bg-emerald-500 shadow-emerald-500/30"
              }`}
            />
            <div className="leading-tight max-w-[180px]">
              <p className="text-sm font-black text-slate-900 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-wider">
                {user.role?.replace("rol_", "")}
              </p>
            </div>
          </div>

          <button
            onClick={() => setUser(null)}
            className="flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-red-50 px-4 py-2 rounded-xl transition-all text-xs font-extrabold border border-slate-200 hover:border-red-200 group"
          >
            <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" /> SALIR
          </button>
        </div>

        {/* Notifications */}
        <div className="fixed top-6 right-6 w-96 z-50 space-y-3 pointer-events-none">
          {error && (
            <div className="pointer-events-auto bg-white border-l-4 border-red-500 p-4 shadow-2xl rounded-r-lg flex items-start gap-3 backdrop-blur-md animate-fade-in ring-1 ring-red-200">
              <AlertTriangle className="text-red-500 shrink-0 mt-1" />
              <div className="flex-1">
                <h4 className="font-extrabold text-red-700 text-sm tracking-wide">
                  ERROR DEL SISTEMA
                </h4>
                <pre className="text-xs text-red-700/80 mt-1 font-mono whitespace-pre-wrap break-words">
                  {String(error)}
                </pre>
              </div>
              <button onClick={() => setError(null)}>
                <X size={16} className="text-red-400 hover:text-red-700" />
              </button>
            </div>
          )}

          {success && (
            <div className="pointer-events-auto bg-white border-l-4 border-emerald-500 p-4 shadow-2xl rounded-r-lg flex items-center gap-3 backdrop-blur-md animate-fade-in ring-1 ring-emerald-200">
              <Shield className="text-emerald-600" />
              <p className="text-sm font-extrabold text-emerald-700 tracking-wide">
                {success}
              </p>
              <button className="ml-auto" onClick={() => setSuccess(null)}>
                <X size={16} className="text-emerald-300 hover:text-emerald-700" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8 pr-10 nice-scroll relative scroll-smooth">
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-14">
          {view === "dashboard" && <Dashboard user={user} onError={setError} />}

          {/* ================== CATÁLOGOS ================== */}
          {view === "airports" && (
            <CrudTable
              title="Catálogo de Aeropuertos"
              endpoint="airports"
              user={user}
              onError={setError}
              onSuccess={setSuccess}
              columns={["airport_code", "airport_name", "city", "coordinates", "timezone"]}
              pk="airport_code"
              formFields={[
                { name: "airport_code", label: "Código aeropuerto (3 letras)", placeholder: "MEX" },

                // Backend: solo actualiza timezone, por eso se bloquean al editar
                { name: "airport_name", label: "Nombre aeropuerto (texto o JSON)", placeholder: 'Ej. "AICM" o {"es":"AICM"}', disableOnEdit: true },
                { name: "city", label: "Ciudad (texto o JSON)", placeholder: 'Ej. "CDMX" o {"es":"CDMX"}', disableOnEdit: true },
                { name: "coordinates", label: "Coordenadas (JSON)", placeholder: '{"x":-99.072,"y":19.436}', disableOnEdit: true },

                { name: "timezone", label: "Zona horaria", placeholder: "America/Mexico_City" },
              ]}
              tableLayout="wide"
              jsonFields={["airport_name", "city", "coordinates"]}
              buildPutUrl={(id) => `${API_URL}/airports/${encodeURIComponent(id)}/timezone`}
              mapPutBody={(form) => ({ timezone: form.timezone })}
              mapPostBody={(form) => ({
                airport_code: form.airport_code,
                airport_name: parseMaybeJson(form.airport_name) ?? form.airport_name,
                city: parseMaybeJson(form.city) ?? form.city,
                coordinates: parseMaybeJson(form.coordinates),
                timezone: form.timezone,
              })}
              buildDeleteUrl={(id) => `${API_URL}/airports/${encodeURIComponent(id)}`}
            />
          )}

          {view === "aircrafts" && (
            <CrudTable
              title="Catálogo de Aeronaves"
              endpoint="aircrafts"
              user={user}
              onError={setError}
              onSuccess={setSuccess}
              columns={["aircraft_code", "model", "range"]}
              pk="aircraft_code"
              formFields={[
                { name: "aircraft_code", label: "Código aeronave (3)", placeholder: "320" },
                { name: "model", label: "Modelo (texto o JSON)", placeholder: 'Ej. "Airbus A320" o {"es":"A320"}' },
                { name: "range", label: "Alcance (km)", type: "number", placeholder: "6100" },
              ]}
              jsonFields={["model"]}
              buildPutUrl={(id) => `${API_URL}/aircrafts/${encodeURIComponent(id)}/range`}
              mapPutBody={(form) => ({ new_range: Number(form.range) })}
              mapPostBody={(form) => ({
                aircraft_code: form.aircraft_code,
                model: parseMaybeJson(form.model) ?? form.model,
                range: Number(form.range),
              })}
              buildDeleteUrl={(id) => `${API_URL}/aircrafts/${encodeURIComponent(id)}`}
            />
          )}

          {/* ✅ VUELOS: edición (requiere PUT en backend) */}
          {view === "flights" && (
            <CrudTable
              title="Vuelos (Editar + Borrar)"
              endpoint="flights"
              user={user}
              onError={setError}
              onSuccess={setSuccess}
              columns={[
                "flight_id",
                "flight_no",
                "scheduled_departure",
                "scheduled_arrival",
                "status",
                "actual_departure",
                "actual_arrival",
                "departure_airport",
                "arrival_airport",
                "aircraft_code",
              ]}
              pk="flight_id"
              formFields={[
                { name: "flight_id", label: "ID vuelo", placeholder: "12345" },
                { name: "status", label: "Estatus", placeholder: "Scheduled / On Time / Delayed / Departed / Arrived / Cancelled" },
                { name: "actual_departure", label: "Salida real (ISO o vacío)", placeholder: "2026-02-04T12:30:00Z" },
                { name: "actual_arrival", label: "Llegada real (ISO o vacío)", placeholder: "2026-02-04T14:10:00Z" },
              ]}
              disableCreate
              buildPutUrl={(id) => `${API_URL}/flights/${encodeURIComponent(id)}`}
              mapPutBody={(form) => ({
                status: form.status,
                actual_departure: emptyToNull(form.actual_departure),
                actual_arrival: emptyToNull(form.actual_arrival),
              })}
              buildDeleteUrl={(id) => `${API_URL}/flights/${encodeURIComponent(id)}`}
              tableLayout="wide"
            />
          )}

          {/* ✅ ASIENTOS: edición (requiere PUT en backend) */}
          {view === "seats" && (
            <CrudTable
              title="Asientos (Editar + Borrar)"
              endpoint="seats"
              user={user}
              onError={setError}
              onSuccess={setSuccess}
              columns={["aircraft_code", "seat_no", "fare_conditions"]}
              pkComposite={(row) => `${row.aircraft_code}__${row.seat_no}`}
              formFields={[
                { name: "aircraft_code", label: "Código aeronave", placeholder: "320" },
                { name: "seat_no", label: "Asiento", placeholder: "12A" },
                { name: "fare_conditions", label: "Clase", placeholder: "Economy / Comfort / Business" },
              ]}
              disableCreate
              buildPutUrl={(id) => {
                const [aircraft_code, seat_no] = String(id).split("__");
                return `${API_URL}/seats/${encodeURIComponent(aircraft_code)}/${encodeURIComponent(seat_no)}`;
              }}
              mapPutBody={(form) => ({ fare_conditions: form.fare_conditions })}
              buildDeleteUrlFromRow={(row) =>
                `${API_URL}/seats/${encodeURIComponent(row.aircraft_code)}/${encodeURIComponent(row.seat_no)}`
              }
              tableLayout="wide"
            />
          )}

          {/* ================== OPERACIONES ================== */}
          {view === "bookings" && (
            <CrudTable
              title="Gestión de Reservas"
              endpoint="bookings"
              user={user}
              onError={setError}
              onSuccess={setSuccess}
              columns={["book_ref", "book_date", "total_amount"]}
              pk="book_ref"
              formFields={[
                { name: "book_ref", label: "Referencia (6 caracteres)", placeholder: "XXXXXX" },
                { name: "total_amount", label: "Importe total", type: "number", placeholder: "Ej. 1500" },
              ]}
              buildPutUrl={(id) => `${API_URL}/bookings/${encodeURIComponent(id)}`}
              mapPutBody={(form) => ({ total_amount: Number(form.total_amount) })}
              mapPostBody={(form) => ({
                book_ref: form.book_ref,
                total_amount: Number(form.total_amount),
              })}
              buildDeleteUrl={(id) => `${API_URL}/bookings/${encodeURIComponent(id)}`}
            />
          )}

          {view === "tickets" && (
            <CrudTable
              title="Gestión de Boletos"
              endpoint="tickets"
              user={user}
              onError={setError}
              onSuccess={setSuccess}
              columns={["ticket_no", "book_ref", "passenger_name", "passenger_id", "contact_data"]}
              pk="ticket_no"
              formFields={[
                { name: "ticket_no", label: "No. de boleto (13 dígitos)", placeholder: "0005432000000" },
                { name: "book_ref", label: "Referencia de reserva" },
                { name: "passenger_id", label: "ID pasajero", placeholder: "1234 567890" },
                { name: "passenger_name", label: "Nombre completo", placeholder: "Juan Pérez" },
                { name: "contact_data", label: "Contacto (JSON)", placeholder: '{"email":"test@test.com"}' },
              ]}
              jsonFields={["contact_data"]}
              buildPutUrl={(id) => `${API_URL}/tickets/${encodeURIComponent(id)}`}
              buildDeleteUrl={(id) => `${API_URL}/tickets/${encodeURIComponent(id)}`}
              mapPutBody={(form) => ({
                book_ref: form.book_ref,
                passenger_id: form.passenger_id,
                passenger_name: form.passenger_name,
                contact_data: parseMaybeJson(form.contact_data),
              })}
              mapPostBody={(form) => ({
                ticket_no: form.ticket_no,
                book_ref: form.book_ref,
                passenger_id: form.passenger_id,
                passenger_name: form.passenger_name,
                contact_data: parseMaybeJson(form.contact_data),
              })}
              tableLayout="wide"
            />
          )}

          {view === "boarding" && (
            <CrudTable
              title="Pases de Abordar"
              endpoint="boarding"
              user={user}
              onError={setError}
              onSuccess={setSuccess}
              columns={["ticket_no", "flight_id", "boarding_no", "seat_no"]}
              pk="ticket_no"
              formFields={[
                { name: "ticket_no", label: "No. de boleto" },
                { name: "flight_id", label: "ID vuelo" },
                { name: "boarding_no", label: "No. de abordaje" },
                { name: "seat_no", label: "Asiento", placeholder: "12A" },
              ]}
              buildPutUrl={(id) => `${API_URL}/boarding/${encodeURIComponent(id)}`}
              buildDeleteUrl={(id) => `${API_URL}/boarding/${encodeURIComponent(id)}`}
              mapPutBody={(form) => ({
                flight_id: Number(form.flight_id),
                boarding_no: Number(form.boarding_no),
                seat_no: form.seat_no,
              })}
              mapPostBody={(form) => ({
                ticket_no: form.ticket_no,
                flight_id: Number(form.flight_id),
                boarding_no: Number(form.boarding_no),
                seat_no: form.seat_no,
              })}
            />
          )}

          {/* ================== REPORTES ================== */}
          {view.startsWith("rep_") && <ReportView view={view} user={user} onError={setError} />}
        </div>
      </main>
    </div>
  );
}

/* =========================
   COMPONENTES
   ========================= */

function TopNavBtn({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold
        whitespace-nowrap transition-all duration-300 border
        ${
          active
            ? "bg-sky-50 text-sky-700 border-sky-200"
            : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100 hover:border-slate-200"
        }
      `}
    >
      <span className={active ? "text-sky-600" : ""}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// --- LOGIN ---
function Login({ onLogin, onError, error }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const setField = (k, v) => {
    setForm((s) => ({ ...s, [k]: v }));
    if (error) onError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) onLogin(data.user);
      else onError(data.error || "Credenciales inválidas");
    } catch {
      onError("Falló la conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Iniciar sesión
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              Bienvenido a <span className="text-sky-600">AEROSYS</span>
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-600">
                Usuario
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:ring-2 focus-within:ring-sky-200">
                <User size={18} className="text-slate-400" />
                <input
                  className="w-full h-11 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="usuario_admin"
                  value={form.username}
                  onChange={(e) => setField("username", e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-600">
                Contraseña
              </label>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:ring-2 focus-within:ring-sky-200">
                <Shield size={18} className="text-slate-400" />
                <input
                  className="w-full h-11 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  {showPwd ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
                <AlertTriangle size={16} />
                {String(error)}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full h-12 rounded-2xl font-extrabold text-sm tracking-wider
                         bg-gradient-to-r from-sky-600 to-indigo-600 text-white
                         hover:opacity-95 transition active:scale-[0.99]
                         disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? "Validando..." : "Entrar"}
            </button>

            <div className="text-center text-xs text-slate-500">
              Conectado a{" "}
              <span className="font-mono text-slate-700">
                {API_URL.replace("http://", "")}
              </span>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} AEROSYS
        </p>
      </div>
    </div>
  );
}

/** Dashboard */
function Dashboard({ user }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/stats`, { headers: { "x-role": user.role } })
      .then(async (r) => {
        if (!r.ok) throw await readApiError(r);
        return r.json();
      })
      .then(setStats)
      .catch(() => {});
  }, [user.role]);

  return (
    <div>
      <div className="mb-8 border-b border-slate-200 pb-4">
        <h3 className="text-3xl font-black text-slate-900">Centro de Comando</h3>
        <p className="text-slate-500 mt-1">
          Resumen en tiempo real para{" "}
          <span className="text-sky-700 font-bold">{user.name}</span>
        </p>
      </div>

      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total de reservas" value={stats.bookings} icon={<CreditCard />} />
          <StatCard title="Vuelos activos" value={stats.flights} icon={<Plane className="-rotate-45" />} />
          <StatCard title="Pasajeros" value={stats.passengers} icon={<Users />} />
          <StatCard title="Ingresos" value={`$${Number(stats.income || 0).toLocaleString()}`} icon={<Activity />} />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center">
          <Shield size={48} className="text-slate-300 mb-4" />
          <h4 className="text-xl font-black text-slate-900">Acceso restringido</h4>
          <p className="text-slate-500 mt-2 max-w-md">
            Tu nivel de permisos ({user.role}) no permite ver estadísticas globales.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * CrudTable GENÉRICA:
 * - soporte pk normal o pkComposite(row)
 * - soporte: buildPutUrl, mapPutBody, buildDeleteUrl, buildDeleteUrlFromRow
 * - campo f.disableOnEdit: deshabilita ese input cuando estás editando
 * - ✅ ahora usa readApiError() para mostrar mensajes de BD
 */
function CrudTable({
  title,
  endpoint,
  user,
  onError,
  onSuccess,
  columns,
  pk,
  pkComposite,
  formFields,
  jsonFields = [],
  tableLayout = "normal",
  disableCreate = false,
  disableEdit = false,

  buildPutUrl,
  mapPutBody,
  mapPostBody,
  buildDeleteUrl,
  buildDeleteUrlFromRow,
}) {
  const [data, setData] = useState([]);
  const [form, setForm] = useState({});
  const [showForm, setShowForm] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const canWrite = user.role !== "rol_consulta";

  const load = async () => {
    const r = await fetch(`${API_URL}/${endpoint}`, { headers: { "x-role": user.role } });
    if (!r.ok) throw await readApiError(r);
    setData(await r.json());
  };

  useEffect(() => {
    let ignore = false;
    setData([]);
    load().catch((err) => !ignore && onError(err));
    return () => (ignore = true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, user.role]);

  const getRowId = (row) => (pkComposite ? pkComposite(row) : row[pk]);

  const openNew = () => {
    setForm({});
    setIsEditing(false);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (row) => {
    const next = {};
    formFields.forEach((f) => (next[f.name] = row[f.name] ?? ""));
    jsonFields.forEach((jf) => {
      if (next[jf] && typeof next[jf] === "object") next[jf] = JSON.stringify(next[jf]);
    });

    setForm(next);
    setIsEditing(true);
    setEditId(getRowId(row));
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) return onError("No tienes permisos para realizar esta acción.");

    try {
      const url = isEditing
        ? buildPutUrl
          ? buildPutUrl(editId)
          : `${API_URL}/${endpoint}/${encodeURIComponent(editId)}`
        : `${API_URL}/${endpoint}`;

      const method = isEditing ? "PUT" : "POST";

      const body = isEditing
        ? mapPutBody
          ? mapPutBody(form)
          : form
        : mapPostBody
        ? mapPostBody(form)
        : form;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-role": user.role },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw await readApiError(res);

      onSuccess(isEditing ? "Cambios guardados" : "Guardado correctamente");
      setForm({});
      setShowForm(false);
      setIsEditing(false);
      setEditId(null);
      await load();
    } catch (err) {
      onError(err);
    }
  };

  const handleDelete = async (row) => {
    if (!canWrite) return onError("No tienes permisos para realizar esta acción.");
    const id = getRowId(row);

    // eslint-disable-next-line no-restricted-globals
    if (!confirm("¿Confirmas eliminar este registro? Esta acción no se puede deshacer.")) return;

    try {
      const url = buildDeleteUrlFromRow
        ? buildDeleteUrlFromRow(row)
        : buildDeleteUrl
        ? buildDeleteUrl(id)
        : `${API_URL}/${endpoint}/${encodeURIComponent(id)}`;

      const res = await fetch(url, {
        method: "DELETE",
        headers: { "x-role": user.role },
      });

      if (!res.ok) throw await readApiError(res);

      onSuccess("Registro eliminado");
      await load();
    } catch (err) {
      onError(err);
    }
  };

  const isPkField = (name) => name === pk;

  const tableWrapperClass = "overflow-x-auto nice-scroll";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200">
        <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">
          <Database size={20} className="text-sky-600" /> {title}
        </h3>

        <button
          onClick={() => (showForm ? setShowForm(false) : openNew())}
          disabled={!canWrite || disableCreate}
          className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-extrabold shadow-lg transition-all active:scale-95
            ${
              canWrite && !disableCreate
                ? "bg-sky-600 hover:bg-sky-700 text-white"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
          title={!canWrite || disableCreate ? "No disponible" : "Nuevo"}
        >
          <Plus size={18} /> Nuevo
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 animate-fade-in relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
          <h4 className="font-black mb-6 text-slate-900 text-lg border-b border-slate-100 pb-2">
            {isEditing ? "Editar registro" : "Nuevo registro"}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {formFields.map((f) => (
              <div key={f.name} className={f.full ? "md:col-span-2" : ""}>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                  {f.label}
                </label>

                <input
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 p-3 rounded-xl focus:ring-2 focus:ring-sky-200 focus:border-sky-400 outline-none transition-all placeholder:text-slate-400 disabled:opacity-60"
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ""}
                  disabled={
                    (isEditing && isPkField(f.name)) ||
                    !canWrite ||
                    (isEditing && disableEdit) ||
                    (isEditing && !!f.disableOnEdit)
                  }
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />

                {jsonFields.includes(f.name) && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Tip: puedes pegar JSON. Ej: {"{ \"es\": \"Texto\" }"}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setIsEditing(false);
                setEditId(null);
                setForm({});
              }}
              className="px-5 py-2.5 text-slate-600 hover:text-slate-900 transition-colors text-sm font-extrabold"
            >
              Cancelar
            </button>

            <button
              disabled={!canWrite || (isEditing && disableEdit)}
              className={`px-8 py-2.5 rounded-xl font-extrabold shadow-lg transition-all flex items-center gap-2
                ${
                  canWrite && !(isEditing && disableEdit)
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }`}
            >
              <Save size={18} /> {isEditing ? "Guardar cambios" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className={tableWrapperClass}>
          <table className="w-full text-sm text-left min-w-[880px]">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    className={`p-4 uppercase text-xs font-extrabold tracking-wider whitespace-nowrap ${
                      tableLayout === "wide" ? "min-w-[200px]" : ""
                    }`}
                  >
                    {colLabel(c)}
                  </th>
                ))}
                <th className="p-4 text-right uppercase text-xs font-extrabold tracking-wider whitespace-nowrap">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  {columns.map((c) => (
                    <td key={c} className="p-4 text-slate-700 font-medium align-top">
                      {smartCell(row[c], { clamp: tableLayout === "wide" ? 3 : 2 })}
                    </td>
                  ))}

                  <td className="p-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEdit(row)}
                        disabled={!canWrite || disableEdit}
                        className={`p-2 rounded-lg transition-all border
                          ${
                            canWrite && !disableEdit
                              ? "text-slate-400 hover:text-sky-700 hover:bg-sky-50 border-transparent hover:border-sky-200"
                              : "text-slate-300 border-transparent cursor-not-allowed"
                          }`}
                        title={canWrite && !disableEdit ? "Editar" : "No disponible"}
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        onClick={() => handleDelete(row)}
                        disabled={!canWrite}
                        className={`p-2 rounded-lg transition-all border
                          ${
                            canWrite
                              ? "text-slate-400 hover:text-red-600 hover:bg-red-50 border-transparent hover:border-red-200"
                              : "text-slate-300 border-transparent cursor-not-allowed"
                          }`}
                        title={canWrite ? "Eliminar" : "Solo lectura"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.length === 0 && (
            <div className="p-10 text-center text-slate-500">No hay registros para mostrar.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ReportView (5 reportes + loading real + sin resultados) */
function ReportView({ view, user, onError }) {
  const [data, setData] = useState(null);

  const viewMap = useMemo(
    () => ({
      rep_itinerario: "itinerario",
      rep_abordaje: "abordaje",
      rep_gestion: "gestion",
      rep_flota: "flota",
      rep_ingresos: "ingresos",
    }),
    []
  );

  useEffect(() => {
    let ignore = false;

    const key = viewMap[view];
    if (!key) {
      setData([]);
      return;
    }

    setData(null);

    fetch(`${API_URL}/reports/${key}`, { headers: { "x-role": user.role } })
      .then(async (r) => {
        if (!r.ok) throw await readApiError(r);
        return r.json();
      })
      .then((newData) => !ignore && setData(Array.isArray(newData) ? newData : []))
      .catch((err) => !ignore && onError(err));

    return () => (ignore = true);
  }, [view, user.role, onError, viewMap]);

  if (data === null) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
        <Activity className="animate-pulse mb-4" size={32} />
        <p className="font-mono text-sm uppercase">Cargando datos...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
        <Database className="mb-3" size={28} />
        <p className="font-mono text-sm uppercase">Sin resultados</p>
        <p className="text-xs text-slate-400 mt-2">La vista no devolvió registros.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto nice-scroll">
        <table className="w-full text-sm text-left min-w-[1000px]">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              {Object.keys(data[0]).map((k) => (
                <th key={k} className="p-4 whitespace-nowrap uppercase text-xs font-extrabold tracking-wider">
                  {colLabel(k)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {Object.entries(row).map(([k, v]) => (
                  <td
                    key={k}
                    className="p-4 whitespace-nowrap text-slate-700 border-r border-slate-100 last:border-0 font-mono text-xs"
                  >
                    {typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="relative group overflow-hidden bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all duration-300 shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700 mb-4 border border-sky-100">
        {icon}
      </div>
      <p className="text-slate-500 text-xs uppercase font-extrabold tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-slate-900 mt-1">{value}</h3>
    </div>
  );
}

/** parsea JSON si viene como string JSON, si no, regresa string normal */
function parseMaybeJson(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (!s) return null;
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return v;
}

function emptyToNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
