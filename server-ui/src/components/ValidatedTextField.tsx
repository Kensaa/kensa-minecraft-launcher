import { TextField, type TextFieldProps } from '@mui/material'
import { useState } from 'react'

type ValidatedTextField = {
    errorMessage?: string
} & TextFieldProps
export function ValidatedTextField({
    errorMessage = 'validation failed',
    onChange,
    helperText,
    ...props
}: ValidatedTextField) {
    const [valid, setValid] = useState<boolean | null>(true)
    return (
        <TextField
            onChange={e => {
                if (onChange) onChange(e)
                setValid(e.currentTarget.validity.valid)
            }}
            error={!valid}
            helperText={valid ? helperText : errorMessage}
            {...props}
        />
    )
}
