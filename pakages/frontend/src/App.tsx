import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/layout/Layout'
import HomePage from './pages/Home/HomePage'
import LoginPage from './pages/Login/LoginPage'
import CitasPage from './pages/Citas/CitasPage'  
import RecepcionPage from './pages/Recepcion/RecepcionPage'
import RegisterPage from './pages/Register/RegisterPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="citas" element={<CitasPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="recepcion" element={<RecepcionPage />} />  
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}