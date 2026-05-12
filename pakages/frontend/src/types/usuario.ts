export interface Usuario {
    id: number
    nombres: string
    apellidos: string
    dpi: string
    telefono: string
    direccion?: string
    rol: number
    rol_nombre: string
    sexo: string
    fecha_nacimiento: string
    email: string
    antecedetes_medicos?: string
    contacto_emergencia?: string
    edad?: number
  }
  
  export type RolId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  
  export const ROLES: Record<number, string> = {
    1: 'Anónimo',
    2: 'Paciente',
    3: 'Doctor',
    4: 'Enfermería',
    5: 'Recepción/Secretaría',
    6: 'Recepción',
    7: 'Farmacia/Laboratorio',
    8: 'Finanzas/Contabilidad',
    9: 'Técnico',
    10: 'Auditor'
  }
  
  // Permisos por rol
  export const PERMISOS = {
    VER_RECEPCION: [5, 6],           // Solo recepción
    VER_CITAS: [2, 3, 5, 6],         // Paciente, Doctor, Recepción
    CREAR_USUARIO: [5, 6],           // Solo recepción
    GESTIONAR_TICKETS: [5, 6],       // Solo recepción
    VER_HOME: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // Todos
  }
  
  export const tienePermiso = (rolId: number, permiso: keyof typeof PERMISOS): boolean => {
    return PERMISOS[permiso].includes(rolId)
  }