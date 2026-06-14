import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'
import { useEffect, useState } from 'react'
import { refreshToken } from '../api/refresh'

interface TokenPayload {
  exp: number
}

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [canAccess, setCanAccess] = useState<boolean | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const tokenFromUrl = searchParams.get('accessToken')
  const refreshTokenFromUrl = searchParams.get('refreshToken')
  const token = tokenFromUrl ?? localStorage.getItem('token')

  useEffect(() => {
    async function validateToken() {
      /**
       * Após login OAuth com email já verificado, o backend redireciona para /Game
       * com tokens temporários na query porque só o frontend pode escrever localStorage.
       */
      if (tokenFromUrl && refreshTokenFromUrl) {
        localStorage.setItem('token', tokenFromUrl)
        localStorage.setItem('refreshToken', refreshTokenFromUrl)

        // Limpa a URL para não deixar JWTs visíveis no histórico/endereço.
        navigate('/Game', { replace: true })
      }

      if (!token) {
        setCanAccess(false)
        return
      }

      try {
        const decoded = jwtDecode<TokenPayload>(token)

        if (decoded.exp * 1000 >= Date.now()) {
          setCanAccess(true)
          return
        }

        setIsRefreshing(true)
        const refreshed = await refreshToken()
        setCanAccess(refreshed)
      } catch {
        localStorage.removeItem('token')
        setCanAccess(false)
      } finally {
        setIsRefreshing(false)
      }
    }

    validateToken()
  }, [navigate, refreshTokenFromUrl, token, tokenFromUrl])

  if (canAccess === null || isRefreshing) {
    return null
  }

  if (!canAccess) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
