import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle
} from '@mui/material'
import { useLocation } from 'wouter'

export interface CreateAccountAskDialogProps {
    open: boolean
    close: () => void
}

export default function CreateAccountAskDialog({
    open,
    close
}: CreateAccountAskDialogProps) {
    const [, setLocation] = useLocation()

    console.log('test', open)
    const handleYes = () => {
        close()
        console.log('redirect to creation')
        setLocation('/admin/createAccount')
    }

    const handleNo = () => {
        close()
        console.log('redirect to home')
        setLocation('/')
    }
    return (
        <Dialog open={open} onClose={close} role='alertdialog'>
            <DialogTitle id='alert-dialog-title'>
                Create an Account ?
            </DialogTitle>
            <DialogContent>
                <DialogContentText id='alert-dialog-description'>
                    Your account seems to be a temporary admin account, do you
                    want to create a permanent account ?
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleYes} autoFocus>
                    Yes
                </Button>
                <Button onClick={handleNo}>No</Button>
            </DialogActions>
        </Dialog>
    )
}
