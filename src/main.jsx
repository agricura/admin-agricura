import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// CRUCIAL: This line tells React to process the Tailwind CSS!
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)