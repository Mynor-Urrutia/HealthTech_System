/**
 * HealthTech Solutions — Auth Slice (Redux Toolkit)
 * Maneja: login, logout, refresh token, contexto de hospital (tenant)
 * Seguridad HIPAA: limpieza completa del estado al cerrar sesión
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

// ---- Tipos ----
export interface AuthUser {
  id: number
  username: string
  full_name: string
  email: string
  rol: string
  rol_nombre: string
  hospital_id: number
  hospital_nombre: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  error: string | null
}

// ---- Estado inicial ----
// Tokens en memoria (no localStorage) para reducir riesgo de XSS con PHI
const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,
}

// ---- Thunks ----
export const login = createAsyncThunk(
  'auth/login',
  async (
    credentials: { username: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await axios.post(`${API_URL}/auth/token/`, credentials)
      return response.data
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue(
          error.response?.data?.detail ?? 'Error de autenticación'
        )
      }
      return rejectWithValue('Error desconocido')
    }
  }
)

export const refreshAccessToken = createAsyncThunk(
  'auth/refresh',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState }
    const refreshToken = state.auth.refreshToken

    if (!refreshToken) return rejectWithValue('No hay refresh token')

    try {
      const response = await axios.post(`${API_URL}/auth/token/refresh/`, {
        refresh: refreshToken,
      })
      return response.data.access as string
    } catch {
      return rejectWithValue('Sesión expirada')
    }
  }
)

// ---- Slice ----
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      // Limpieza completa — prevenir fuga de PHI en memoria (HIPAA)
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.error = null
      state.isLoading = false
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<{
        access: string
        refresh: string
        user: AuthUser
      }>) => {
        state.isLoading = false
        state.accessToken = action.payload.access
        state.refreshToken = action.payload.refresh
        state.user = action.payload.user
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
      // Refresh token
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.accessToken = action.payload
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        // Si falla el refresh → logout automático
        state.user = null
        state.accessToken = null
        state.refreshToken = null
      })
  },
})

export const { logout, clearError } = authSlice.actions
export default authSlice.reducer
