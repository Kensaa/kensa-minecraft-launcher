import { ServerCrash } from "lucide-react"
import { Profile } from "../types"

import craftingtable from '../img/craftingtable.png'
import furnace from '../img/furnace.png'

interface ProfileElementProps {
    profile: Profile | undefined
}

export default function ProfileElement({ profile }: ProfileElementProps) {
    if (!profile) {
        return <div>
            <ServerCrash size={16} className="me-2" />
            Error
        </div>
    }

    let versionString = profile.version.mc
    if (profile.version.forge) {
        let forge = profile.version.forge
        forge = forge.substring(0, forge.lastIndexOf('-'))
        versionString = forge
    }
    return (
        <div className='d-flex flex-row align-items-center'>
            <img width={48} height={48} src={profile.version.forge ? furnace : craftingtable} />
            <div className="d-flex flex-column justify-content-center align-items-start mx-1">
                <h6 style={{ marginBottom: '0px', color: 'white' }}>{profile.name}</h6>
                <span style={{ color: 'white' }}>{versionString}</span>
            </div>
        </div>
    )
}