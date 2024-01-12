import { ProgressBar } from 'react-bootstrap'
import { useTask } from '../utils'

interface TaskOverlayProps {
    title?: string
}

export default function TaskOverlay({ title }: TaskOverlayProps) {
    const task = useTask()

    return (
        <div className='overlay'>
            {title && <h1>{title}</h1>}
            {task && (
                <div className='w-100 d-flex flex-column align-items-center mt-2'>
                    <h4>{task.title}</h4>
                    <ProgressBar
                        className='w-75'
                        now={task.progress}
                        label={`${task.progress.toFixed(1)}%`}
                    />
                </div>
            )}
        </div>
    )
}
