import React from 'react'

interface AlertStackProps {
    children: React.ReactNode
}

export default function AlertStack({ children }: AlertStackProps) {
    return (
        <div
            className='position-absolute d-flex flex-column align-items-center w-100'
            style={{ zIndex: 9999, marginTop: '6rem' }}
        >
            {children}
        </div>
    )
}
