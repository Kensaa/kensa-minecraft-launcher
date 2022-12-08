import { Dropdown, Spinner } from "react-bootstrap"
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
        <div className='d-flex flex-row align-items-center'>
            {/*<img width={64} height={64} src={forge}/>*/}  
            <div className="d-flex flex-column justify-content-center align-items-start">
                <h6 style={{marginBottom:'0px'}}>{profile.name}</h6>
                <span>{versionString}</span>
            </div>
        </div>
    )
}