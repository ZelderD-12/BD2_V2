import { createContext, useState, useContext } from 'react'
import type { ReactNode } from 'react'

interface User {
  id: number
  nombres: string
  apellidos: string
  email: string
  rol: number
  rol_nombre: string
}

interface AuthContextType {
  token: string | null
  user: User | null
  userNombre: string | null
  userRol: string | null
  userRolId: number | null
  login: (token: string, user: User) => void
  logout: () => void
  isLoggedIn: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem('auth_token'))
  const [user, setUser] = useState<User | null>(
    localStorage.getItem('user_data') 
      ? JSON.parse(localStorage.getItem('user_data')!) 
      : null
  )

  const userNombre = user ? `${user.nombres} ${user.apellidos}` : null
  const userRol = user?.rol_nombre || null
  const userRolId = user?.rol || null

  const login = (token: string, userData: User) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user_data', JSON.stringify(userData))
    localStorage.setItem('user_nombre', `${userData.nombres} ${userData.apellidos}`)
    localStorage.setItem('user_rol', userData.rol_nombre)
    localStorage.setItem('user_rol_id', String(userData.rol))
    setToken(token)
    setUser(userData)
  }

  const logout = () => {
    localStorage.clear()
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, userNombre, userRol, userRolId, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export default AuthContext