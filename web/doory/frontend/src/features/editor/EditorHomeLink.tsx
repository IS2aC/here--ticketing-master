import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { hereApi } from '@/lib/api'
import { Logo } from '@/ui'
import styles from './EditorHomeLink.module.css'

/** Logo mark in the editor top bar: back to the dashboard (signed in) or the landing page. */
export function EditorHomeLink({ to }: { to: '/dashboard' | '/' }) {
  return (
    <Link to={to} className={styles.link} aria-label={to === '/dashboard' ? 'Back to your dashboard' : 'Doory home'}>
      <Logo variant="mark" height={28} />
    </Link>
  )
}

/** In a card opened from Here!: back to the Here! page it came from; otherwise the usual logo link. */
export function EditorBackLink({ to }: { to: '/dashboard' | '/' }) {
  const here = useQuery({ queryKey: ['here', 'return'], queryFn: ({ signal }) => hereApi.returnUrl(signal), staleTime: Infinity, retry: false })
  const url = here.data?.url
  if (!url) return <EditorHomeLink to={to} />
  return (
    <a href={url} className={styles.here}>
      <ArrowLeft size={16} aria-hidden="true" />
      Retour à Here!
    </a>
  )
}
