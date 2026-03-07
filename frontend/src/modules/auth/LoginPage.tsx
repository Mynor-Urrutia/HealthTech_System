import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@shared/hooks/useStore'
import { login, clearError } from '@store/authSlice'
import { useNavigate } from 'react-router-dom'

// ---- Validación con Zod ----
const loginSchema = z.object({
  username: z.string().min(3, 'Mínimo 3 caracteres'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const dispatch    = useAppDispatch()
  const navigate    = useNavigate()
  const { isLoading, error } = useAppSelector((s) => s.auth)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    dispatch(clearError())
    const result = await dispatch(login(data))
    if (login.fulfilled.match(result)) {
      navigate('/dashboard', { replace: true })
    }
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Iniciar sesión</h2>
        <p className="text-sm text-gray-500 mt-1">Ingrese sus credenciales para continuar</p>
      </div>

      {/* Error de autenticación */}
      {error && (
        <div className="mb-4 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Usuario
          </label>
          <input
            {...register('username')}
            type="text"
            autoComplete="username"
            autoFocus
            placeholder="nombre.usuario"
            className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition
              ${errors.username
                ? 'border-red-400 bg-red-50'
                : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
          />
          {errors.username && (
            <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
          )}
        </div>

        {/* Contraseña */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña
          </label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••"
              className={`w-full px-3 py-2.5 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition
                ${errors.password
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Botón de login */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                     disabled:bg-primary-400 text-white font-semibold py-2.5 rounded-lg
                     transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {isLoading ? 'Verificando...' : 'Ingresar'}
        </button>
      </form>

      {/* Info de seguridad */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">
          Sistema protegido · Acceso monitoreado · HIPAA Compliance
        </p>
      </div>
    </>
  )
}
