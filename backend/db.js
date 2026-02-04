const { Pool } = require('pg');

// Configuración base
const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'demo', // Nombre REAL de la BD
};

// Pools específicos por rol
const pools = {
    'rol_consulta': new Pool({ ...dbConfig, user: 'usuario_consulta', password: 'consulta123' }),
    'rol_operaciones': new Pool({ ...dbConfig, user: 'usuario_operaciones', password: 'operaciones123' }),
    'rol_administracion': new Pool({ ...dbConfig, user: 'usuario_admin', password: 'admin123' }),
};

// Función para obtener el pool correcto
const getPool = (role) => {
    // Si no hay rol o es inválido, default a consulta (principio de menor privilegio)
    return pools[role] || pools['rol_consulta'];
};

module.exports = { getPool };
