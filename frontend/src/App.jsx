import React, { useState, useEffect } from 'react';
import { 
  Plane, Calendar, User, CreditCard, FileText, AlertTriangle, 
  LogOut, Shield, Database, Plus, Trash2, X, Users, Activity, Map, Settings
} from 'lucide-react';

// --- CONFIGURACIÓN API ---
const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // --- LOGIN ---
  if (!user) return <Login onLogin={setUser} onError={setError} error={error} />;

  return (
    <div className="flex h-screen bg-[#0B1120] font-sans text-slate-300 overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
      {/* SIDEBAR - Estilo Cabina */}
      <aside className="w-72 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        {/* Logo Area */}
        <div className="p-8 border-b border-slate-800/50 flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500 blur-lg opacity-40 rounded-full"></div>
            <div className="bg-gradient-to-br from-sky-500 to-blue-700 p-3 rounded-xl text-white relative z-10 shadow-lg">
              <Plane size={28} className="transform -rotate-45" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-white text-lg tracking-wider">AERO<span className="text-sky-400">SYS</span></h1>
            <p className="text-[10px] text-sky-500/80 font-mono uppercase tracking-widest">Flight Control v2</p>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          <MenuSection title="Main Control">
            <MenuBtn icon={<Activity size={18}/>} label="Dashboard" active={view==='dashboard'} onClick={()=>setView('dashboard')}/>
          </MenuSection>

          <MenuSection title="Flight Ops (CRUD)">
            <MenuBtn icon={<CreditCard size={18}/>} label="Bookings" active={view==='bookings'} onClick={()=>setView('bookings')}/>
            <MenuBtn icon={<User size={18}/>} label="Tickets" active={view==='tickets'} onClick={()=>setView('tickets')}/>
            <MenuBtn icon={<FileText size={18}/>} label="Boarding Passes" active={view==='boarding'} onClick={()=>setView('boarding')}/>
          </MenuSection>

          <MenuSection title="Intelligence (Views)">
            <MenuBtn icon={<Map size={18}/>} label="Public Itinerary" active={view==='rep_itinerario'} onClick={()=>setView('rep_itinerario')}/>
            <MenuBtn icon={<Users size={18}/>} label="Boarding List" active={view==='rep_abordaje'} onClick={()=>setView('rep_abordaje')}/>
            <MenuBtn icon={<Plane size={18}/>} label="Fleet Control" active={view==='rep_flota'} onClick={()=>setView('rep_flota')}/>
          </MenuSection>
        </div>

        {/* User Profile Footer */}
        <div className="p-6 bg-slate-900/90 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px] ${user.role && user.role.includes('admin') ? 'bg-red-500 shadow-red-500/50' : 'bg-emerald-500 shadow-emerald-500/50'}`}></div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate uppercase tracking-wider">{user.role?.replace('rol_', '')}</p>
            </div>
          </div>
          <button onClick={()=>setUser(null)} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white hover:bg-red-500/20 py-2.5 rounded-lg transition-all text-xs font-bold border border-transparent hover:border-red-500/30 group">
            <LogOut size={14} className="group-hover:-translate-x-1 transition-transform"/> DISCONNECT
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar Glass */}
        <header className="h-20 border-b border-slate-800/50 flex justify-between items-center px-8 bg-slate-900/50 backdrop-blur-sm z-10">
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-1 h-6 bg-sky-500 rounded-full mr-2"></span>
              {view.replace('rep_', 'Report: ').toUpperCase()}
            </h2>
            <p className="text-xs text-slate-500 ml-5 font-mono">SECURE CONNECTION ESTABLISHED</p>
          </div>
          
          {/* Notifications Area */}
          <div className="fixed top-6 right-6 w-96 z-50 space-y-3 pointer-events-none">
            {error && (
              <div className="pointer-events-auto bg-red-950/90 border-l-4 border-red-500 p-4 shadow-2xl rounded-r-lg flex items-start gap-3 backdrop-blur-md animate-fade-in ring-1 ring-red-500/20">
                <AlertTriangle className="text-red-500 shrink-0 mt-1 drop-shadow-lg"/>
                <div className="flex-1">
                  <h4 className="font-bold text-red-200 text-sm tracking-wide">SYSTEM ERROR</h4>
                  <p className="text-xs text-red-300/80 mt-1 font-mono">{error}</p>
                </div>
                <button onClick={()=>setError(null)}><X size={16} className="text-red-400 hover:text-white"/></button>
              </div>
            )}
            {success && (
              <div className="pointer-events-auto bg-emerald-950/90 border-l-4 border-emerald-500 p-4 shadow-2xl rounded-r-lg flex items-center gap-3 backdrop-blur-md animate-fade-in ring-1 ring-emerald-500/20">
                <Shield className="text-emerald-500 drop-shadow-lg"/>
                <p className="text-sm font-bold text-emerald-200 tracking-wide">{success}</p>
              </div>
            )}
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <div className="flex-1 overflow-auto p-8 relative scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-10">
            {view === 'dashboard' && <Dashboard user={user} onError={setError} />}
            
            {view === 'bookings' && <CrudTable title="Bookings Management" endpoint="bookings" user={user} onError={setError} onSuccess={setSuccess} 
                columns={['book_ref', 'book_date', 'total_amount']} pk="book_ref"
                formFields={[
                  {name: 'book_ref', label: 'Ref Code (6 chars)', placeholder: 'XXXXXX'},
                  {name: 'total_amount', label: 'Total Amount', type: 'number', placeholder: '-100 to test check'}
                ]}
            />}
            {view === 'tickets' && <CrudTable title="Tickets Management" endpoint="tickets" user={user} onError={setError} onSuccess={setSuccess}
                columns={['ticket_no', 'book_ref', 'passenger_name']} pk="ticket_no"
                formFields={[
                  {name: 'ticket_no', label: 'Ticket No (13 digits)', placeholder: '0005432000000'},
                  {name: 'book_ref', label: 'Booking Ref'},
                  {name: 'passenger_id', label: 'Passenger ID', placeholder: '1234 567890'},
                  {name: 'passenger_name', label: 'Full Name', placeholder: 'juan perez'},
                  {name: 'contact_data', label: 'Contact JSON', placeholder: '{"email": "test@test.com"}'}
                ]}
            />}
            {view === 'boarding' && <CrudTable title="Boarding Passes" endpoint="boarding" user={user} onError={setError} onSuccess={setSuccess}
                columns={['ticket_no', 'flight_id', 'boarding_no', 'seat_no']} pk="ticket_no"
                formFields={[
                  {name: 'ticket_no', label: 'Ticket No'},
                  {name: 'flight_id', label: 'Flight ID'},
                  {name: 'boarding_no', label: 'Boarding No'},
                  {name: 'seat_no', label: 'Seat No', placeholder: '99Z'}
                ]}
            />}
            
            {view.startsWith('rep_') && <ReportView view={view} user={user} onError={setError} />}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- SUB-COMPONENTES (Dark Styled) ---

function Login({ onLogin, onError, error }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) onLogin(data.user);
      else onError(data.error);
    } catch (e) { onError("Connection failed"); }
  };

  return (
    <div className="min-h-screen bg-[#050B14] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#050B14] to-[#000000]"></div>
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-sky-900/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px]"></div>

      <div className="bg-slate-900/40 w-full max-w-md rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] p-10 border border-slate-800 backdrop-blur-xl relative z-10">
        <div className="text-center mb-10">
          <div className="bg-gradient-to-br from-sky-500 to-blue-700 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto text-white mb-6 shadow-xl shadow-sky-900/50 transform hover:scale-105 transition-transform duration-500">
            <Plane size={40} className="transform -rotate-45" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight">AERO<span className="text-sky-500">SYS</span></h2>
          <p className="text-slate-400 text-sm mt-2 font-light">Secure Flight Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs text-sky-500 font-bold uppercase tracking-widest ml-1">Username</label>
            <input className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 p-3.5 rounded-lg focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none transition-all placeholder:text-slate-700" 
              placeholder="e.g. usuario_admin" value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-sky-500 font-bold uppercase tracking-widest ml-1">Password</label>
            <input className="w-full bg-slate-950/50 border border-slate-700 text-slate-200 p-3.5 rounded-lg focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 outline-none transition-all placeholder:text-slate-700" 
              type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle size={16}/> {error}
            </div>
          )}
          
          <button className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-4 rounded-lg transition-all shadow-lg shadow-sky-900/30 active:scale-95 uppercase tracking-wider text-sm">
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}

function Dashboard({ user, onError }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch(`${API_URL}/stats`, { headers: { 'x-role': user.role } })
      .then(r => r.ok ? r.json() : Promise.reject("Access Restricted"))
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-8 border-b border-slate-800 pb-4">
        <h3 className="text-3xl font-bold text-white">Command Center</h3>
        <p className="text-slate-500 mt-1">Real-time data overview for <span className="text-sky-400">{user.name}</span></p>
      </div>
      
      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Bookings" value={stats.bookings} icon={<CreditCard/>} color="from-blue-600 to-blue-400" />
          <StatCard title="Active Flights" value={stats.flights} icon={<Plane className="-rotate-45"/>} color="from-emerald-600 to-emerald-400" />
          <StatCard title="Passengers" value={stats.passengers} icon={<Users/>} color="from-violet-600 to-violet-400" />
          <StatCard title="Revenue" value={`$${parseFloat(stats.income).toLocaleString()}`} icon={<Activity/>} color="from-amber-600 to-amber-400" />
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-700 p-8 rounded-2xl flex flex-col items-center justify-center text-center opacity-75">
          <Shield size={48} className="text-slate-600 mb-4"/>
          <h4 className="text-xl font-bold text-slate-300">Restricted Access</h4>
          <p className="text-slate-500 mt-2 max-w-md">Your clearance level ({user.role}) does not allow viewing global statistics.</p>
        </div>
      )}
    </div>
  );
}

function CrudTable({ title, endpoint, user, onError, onSuccess, columns, pk, formFields }) {
  const [data, setData] = useState([]);
  const [form, setForm] = useState({});
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let ignore = false;
    setData([]);
    fetch(`${API_URL}/${endpoint}`, { headers: { 'x-role': user.role } })
      .then(async r => { if(!r.ok) throw await r.text(); return r.json(); })
      .then(newData => { if (!ignore) setData(newData); })
      .catch(err => { if (!ignore) onError(err); });
    return () => { ignore = true; };
  }, [endpoint]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-role': user.role }, body: JSON.stringify(form)
      });
      if (!res.ok) throw await res.text();
      onSuccess("Transaction Recorded");
      setForm({}); setShowForm(false);
      const r = await fetch(`${API_URL}/${endpoint}`, { headers: { 'x-role': user.role } });
      setData(await r.json());
    } catch (e) { onError(e); }
  };

  const handleDelete = async (id) => {
    if(!confirm("CONFIRM DELETION? This action is irreversible.")) return;
    try {
      const res = await fetch(`${API_URL}/${endpoint}/${id}`, { method: 'DELETE', headers: { 'x-role': user.role } });
      if (!res.ok) throw await res.text();
      onSuccess("Record Deleted");
      const r = await fetch(`${API_URL}/${endpoint}`, { headers: { 'x-role': user.role } });
      setData(await r.json());
    } catch (e) { onError(e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <h3 className="font-bold text-xl text-white flex items-center gap-2">
          <Database size={20} className="text-sky-500"/> {title}
        </h3>
        <button onClick={() => setShowForm(!showForm)} className="bg-sky-600 hover:bg-sky-500 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-sky-900/20 transition-all active:scale-95 border border-sky-500/50">
          <Plus size={18}/> New Entry
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in ring-1 ring-sky-500/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
          <h4 className="font-bold mb-6 text-white text-lg border-b border-slate-800 pb-2">Record Details</h4>
          <div className="grid grid-cols-2 gap-6 mb-8">
            {formFields.map(f => (
              <div key={f.name}>
                <label className="block text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-2">{f.label}</label>
                <input className="w-full bg-slate-950 border border-slate-700 text-slate-200 p-3 rounded-lg focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder:text-slate-700" 
                  type={f.type || 'text'} placeholder={f.placeholder}
                  value={form[f.name] || ''} onChange={e=>setForm({...form, [f.name]:e.target.value})}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setShowForm(false)} className="px-5 py-2.5 text-slate-400 hover:text-white transition-colors text-sm font-bold">Cancel</button>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2">
              <Save size={18}/> Save Data
            </button>
          </div>
        </form>
      )}

      <div className="bg-slate-900/60 rounded-2xl shadow-xl border border-slate-800 overflow-hidden backdrop-blur-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              {columns.map(c => <th key={c} className="p-4 uppercase text-xs font-bold tracking-wider">{c.replace('_',' ')}</th>)}
              <th className="p-4 text-right uppercase text-xs font-bold tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                {columns.map(c => (
                  <td key={c} className="p-4 text-slate-300 font-medium group-hover:text-white transition-colors">
                    {typeof row[c] === 'object' && row[c] !== null ? JSON.stringify(row[c]) : row[c]}
                  </td>
                ))}
                <td className="p-4 text-right">
                  <button onClick={() => handleDelete(row[pk])} className="text-slate-500 hover:text-red-400 hover:bg-red-950/30 p-2 rounded-lg transition-all border border-transparent hover:border-red-900/50"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportView({ view, user, onError }) {
  const [data, setData] = useState([]);
  const viewMap = { 'rep_itinerario': 'itinerario', 'rep_abordaje': 'abordaje', 'rep_flota': 'flota' };

  useEffect(() => {
    let ignore = false;
    setData([]);
    fetch(`${API_URL}/reports/${viewMap[view]}`, { headers: { 'x-role': user.role } })
      .then(async r => { if(!r.ok) throw await r.text(); return r.json(); })
      .then(newData => { if (!ignore) setData(newData); })
      .catch(err => { if (!ignore) onError(err); });
    return () => { ignore = true; };
  }, [view]);

  if(data.length === 0) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-600 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
      <Activity className="animate-pulse mb-4" size={32}/>
      <p className="font-mono text-sm uppercase">Acquiring Data Stream...</p>
    </div>
  );

  return (
    <div className="bg-slate-900/60 rounded-2xl shadow-xl border border-slate-800 overflow-hidden backdrop-blur-sm">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-950 text-sky-500 border-b border-slate-800">
            <tr>{Object.keys(data[0]).map(k => <th key={k} className="p-4 whitespace-nowrap uppercase text-xs font-bold tracking-wider">{k.replace(/_/g,' ')}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                {Object.values(row).map((v, j) => (
                   <td key={j} className="p-4 whitespace-nowrap text-slate-400 border-r border-slate-800/30 last:border-0 font-mono text-xs">
                     {typeof v === 'object' && v !== null ? JSON.stringify(v) : v}
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

// UI Helpers (Styled)
function MenuSection({title, children}) { return <div className="mb-2"><h4 className="text-[10px] font-extrabold text-slate-600 uppercase px-4 mb-3 tracking-widest">{title}</h4><div className="space-y-1">{children}</div></div> }
function MenuBtn({icon, label, active, onClick}) { 
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden group ${active ? 'bg-sky-600/10 text-sky-400 border border-sky-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'}`}>
      {active && <div className="absolute left-0 top-0 h-full w-1 bg-sky-500 shadow-[0_0_10px_#0ea5e9]"></div>}
      <span className={`relative z-10 group-hover:scale-110 transition-transform duration-300 ${active ? 'text-sky-400' : ''}`}>{icon}</span> 
      <span className="relative z-10">{label}</span>
    </button> 
  ) 
}
function StatCard({title, value, color, icon}) { 
  return (
    <div className="relative group overflow-hidden bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-slate-600 transition-all duration-300 shadow-xl">
      <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity bg-gradient-to-br ${color} bg-clip-text text-transparent transform scale-150`}>
        {React.cloneElement(icon, { size: 64 })}
      </div>
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-4 shadow-lg`}>
        {icon}
      </div>
      <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">{title}</p>
      <h3 className="text-2xl font-bold text-white mt-1 group-hover:translate-x-1 transition-transform">{value}</h3>
    </div> 
  ) 
}