import { ServerCrash } from 'lucide-react'
import { Profile } from '../types'

import craftingtable from '../img/craftingtable.png'
import furnace from '../img/furnace.png'
import { getVersionString } from '../utils'

interface ProfileElementProps {
    profile: Profile
}

export default function ProfileElement({ profile }: ProfileElementProps) {
    return (
        <div className='d-flex flex-row align-items-center'>
            <img
                width={48}
                height={48}
                src={profile.version.forge ? furnace : craftingtable}
            />
            <div className='d-flex flex-column justify-content-center align-items-start mx-1'>
                <h6 style={{ marginBottom: '0px', color: 'white' }}>
                    {profile.name}
                </h6>
                <span style={{ color: 'white' }}>
                    {getVersionString(profile.version)}
                </span>
            </div>
        </div>
    )
}
