import { http } from './client'

/** Here!: the organizers of Here! open their invitation card in the editor from a Here! page. */
export const hereApi = {
  /** The Here! page to go back to (null when the editor wasn't opened from Here!). */
  returnUrl: (signal?: AbortSignal) => http.get<{ url: string | null }>('/here/return/', { signal }),
}
