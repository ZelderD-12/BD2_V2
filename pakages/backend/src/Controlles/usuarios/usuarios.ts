// Tipos/Interfaces
export interface LoginBody {
    email: string;
    password: string;
}

export interface UsuarioResponse {
    id: number;
    nombres: string;
    apellidos: string;
    email: string;
    rol: number;
    rol_nombre: string;
}

// Exportar funciones
export { login } from './login';
export { crearUsuario } from './crear-usuario';
export { actualizarUsuario } from './actualizar-usuario';
export { obtenerUsuario } from './obtener-usuario';