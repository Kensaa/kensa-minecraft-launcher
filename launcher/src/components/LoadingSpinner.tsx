import { Spinner } from 'react-bootstrap'

export default function LoadingSpinner() {
    return (
        <div style={{ color: 'white' }}>
            <Spinner animation='border' role='status'>
                <span className='visually-hidden'>Loading...</span>
            </Spinner>
        </div>
    )
}
