/**
 * HealthTech Solutions — Cliente HTTP base (Axios)
 * Maneja: JWT automático, refresh token, hospital_id en headers,
 * limpieza de sesión al expirar (prevención de fuga de PHI)
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios'
import { store } from '@store/index'
import { logout, refreshAccessToken } from '@store/authSlice'

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

// ---- Instancia principal ----
export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ---- Interceptor de REQUEST: añade JWT y hospital_id ----
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = store.getState()
    const token = state.auth.accessToken
    const hospitalId = state.auth.user?.hospital_id

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // hospital_id en header para logging del backend
    if (hospitalId) {
      config.headers['X-Hospital-Id'] = hospitalId
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ---- Interceptor de RESPONSE: maneja 401 con refresh token ----
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Cola de requests que esperan el nuevo token
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const newToken = await store.dispatch(refreshAccessToken()).unwrap()
        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        // Refresh falló → logout + limpieza de estado PHI
        store.dispatch(logout())
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
