import axios from 'axios'
import { useRef, useState } from 'react'

import { LocomotiveCategory, categoryDisplayNames, type Locomotive, getCategoryFromNumber, locomotiveVariant as locomotiveVariants, type LocomotiveCategoryKey } from '../../common/locomotive'
import { type Train, type TrainInformation } from '../../common/train.ts'

import './TrainDescription.scss'

function LocomotiveDescription({ 
    locomotive,
    onLocomotiveChanged,
    onTowedChanged,
    onMoveUp,
    onMoveDown,
    onDelete,
}: { 
    locomotive: Locomotive,
    onLocomotiveChanged: (locomotive: Locomotive) => void,
    onTowedChanged?: (towed: boolean) => void,
    onMoveUp?: () => void,
    onMoveDown?: () => void,
    onDelete: () => void,
}) {
    const numberRef = useRef<HTMLInputElement>(null)
    const variantRef = useRef<HTMLInputElement>(null)
    const categoryRef = useRef<HTMLSelectElement>(null)

    return <div className='loco-box'>
        <div className='target-box'>
            <input type='text' inputMode='numeric' pattern="\d*" placeholder='Lok Nr.' className='input-field input-field-alt' value={locomotive.number || ''} ref={numberRef} onChange={e => {
                if (!categoryRef.current || !variantRef.current) return

                if (e.target.value.length == 0) {
                    // Optional
                    e.target.setCustomValidity("")
                    variantRef.current.innerHTML = ""

                    onLocomotiveChanged({ 
                        number: undefined, 
                        category: categoryRef.current.value == 'none' ? undefined : categoryRef.current.value as LocomotiveCategoryKey,
                    })

                    return
                }

                const number = Number(e.target.value)
                if (isNaN(number)) return

                const targetCategory = getCategoryFromNumber(number)
                if (targetCategory) {
                    e.target.setCustomValidity("")
                    categoryRef.current.value = targetCategory

                    const variant: string | undefined = locomotiveVariants[number]
                    variantRef.current.innerHTML = variant ? variant : ""

                    onLocomotiveChanged({ 
                        number: number, 
                        category: targetCategory, 
                    })
                } else {
                    e.target.setCustomValidity(`Lok Nr. ${e.target.value} wurde nicht gefunden`)
                    variantRef.current.innerHTML = ""

                    onLocomotiveChanged({ 
                        number: number, 
                        category: categoryRef.current.value == 'none' ? undefined : categoryRef.current.value as LocomotiveCategoryKey,
                    })
                }
            }}/>

            <p className='variant' ref={variantRef}>{locomotive.number ? locomotiveVariants[locomotive.number] || '' : ''}</p>

            <span className="dropdown-select">
                <select ref={categoryRef} value={locomotive.category || 'none'} onChange={e => {
                    const number = numberRef.current ? Number(numberRef.current.value) : NaN

                    onLocomotiveChanged({
                        number: isNaN(number) ? undefined : number,
                        category: e.target.value == 'none' ? undefined : e.target.value as LocomotiveCategoryKey,
                    })
                }}>
                    <option value="none">Lokkategorie auswählen...</option>
                    {Object.values(LocomotiveCategory).map(cat => <option key={cat} value={cat}>{categoryDisplayNames[cat]}</option>)}
                </select>
            </span>
        </div>

        <div className="meta-box">
            <div className={`towed checkbox-toggle ${!onTowedChanged ? 'disabled' : ''}`} >
                <input type='checkbox' id={`towed-${locomotive.positionIndex || 0}`} checked={locomotive.isTowed || false} disabled={!onTowedChanged} onChange={e => onTowedChanged!(e.target.checked)}/>
                <label htmlFor={`towed-${locomotive.positionIndex || 0}`}>Geschleppt</label>
            </div>

            <div>
                <button className='button meta-btn' disabled={!onMoveUp} onClick={() => onMoveUp!()}>Hoch<span className='material-icons'>keyboard_double_arrow_up</span></button>
                <button className='button meta-btn' disabled={!onMoveDown} onClick={() => onMoveDown!()}>Runter<span className='material-icons'>keyboard_double_arrow_down</span></button>
            </div>

            <button className='button button-danger meta-btn' onClick={() => onDelete()}>Löschen</button>
        </div>

        
    </div>
}

type Direction = 'filisur' | 'chur' | 'moritz' | 'davos'
type OptionalDirection = Direction | 'none'

const directionNames = ({
    'filisur': 'Filisur',
    'chur': 'Chur',
    'moritz': 'St. Moritz',
    'davos': 'Davos Platz'
})
const knownDirections: { [key: string]: Direction } = ({
    'Chur': 'chur',
    'Chur GB': 'chur',
    'Landquart': 'davos',
    'Landquart GB': 'chur',
    'Davos Platz': 'davos',
    'Filisur': 'filisur',
    'Pontresina': 'moritz',
    'Samedan': 'moritz',
    'St. Moritz': 'moritz',
    'Tirano': 'moritz',
    'Zermatt': 'chur',
})

function DirectionRadio({ 
    name, 
    targetDirection, 
    currentDirection, 
    isShunting, 
    onChanged 
}: { 
    name: string, 
    targetDirection: Direction, 
    currentDirection: OptionalDirection, 
    isShunting: boolean, 
    onChanged: (dir: Direction) => void 
}) {
    return <div>
        <input type='radio' name={name} id={`${name}-${targetDirection}`} checked={currentDirection == targetDirection} disabled={isShunting} onClick={() => onChanged(targetDirection)}/>
        <label htmlFor={`${name}-${targetDirection}`}>{directionNames[targetDirection]}</label>
    </div>
}

export type TrainDescription = {
    number: string

    shuntingDrive: boolean
    fromDirection: OptionalDirection
    toDirection: OptionalDirection

    locomotives: Locomotive[]
}

function TrainDescriptionPanel({ day }: { day: moment.Moment }) {
    const [isShuntingDrive, setShuntingDrive] = useState<boolean>(true)
    const [fromDirection, setFromDirection] = useState<OptionalDirection>('none')
    const [toDirection, setToDirection] = useState<OptionalDirection>('none')

    const [trainInfo, setTrainInfo] = useState<Train | null>(null)
    const [locomotives, setLocomotives] = useState<Locomotive[]>([])

    return <div className='train-box'>
        <div className='train-nr'>
            <label>Zugnummer</label>
            <input type='text' inputMode='numeric' pattern="\d*" className='input-field' onChange={async e => {
                try {
                    const res = await axios.get<TrainInformation>("/api/categorize/train-info", {
                        params: { 
                            "day": day.format('YYYY-MM-DD'),
                            "train": e.target.value
                        }
                    })
                    if (res.status == 200) {
                        setShuntingDrive(false)
                        if (res.data.train.information) {
                            const originDirection = knownDirections[res.data.train.information.origin]
                            const destinationDirection = knownDirections[res.data.train.information.destination]
                            if (originDirection) setFromDirection(originDirection)
                            if (destinationDirection) setToDirection(destinationDirection)
                        }

                        setTrainInfo(res.data.train)
                        setLocomotives(res.data.locomotives)
                        e.target.setCustomValidity("")
                    } else {
                        setTrainInfo(null)
                        e.target.setCustomValidity(`Zug Nr. '${e.target.value}' wurde nicht gefunden`)
                    }
                } catch (err) {
                    // Ignore
                }
            }}/>
        </div>

        <span className='train-info'>
            <p className='title'>{trainInfo?.information?.classifier || ''}</p>
            <p>{trainInfo?.information?.origin || ''}</p>
            <span className='material-icons'>{trainInfo ? 'east' : ''}</span>
            <p>{trainInfo?.information?.destination || ''}</p>
            <p className='time'>{trainInfo?.transit_time 
                ? `(${trainInfo.transit_time.hour.toString().padStart(2, "0")}:${trainInfo.transit_time.minute.toString().padStart(2, "0")})`
                : trainInfo?.arrival_time && trainInfo?.departure_time
                    ? `(${trainInfo.arrival_time.hour.toString().padStart(2, "0")}:${trainInfo.arrival_time.minute.toString().padStart(2, "0")} / ${trainInfo.departure_time.hour.toString().padStart(2, "0")}:${trainInfo.departure_time.minute.toString().padStart(2, "0")})`
                    : ''
            }</p>
        </span>

        <div className='shunting checkbox-toggle' >
            <input type='checkbox' id='shunting' checked={isShuntingDrive} onChange={e => setShuntingDrive(e.target.checked)}/>
            <label htmlFor='shunting'>Rangierfahrt</label>
        </div>

        <div className={`from-to-box radio-select ${isShuntingDrive ? 'disabled' : ''}`}>
            <fieldset>
                <legend>Von</legend>

                <DirectionRadio name='from' targetDirection='filisur' currentDirection={fromDirection} isShunting={isShuntingDrive} onChanged={dir => setFromDirection(dir)} />
                <DirectionRadio name='from' targetDirection='chur' currentDirection={fromDirection} isShunting={isShuntingDrive} onChanged={dir => setFromDirection(dir)} />
                <DirectionRadio name='from' targetDirection='moritz' currentDirection={fromDirection} isShunting={isShuntingDrive} onChanged={dir => setFromDirection(dir)} />
                <DirectionRadio name='from' targetDirection='davos' currentDirection={fromDirection} isShunting={isShuntingDrive} onChanged={dir => setFromDirection(dir)} />
            </fieldset>

            <fieldset>
                <legend>Nach</legend>

                <DirectionRadio name='to' targetDirection='filisur' currentDirection={toDirection} isShunting={isShuntingDrive} onChanged={dir => setToDirection(dir)} />
                <DirectionRadio name='to' targetDirection='chur' currentDirection={toDirection} isShunting={isShuntingDrive} onChanged={dir => setToDirection(dir)} />
                <DirectionRadio name='to' targetDirection='moritz' currentDirection={toDirection} isShunting={isShuntingDrive} onChanged={dir => setToDirection(dir)} />
                <DirectionRadio name='to' targetDirection='davos' currentDirection={toDirection} isShunting={isShuntingDrive} onChanged={dir => setToDirection(dir)} />
            </fieldset>
        </div>

        {locomotives.map((loco, idx) => <LocomotiveDescription 
            key={idx} 
            locomotive={loco} 
            onLocomotiveChanged={new_loco => setLocomotives(curr => curr.map((curr_loco, curr_idx) => idx == curr_idx ? new_loco : curr_loco))}
            onTowedChanged={locomotives.length == 1 ? undefined : towed => setLocomotives(curr => curr.map((curr_loco, curr_idx) => idx == curr_idx ? { ...curr_loco, isTowed: towed } : curr_loco))}
            onMoveUp={idx == 0 ? undefined : () => setLocomotives(curr => [
                ...curr.slice(0, idx - 1),
                { ...curr[idx], positionIndex: idx - 1 },
                { ...curr[idx - 1], positionIndex: idx },
                ...curr.slice(idx + 1),
            ])}
            onMoveDown={idx == locomotives.length - 1 ? undefined : () => setLocomotives(curr => [
                ...curr.slice(0, idx),
                { ...curr[idx + 1], positionIndex: idx },
                { ...curr[idx], positionIndex: idx + 1 },
                ...curr.slice(idx + 2),
            ])}
            onDelete={() => setLocomotives(curr => [
                ...curr.slice(0, idx),
                ...curr.slice(idx + 1).map((curr_loco, curr_idx) => ({ ...curr_loco, positionIndex: curr_idx - 1 })),
            ])}
            />)}

        <button className='button button-primary loco-btn' onClick={() => setLocomotives(curr => [...curr, { positionIndex: curr.length }])}>Lok Hinzufügen</button>
    </div>
}

export default TrainDescriptionPanel