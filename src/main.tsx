import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/literata/cyrillic-400.css'
import '@fontsource/literata/latin-400.css'
import '@fontsource-variable/unbounded/index.css'
import './styles.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
