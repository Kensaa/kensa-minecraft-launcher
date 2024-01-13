import { SlidersHorizontal } from 'lucide-react'
import { Button } from 'react-bootstrap'
import ProfilePicker from './ProfilePicker'
import UserElement from './UserElement'

export interface HomeHeaderProps {
    style?: React.CSSProperties
    className?: string
    setOverlay: (overlay: JSX.Element | undefined) => void
    setSettingsShown: (show: boolean) => void
}

export default function HomeHeader({
    style,
    className,
    setOverlay,
    setSettingsShown
}: HomeHeaderProps) {
    return (
        <div
            className={
                'h-25 w-100 d-flex p-3 align-items-start justify-content-between smooth-background-down home-header ' +
                className
            }
            style={style}
        >
            <UserElement setOverlay={setOverlay} />
            <ProfilePicker />
            <Button
                variant='light'
                onClick={() => {
                    setSettingsShown(true)
                }}
            >
                <SlidersHorizontal size={16} className='me-1' />
                Settings
            </Button>
        </div>
    )
}
