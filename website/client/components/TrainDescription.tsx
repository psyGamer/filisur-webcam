import axios from 'axios'
import moment from 'moment'
import { useRef, useState, type Dispatch, type SetStateAction, useId } from 'react'

import { LocomotiveCategory, categoryDisplayNames, type Locomotive, getCategoryFromNumber, locomotiveVariant as locomotiveVariants, type LocomotiveCategoryKey } from '../../common/locomotive'
import { type Train, type TrainCollection, type TrainInformation } from '../../common/train.ts'

import './TrainDescription.scss'
import { useQuery } from '@tanstack/react-query'

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
                    <option value="none" disabled>Lokkategorie auswählen...</option>
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
    onClick 
}: { 
    name: string, 
    targetDirection: Direction, 
    currentDirection: OptionalDirection, 
    isShunting: boolean, 
    onClick: () => void 
}) {
    return <div>
        <input type='radio' name={name} id={`${name}-${targetDirection}`} checked={currentDirection == targetDirection} disabled={isShunting} onChange={onClick}/>
        <label htmlFor={`${name}-${targetDirection}`}>{directionNames[targetDirection]}</label>
    </div>
}

export type TrainDescription = {
    number?: string

    shuntingDrive?: boolean
    fromDirection?: OptionalDirection
    toDirection?: OptionalDirection

    locomotives?: Locomotive[]
}
type HourMinute = { hour: number, minute: number }
function formatTime(time: HourMinute): string {
    return `${time.hour.toString().padStart(2, "0")}:${time.minute.toString().padStart(2, "0")}`
}

function TrainDescriptionPanel({ time, description: desc, onDescriptionChanged: onDescChagned, onDelete }: { 
    time: moment.Moment, 
    description: TrainDescription, 

    onDescriptionChanged: (desc: TrainDescription) => void,
    onDelete: () => void,
}) {
    const { data: suggestions, error, isFetching, isLoading } = useQuery({
        queryKey: ['suggestions'],
        queryFn: () => axios.get<Train[]>("/api/categorize/suggestions?", {
            params: {
                "time": time.format('YYYY-MM-DD_HH-mm-ss'),
                "regularVariance": 20,
                "freightVariance": 60,
            }
        }),
        staleTime: 300_000,
    })

    const id = useId()

    const [trainInfo, setTrainInfo] = useState<Train | null>(null)
    const [suggestion, setSuggestion] = useState<string>('none')

    const locomotives = desc.locomotives || []
    const setLocomotives = (locomotives: Locomotive[]) => onDescChagned({ ...desc, locomotives: locomotives })

    const trainNumberRef = useRef<HTMLInputElement>(null)

    return <div className='train-box'>
        <div className="train-suggestion">
            <span className="dropdown-select">
                <select 
                    value={suggestion} 
                    onChange={e => {
                        setSuggestion(e.target.value)
                        if (trainNumberRef.current) {
                            // Dispatch even to trigger onChange
                            const setter: (value: string) => void = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
                            setter.call(trainNumberRef.current, e.target.value);
                            trainNumberRef.current.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }}
                    disabled={isLoading || isFetching}
                >
                    <option value="none" disabled>{isLoading || isFetching
                        ? 'Lade Vorschläge...'
                        : 'Vorschlag auswählen...'
                    }</option>

                    {(suggestions?.data || []).map(suggestion => {
                        const minTime = suggestion.arrival_time || suggestion.transit_time || suggestion.departure_time
                        const maxTime = suggestion.departure_time || suggestion.transit_time || suggestion.arrival_time

                        return <option
                            key={suggestion.number}
                            value={suggestion.number}
                        >
                            {suggestion.number}:
                            &nbsp;&nbsp;&nbsp;
                            {suggestion.information?.classifier || ''}
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                            {suggestion.information?.origin || ''}
                            &nbsp;➔&nbsp;
                            {suggestion.information?.destination || ''}
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                            {!minTime && !maxTime
                                ? ''
                                : minTime == maxTime
                                    ? `(${formatTime(minTime!)})`
                                    : `(${formatTime(minTime!)} / ${formatTime(maxTime!)})`}
                        </option>
                    })}
                </select>
            </span>
        </div>

        <div className='train-nr'>
            <label>Zugnummer</label>
            <input type='text' inputMode='numeric' pattern="\d*" className='input-field' ref={trainNumberRef} value={desc.number || ''} onChange={async e => {
                if (!isLoading && suggestions) {
                    if (suggestions.data.some(suggestion => suggestion.number == e.target.value)) {
                        setSuggestion(e.target.value)
                    } else {
                        setSuggestion('none')
                    }
                }

                onDescChagned({ ...desc, number: e.target.value })

                try {
                    const res = await axios.get<TrainInformation>("/api/categorize/train-info", {
                        params: { 
                            "day": time.format('YYYY-MM-DD'),
                            "train": e.target.value
                        }
                    })
                    if (res.status == 200) {
                        const originDirection = res.data.train.information ? knownDirections[res.data.train.information.origin] : undefined
                        const destinationDirection = res.data.train.information ? knownDirections[res.data.train.information.destination] : undefined

                        onDescChagned({
                            number: res.data.train.number,
                            shuntingDrive: false,
                            fromDirection: originDirection ? originDirection : desc.fromDirection,
                            toDirection: destinationDirection ? destinationDirection : desc.toDirection,
                            locomotives: res.data.locomotives
                        })

                        setTrainInfo(res.data.train)
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
            <input type='checkbox' id='shunting' checked={desc.shuntingDrive || false} onChange={e => onDescChagned({ ...desc, shuntingDrive: e.target.checked })}/>
            <label htmlFor='shunting'>Rangierfahrt</label>
        </div>

        <div className={`from-to-box radio-select ${desc.shuntingDrive ? 'disabled' : ''}`}>
            <fieldset>
                <legend>Von</legend>

                {Object.keys(directionNames).map(direction => <DirectionRadio 
                    key={direction}
                    name={`from-${id}`}
                    targetDirection={direction as Direction}
                    currentDirection={desc.fromDirection || 'none'}
                    isShunting={desc.shuntingDrive || false} 
                    onClick={() => onDescChagned({ ...desc, fromDirection: direction as Direction })} />
                )}
            </fieldset>

            <fieldset>
                <legend>Nach</legend>

                {Object.keys(directionNames).map(direction => <DirectionRadio
                    key={direction}
                    name={`to-${id}`}
                    targetDirection={direction as Direction}
                    currentDirection={desc.toDirection || 'none'}
                    isShunting={desc.shuntingDrive || false} 
                    onClick={() => onDescChagned({ ...desc, toDirection: direction as Direction })} />
                )}
            </fieldset>
        </div>

        {locomotives.map((loco, idx) => <LocomotiveDescription 
            key={idx} 
            locomotive={loco} 
            onLocomotiveChanged={newLoco => setLocomotives(locomotives.map((currLoco, currIdx) => idx == currIdx ? newLoco : currLoco))}
            onTowedChanged={locomotives.length == 1 ? undefined : towed => setLocomotives(locomotives.map((currLoco, currIdx) => idx == currIdx ? { ...currLoco, isTowed: towed } : currLoco))}
            onMoveUp={idx == 0 ? undefined : () => setLocomotives([
                ...locomotives.slice(0, idx - 1),
                { ...locomotives[idx], positionIndex: idx - 1 },
                { ...locomotives[idx - 1], positionIndex: idx },
                ...locomotives.slice(idx + 1),
            ])}
            onMoveDown={idx == locomotives.length - 1 ? undefined : () => setLocomotives([
                ...locomotives.slice(0, idx),
                { ...locomotives[idx + 1], positionIndex: idx },
                { ...locomotives[idx], positionIndex: idx + 1 },
                ...locomotives.slice(idx + 2),
            ])}
            onDelete={() => setLocomotives([
                ...locomotives.slice(0, idx),
                ...locomotives.slice(idx + 1).map((currLoco, currIdx) => ({ ...currLoco, positionIndex: currIdx - 1 })),
            ])}
            />)}

        <div className='bottom-btns'>
            <button className='button button-primary' onClick={() => setLocomotives([...locomotives, { positionIndex: locomotives.length }])}>Lok Hinzufügen</button>
            <button className='button button-danger' onClick={onDelete}>Zug Löschen</button>
        </div>
    </div>
}

export function TrainList({ time, descriptions, setDescriptions }: { time: moment.Moment, descriptions: TrainDescription[], setDescriptions: Dispatch<SetStateAction<TrainDescription[]>> }) {
    return <div className="train-list">
        {descriptions.map((desc, idx) => <TrainDescriptionPanel 
            key={idx}
            time={time}
            description={desc} 
            onDescriptionChanged={newDesc => setDescriptions(curr => curr.map((currDesc, currIdx) => idx == currIdx ? newDesc : currDesc))} 
            onDelete={() => setDescriptions(curr => [
                ...curr.slice(0, idx),
                ...curr.slice(idx + 1),
            ])}
        />)}
        <button className='button button-primary train-btn' onClick={() => setDescriptions(curr => [...curr, {}])}>Zug Hinzufügen</button>
    </div>
}