import ReactDOM from 'react-dom/client'
import App from './App'
import './style/style.scss'
console.log('first render')
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <App />
)
