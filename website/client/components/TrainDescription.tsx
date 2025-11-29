import axios from 'axios'
import moment from 'moment'
import { useRef, useState, type Dispatch, type SetStateAction, useId, useMemo } from 'react'

import { LocomotiveCategory, categoryDisplayNames, type Locomotive, getCategoryFromNumber, locomotiveVariant as locomotiveVariants, type LocomotiveCategoryKey } from '../../common/locomotive'
import { type Train, type TrainInformation } from '../../common/train.ts'
import { directionNames, type Direction, type OptionalDirection, knownDirections } from '../../common/direction.ts'

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

const fullClassiferNames: { [key: string]: string } = ({
    'R 1': 'Regio 1',
    'R 38': 'Regio 38',
    'RE 38': 'RegioExpress 38',
    'IR 38': 'InterRegio 38',
    'GEX': 'Glacier Express',
    'BEX': 'Bernina Express',
    'G': 'Güterzug'
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
    const { data, error, isFetching, isLoading } = useQuery({
        queryKey: ['suggestions', time],
        queryFn: () => axios.get<Train[]>("/api/categorize/suggestions?", {
            params: {
                "time": time.format('YYYY-MM-DD_HH-mm-ss'),
                "regularVariance": 20,
                "freightVariance": 60,
            }
        }),
        staleTime: 300_000,
    })

    const suggestions = useMemo(() => {
        if (!data) return []

        const suggestions = data.data.flatMap<Train, Train>(suggestion => {
            // Convert all to use 'transit_time' as a general time and adjust origin / destination
            if (suggestion.transit_time) {
                return [suggestion]
            }

            if (suggestion.arrival_time && suggestion.departure_time) {
                return [
                    {
                        ...suggestion,
                        transit_time: suggestion.arrival_time,
                        information: {
                            ...suggestion.information,
                            destination: 'Filisur',
                        }
                    },
                    {
                        ...suggestion,
                        transit_time: suggestion.departure_time,
                        information: {
                            ...suggestion.information,
                            origin: 'Filisur',
                        }
                    },
                ]
            }

            if (suggestion.arrival_time) {
                return [{ ...suggestion, transit_time: suggestion.arrival_time }]
            }
            if (suggestion.departure_time) {
                return [{ ...suggestion, transit_time: suggestion.departure_time }]
            }

            return [suggestion]
        })
        suggestions.sort((a, b) => (a.transit_time!.hour*60 + a.transit_time!.minute) - (b.transit_time!.hour*60 + b.transit_time!.minute))

        return suggestions
    }, [data])

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
                    onChange={e => setSuggestion(e.target.value)}
                    disabled={isLoading || isFetching}
                >
                    <option value="none" disabled>{isLoading || isFetching
                        ? 'Lade Vorschläge...'
                        : 'Vorschlag auswählen...'
                    }</option>

                    {suggestions
                        .map(suggestion => {
                            const key = `${suggestion.number}-${knownDirections[suggestion.information.origin]}-${knownDirections[suggestion.information.destination]}`

                            return <option
                                key={key}
                                value={key}
                                onClick={async (_) => {
                                    onDescChagned({ ...desc, number: suggestion.number })

                                    try {
                                        const res = await axios.get<TrainInformation>("/api/categorize/train-info", {
                                            params: {
                                                "day": time.format('YYYY-MM-DD'),
                                                "train": suggestion.number
                                            }
                                        })
                                        if (res.status == 200) {
                                            onDescChagned({
                                                number: res.data.train.number,
                                                shuntingDrive: false,
                                                fromDirection: knownDirections[suggestion.information.origin],
                                                toDirection: knownDirections[suggestion.information.destination],
                                                locomotives: res.data.locomotives
                                            })
                                            setTrainInfo(res.data.train)
                                        }
                                    } catch (err) {
                                        // Ignore
                                    }
                                } }
                            >
                                {suggestion.number}:
                                &nbsp;&nbsp;&nbsp;
                                {suggestion.information?.classifier || ''}
                                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                {suggestion.information?.origin || ''}
                                &nbsp;➔&nbsp;
                                {suggestion.information?.destination || ''}
                                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                {`(${formatTime(suggestion.transit_time!)})`}
                            </option>
                        })}
                </select>
            </span>
        </div>

        <div className='train-nr'>
            <label>Zugnummer</label>
            <input type='text' inputMode='numeric' pattern="\d*" className='input-field' ref={trainNumberRef} value={desc.number || ''} onChange={async e => {
                if (!isLoading && !isFetching) {
                    if (suggestions.some(suggestion => e.target.value == suggestion.number
                                                    && desc.fromDirection == knownDirections[suggestion.information.origin]
                                                    && desc.toDirection == knownDirections[suggestion.information.destination])
                    ) {
                        setSuggestion(`${e.target.value}-${desc.fromDirection}-${desc.toDirection}`)
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
            <p className='title'>{trainInfo ? fullClassiferNames[trainInfo.information.classifier] : ''}</p>
            <p>{trainInfo?.information.origin}</p>
            <span className='material-icons'>{trainInfo ? 'east' : ''}</span>
            <p>{trainInfo?.information.destination || ''}</p>
            <p className='time'>{trainInfo?.transit_time 
                ? `(${formatTime(trainInfo.transit_time)})`
                : trainInfo?.arrival_time && trainInfo?.departure_time
                    ? `(${formatTime(trainInfo.arrival_time)} / ${formatTime(trainInfo.departure_time)})`
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
                    onClick={() => {
                        const newFromDirection = direction as Direction

                        if (!isLoading && !isFetching) {
                            if (suggestions.some(suggestion => desc.number == suggestion.number
                                                            && newFromDirection == knownDirections[suggestion.information.origin]
                                                            && desc.toDirection == knownDirections[suggestion.information.destination])
                            ) {
                                setSuggestion(`${desc.number}-${newFromDirection}-${desc.toDirection}`)
                            } else {
                                setSuggestion('none')
                            }
                        }

                        onDescChagned({ ...desc, fromDirection: newFromDirection })
                    }} />
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
                    onClick={() => {
                        const newToDirection = direction as Direction

                        if (!isLoading && !isFetching) {
                            if (suggestions.some(suggestion => desc.number == suggestion.number
                                                            && desc.fromDirection == knownDirections[suggestion.information.origin]
                                                            && newToDirection == knownDirections[suggestion.information.destination])
                            ) {
                                setSuggestion(`${desc.number}-${desc.fromDirection}-${newToDirection}`)
                            } else {
                                setSuggestion('none')
                            }
                        }

                        return onDescChagned({ ...desc, toDirection: newToDirection })
                    }} />
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
            key={`${idx}-${time.format('YYYY-MM-DD_HH-mm-ss')}`}
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