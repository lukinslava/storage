import { useEffect, useState } from 'react'
import { createHashRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { TabBar } from './components/TabBar'
import { DataProvider } from './lib/data'
import { supabase } from './lib/store'
import { ArtworkPage } from './pages/ArtworkPage'
import { CollectionPage } from './pages/CollectionPage'
import { Collections } from './pages/Collections'
import { Login } from './pages/Login'
import { Museum } from './pages/Museum'
import { Scan } from './pages/Scan'
import { Settings } from './pages/Settings'
import { Story } from './pages/Story'

function Layout() {
  return (
    <DataProvider>
      <main className="app">
        <Outlet />
      </main>
      <TabBar />
      <ScrollRestoration />
    </DataProvider>
  )
}

// Hash-роутинг: GitHub Pages не умеет отдавать index.html на любые пути.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Museum /> },
      { path: '/collections', element: <Collections /> },
      { path: '/collections/:id', element: <CollectionPage /> },
      { path: '/scan', element: <Scan /> },
      { path: '/story', element: <Story /> },
      { path: '/settings', element: <Settings /> },
      { path: '/art/:id', element: <ArtworkPage /> },
      { path: '*', element: <Museum /> },
    ],
  },
])

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (supabase) {
    if (session === undefined) return null
    if (!session) return <Login />
  }
  // key: после смены пользователя данные грузятся заново.
  return <RouterProvider key={session?.user.id ?? 'local'} router={router} />
}
