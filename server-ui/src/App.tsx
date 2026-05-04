import { Switch, Route, Redirect } from 'wouter'
import { createTheme, ThemeProvider } from '@mui/material'
import { useAuth } from './stores/auth'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SnackbarProvider } from 'notistack'
import GameDirectoryPage from './pages/GameDirectoryPage'
import AccountCreatePage from './pages/AccountCreatePage'

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
                <SnackbarProvider maxSnack={4} autoHideDuration={3000}>
                    <Switch>
                        <Route path='/'>
                            <LoginWall>
                                <HomePage />
                            </LoginWall>
                        </Route>
                        <Route path='/gameDirectory/:gameDirectoryName'>
                            <LoginWall>
                                <GameDirectoryPage />
                            </LoginWall>
                        </Route>
                        <Route path='/login'>
                            <LoginWall reversed redirect='/'>
                                <LoginPage />
                            </LoginWall>
                        </Route>
                        <Route path='/admin/createAccount'>
                            <LoginWall admin_needed redirect='/'>
                                <AccountCreatePage />
                            </LoginWall>
                        </Route>
                        <Route>
                            <Redirect to='/' />
                        </Route>
                    </Switch>
                </SnackbarProvider>
            </ThemeProvider>
        </QueryClientProvider>
    )
}

export default App

interface LoginWallProps {
    children: React.ReactNode
    reversed?: boolean
    redirect?: string
    admin_needed?: boolean
}
function LoginWall({
    children,
    reversed,
    redirect = '/login',
    admin_needed = false
}: LoginWallProps) {
    const isFetching = useAuth(state => state.fetching)
    let autorized = useAuth(state => state.connected)
    const userInfos = useAuth(state => state.userInfos)

    if (isFetching) return <div>Loading</div>
    if (admin_needed && (userInfos === undefined || !userInfos.is_admin))
        return <Redirect to={redirect} />
    if (reversed) autorized = !autorized
    return autorized ? children : <Redirect to={redirect} />
}
