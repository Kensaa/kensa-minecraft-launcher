import { Spinner } from "react-bootstrap"
import { Profile } from "../types"

interface ProfileElementProps {
    profile: Profile | undefined
    loading: boolean
}

export default function ProfileElement({ profile, loading }: ProfileElementProps){
    if(!profile){
        if(loading){
            return <div>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        }else {
            return <div>Error</div>
        }
    }

    let versionString = profile.version.mc
    if(profile.version.forge){
        let forge = profile.version.forge
        forge = forge.substring(0,forge.lastIndexOf('-'))
        versionString = forge
    }
    return (
        <div style={{backgroundColor:'rgba(0,0,0,0.05)', maxWidth:'400px'}} className='d-flex flex-column align-items-center border p-1'>
            <h6 className='m-0'>{profile.name}</h6>
            <span style={{color:'#ffffff'}} className="small">{versionString}</span>
        </div>
    )
}