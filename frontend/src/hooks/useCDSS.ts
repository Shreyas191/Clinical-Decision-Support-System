import { useState, useCallback } from 'react'
import axios from 'axios'
import type { QueryResponse, HistoryTurn } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface CDSSState {
  result: QueryResponse | null
  history: HistoryTurn[]
  loading: boolean
  error: string | null
  sessionId: string | null
}

export function useCDSS() {
  const [state, setState] = useState<CDSSState>({
    result: null,
    history: [],
    loading: false,
    error: null,
    sessionId: localStorage.getItem('cdss_session_id'),
  })

  const query = useCallback(async (queryText: string, patientId?: string) => {
    setState(s => ({ ...s, loading: true, error: null }))

    try {
      const endpoint = patientId ? `${API_URL}/query/with-patient` : `${API_URL}/query`
      const payload = patientId
        ? { query: queryText, patient_id: patientId, session_id: state.sessionId }
        : { query: queryText, session_id: state.sessionId }

      const { data } = await axios.post<QueryResponse>(endpoint, payload)

      if (data.session_id) {
        localStorage.setItem('cdss_session_id', data.session_id)
      }

      if (data.blocked) {
        setState(s => ({
          ...s,
          loading: false,
          error: data.error ?? 'Query blocked by safety guardrail.',
        }))
        return
      }

      setState(s => ({
        ...s,
        result: data,
        sessionId: data.session_id,
        loading: false,
        history: [
          ...s.history,
          {
            query: queryText,
            response: data.response?.recommendation ?? '',
          },
        ],
      }))
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.detail ?? err.message
          : 'Unexpected error — is the backend running?'
      setState(s => ({ ...s, loading: false, error: msg }))
    }
  }, [state.sessionId])

  const newSession = useCallback(() => {
    localStorage.removeItem('cdss_session_id')
    setState({
      result: null,
      history: [],
      loading: false,
      error: null,
      sessionId: null,
    })
  }, [])

  return { ...state, query, newSession }
}
