import { Switch, Route, Redirect } from 'wouter'
import { createTheme, ThemeProvider } from '@mui/material'
import { useAuth } from './stores/auth'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

const theme = createTheme({
    palette: {
        mode: 'light'
    }
})
function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <Switch>
                    <Route path='/'>
                        <LoginWall>
                            <HomePage />
                        </LoginWall>
                    </Route>
                    <Route path='/login'>
                        <LoginWall reversed redirect='/'>
                            <LoginPage />
                        </LoginWall>
                    </Route>
                    <Route>
                        <Redirect to='/' />
                    </Route>
                </Switch>
            </ThemeProvider>
        </QueryClientProvider>
    )
}

export default App

interface LoginWallProps {
    children: React.ReactNode
    reversed?: boolean
    redirect?: string
}
function LoginWall({
    children,
    reversed,
    redirect = '/login'
}: LoginWallProps) {
    let autorized = useAuth(state => state.connected)
    if (reversed) autorized = !autorized
    return autorized ? children : <Redirect to={redirect} />
}
