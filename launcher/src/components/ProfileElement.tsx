import { Profile } from "../types"

interface ProfileElementProps {
    profile: Profile | undefined
}
export default function ProfileElement({profile}: ProfileElementProps){
    if(!profile) return <div>Loading...</div>
    let versionString = profile.version.mc
    if(profile.version.forge){
        let forge = profile.version.forge
        forge = forge.substring(0,forge.lastIndexOf('-'))
        versionString = forge
    }
    return (
        <div style={{backgroundColor:'rgba(0,0,0,0.05)', maxWidth:'400px'}} className='d-flex flex-column align-items-center border p-1'>
            <h6 className='m-0'>{profile.name}</h6>
            <span className="small">{versionString}</span>
        </div>
    )
}