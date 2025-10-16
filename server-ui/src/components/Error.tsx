import { Alert, Collapse, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect } from 'react';

interface ErrorProps {
    error: string | null;
    hide: () => void;
}
export default function Error({ error, hide }: ErrorProps) {
    useEffect(() => {
        if (!error) return;
        const timeout = setTimeout(hide, 5000);
        return () => clearTimeout(timeout);
    }, [error, hide]);

    return (
        <Collapse in={!!error}>
            <Alert
                severity='error'
                action={
                    <IconButton aria-label='close' color='inherit' size='small' onClick={hide}>
                        <CloseIcon fontSize='inherit' />
                    </IconButton>
                }
            >
                {error}
            </Alert>
        </Collapse>
    );
}
