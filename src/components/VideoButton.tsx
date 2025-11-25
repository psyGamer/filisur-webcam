import './VideoButton.scss'

import moment from 'moment'
import { memo } from 'react'
import { AsyncImage } from 'loadable-image'
import { Blur } from 'transitions-kit'

function VideoButton({ source } : { source: string }) {
    const timeCode = source.split('/')[1].split('.')[0]
    const time = moment(timeCode, "YYYY-MM-DD_HH-mm-ss")

    return (
        <div className="image-box">
            <AsyncImage
                className='image'
                src={`/cdn/thumbnail/${source}`}
                loader={<div className='loading' />}
                error={<div style={{ background: '#FF0000' }}/>}
                Transition={props => <Blur {...props} timeout={1000} radius={10}/>}
            />

            <div className="overlay">
                <p>{time.format("DD. MMMM YYYY")}</p>
                <p>{time.format("HH:mm:ss")}</p>
            </div>
        </div>
    );
}

export default memo(VideoButton)