import { useState } from 'react'

import { LocomotiveCategory, categoryDisplayNames, type Locomotive } from '../types/Locomotive'

import './TrainDescription.scss'

function LocomotiveDescription({ locomotive }: { locomotive: Locomotive }) {
    return <div className='loco-box'>
        <input type='text' inputMode='numeric' />
    </div>
}

function TrainDescription() {
    const [isShuntingDrive, setShuntingDrive] = useState<boolean>(true)
    const [locomotives, setLocomotives] = useState<Locomotive[]>([])

    return <div className='train-box'>
        <div className='train-nr'>
            <label>Zugnummer</label>
            <input type='text' inputMode='numeric' pattern="\d*" />
        </div>

        <div className='shunting' >
            <input type='checkbox' id='shunting' checked={isShuntingDrive} onChange={e => setShuntingDrive(e.target.checked)}/>
            <label htmlFor='shunting'>Rangierfahrt</label>
        </div>

        <div className={`from-to-box ${isShuntingDrive ? 'disabled' : ''}`}>
            <fieldset>
                <legend>Von</legend>

                <div>
                    <input type='radio' name='from' id='from-chur' disabled={isShuntingDrive}/>
                    <label htmlFor='from-chur'>Chur</label>
                </div>

                <div>
                    <input type='radio' name='from' id='from-moritz' disabled={isShuntingDrive}/>
                    <label htmlFor='from-moritz'>St. Moritz</label>
                </div>

                <div>
                    <input type='radio' name='from' id='from-davos' disabled={isShuntingDrive}/>
                    <label htmlFor='from-davos'>Davos Platz</label>
                </div>
            </fieldset>

            <fieldset>
                <legend>Nach</legend>

                <div>
                    <input type='radio' name='to' id='to-chur' disabled={isShuntingDrive}/>
                    <label htmlFor='to-chur'>Chur</label>
                </div>

                <div>
                    <input type='radio' name='to' id='to-moritz' disabled={isShuntingDrive}/>
                    <label htmlFor='to-moritz'>St. Moritz</label>
                </div>

                <div>
                    <input type='radio' name='to' id='to-davos' disabled={isShuntingDrive}/>
                    <label htmlFor='to-davos'>Davos Platz</label>
                </div>
            </fieldset>
        </div>

        {locomotives.map((loco, idx) => <LocomotiveDescription key={idx} locomotive={loco} />)}

        <button className='loco-btn' onClick={() => setLocomotives(curr => [...curr, {}])}>Lok Hinzufügen</button>
    </div>
}

export default TrainDescription