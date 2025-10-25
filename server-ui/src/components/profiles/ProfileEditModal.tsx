import type { Profile } from '../../types'
import Modal, { type ModalProps } from '../Modal'

type ProfileEditModalProps = Omit<ModalProps, 'children'> & {
    profile?: Profile // if profile === undefined -> create new profile
}
export default function ProfileEditModal({
    profile,
    ...props
}: ProfileEditModalProps) {
    return <Modal {...props}></Modal>
}
