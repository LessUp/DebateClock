import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Display from './Display'
import './index.css'

const isDisplay = window.location.pathname.endsWith('/display')
const Root = isDisplay ? Display : App

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
