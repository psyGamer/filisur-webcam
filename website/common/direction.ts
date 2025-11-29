export type Direction = 'filisur' | 'chur' | 'moritz' | 'davos'
export type OptionalDirection = Direction | 'none'

export const directionNames = ({
    'filisur': 'Filisur',
    'chur': 'Chur',
    'moritz': 'St. Moritz',
    'davos': 'Davos Platz'
})
export const knownDirections: { [key: string]: Direction } = ({
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