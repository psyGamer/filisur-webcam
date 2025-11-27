import { useRef, useState } from 'react'

import { LocomotiveCategory, categoryDisplayNames, type Locomotive, getCategoryFromNumber, locomotiveVariant as locomotiveVariants } from '../types/Locomotive'

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
                        category: categoryRef.current.value == 'none' ? undefined : categoryRef.current.value as LocomotiveCategory,
                    })

                    return
                }

                const number = Number(e.target.value)
                if (isNaN(number)) return

                const targetCategory = getCategoryFromNumber(number)
                if (targetCategory) {
                    e.target.setCustomValidity("")
                    categoryRef.current.value = targetCategory

                    // @ts-ignore
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
                        category: categoryRef.current.value == 'none' ? undefined : categoryRef.current.value as LocomotiveCategory,
                    })
                }
            }}/>

            <p className='variant' ref={variantRef} />

            <span className="dropdown-select">
                <select ref={categoryRef} value={locomotive.category || 'none'} onChange={e => {
                    const number = numberRef.current ? Number(numberRef.current.value) : NaN

                    onLocomotiveChanged({
                        number: isNaN(number) ? undefined : number,
                        category: e.target.value == 'none' ? undefined : e.target.value as LocomotiveCategory,
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

function TrainDescription() {
    const [isShuntingDrive, setShuntingDrive] = useState<boolean>(true)
    const [locomotives, setLocomotives] = useState<Locomotive[]>([])

    return <div className='train-box'>
        <div className='train-nr'>
            <label>Zugnummer</label>
            <input type='text' inputMode='numeric' pattern="\d*" className='input-field'/>
        </div>

        <p className='train-info'>
            <p className='title'>Bernina Express:</p>
            <p>Tirano</p>
            <span className='material-icons'>east</span>
            <p>Chur</p>
        </p>

        <div className='shunting checkbox-toggle' >
            <input type='checkbox' id='shunting' checked={isShuntingDrive} onChange={e => setShuntingDrive(e.target.checked)}/>
            <label htmlFor='shunting'>Rangierfahrt</label>
        </div>

        <div className={`from-to-box radio-select ${isShuntingDrive ? 'disabled' : ''}`}>
            <fieldset>
                <legend>Von</legend>

                <div>
                    <input type='radio' name='from' id='from-filisur' disabled={isShuntingDrive}/>
                    <label htmlFor='from-filisur'>Filisur</label>
                </div>

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
                    <input type='radio' name='to' id='to-filisur' disabled={isShuntingDrive}/>
                    <label htmlFor='to-filisur'>Filisur</label>
                </div>

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

export default TrainDescription