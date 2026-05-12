import { createContext, useState, useContext } from 'react'
import type { ReactNode } from 'react'

export interface Usuario {
  id: number
  nombres: string
  apellidos: string
  email: string
  rol: number
  rol_nombre: string
}

export const PERMISOS = {
  VER_RECEPCION: [5, 6],
  VER_CITAS: [2, 3, 5, 6],
  CREAR_USUARIO: [5, 6],
  GESTIONAR_TICKETS: [5, 6],
}

export const tienePermiso = (rolId: number | null, permiso: keyof typeof PERMISOS): boolean => {
  if (!rolId) return false
  return PERMISOS[permiso].includes(rolId)
}

interface AuthContextType {
  token: string | null
  user: Usuario | null
  userNombre: string | null
  userRol: string | null
  userRolId: number | null
  login: (token: string, user: Usuario) => void
  logout: () => void
  isLoggedIn: boolean
  tienePermiso: (permiso: keyof typeof PERMISOS) => boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem('auth_token'))
  const [user, setUser] = useState<Usuario | null>(
    localStorage.getItem('user_data') 
      ? JSON.parse(localStorage.getItem('user_data')!) 
      : null
  )

  const userNombre = user ? `${user.nombres} ${user.apellidos}` : null
  const userRol = user?.rol_nombre || null
  const userRolId = user?.rol || null

  const login = (token: string, userData: Usuario) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user_data', JSON.stringify(userData))
    setToken(token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.clear()
    setToken(null)
    setUser(null)
  }

  const checkPermiso = (permiso: keyof typeof PERMISOS) => {
    return tienePermiso(userRolId, permiso)
  }

  return (
    <AuthContext.Provider value={{ 
      token, user, userNombre, userRol, userRolId, 
      login, logout, isLoggedIn: !!token, 
      tienePermiso: checkPermiso 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)