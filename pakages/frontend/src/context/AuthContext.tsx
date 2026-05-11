import { createContext, useState, useContext } from 'react'
import type { ReactNode } from 'react'

interface AuthContextType {
  token: string | null
  userNombre: string | null
  userRol: string | null
  login: (token: string, nombre: string, rol: string) => void
  logout: () => void
  isLoggedIn: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem('auth_token'))
  const [userNombre, setUserNombre] = useState(localStorage.getItem('user_nombre'))
  const [userRol, setUserRol] = useState(localStorage.getItem('user_rol'))

  const login = (token: string, nombre: string, rol: string) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user_nombre', nombre)
    localStorage.setItem('user_rol', rol)
    setToken(token)
    setUserNombre(nombre)
    setUserRol(rol)
  }

  const logout = () => {
    localStorage.clear()
    setToken(null)
    setUserNombre(null)
    setUserRol(null)
  }

  return (
    <AuthContext.Provider value={{ token, userNombre, userRol, login, logout, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export default AuthContext