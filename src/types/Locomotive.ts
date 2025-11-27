export enum LocomotiveCategory {
    Ge_44_1 = "Ge_44_1",
    Ge_44_2 = "Ge_44_2",
    Ge_44_3 = "Ge_44_3",

    Gem_44_1 = "Gem_44_1",

    ABe_812_1 = "ABe_812_1",
    ABe_416_1 = "ABe_416_1",
    ABe_416_2 = "ABe_416_2",
}
export const categoryDisplayNames = ({
    [LocomotiveCategory.Ge_44_1]: "Ge 4/4 I",
    [LocomotiveCategory.Ge_44_2]: "Ge 4/4 II",
    [LocomotiveCategory.Ge_44_3]: "Ge 4/4 III",

    [LocomotiveCategory.Gem_44_1]: "Gem 4/4 «Zweikraftlok»",

    [LocomotiveCategory.ABe_812_1]: "ABe 8/12 «ZTZ Allegra»",
    [LocomotiveCategory.ABe_416_1]: "ABe 4/16 «STZ Allegra»",
    [LocomotiveCategory.ABe_416_2]: "ABe 4/16 «Capricorn»",
})

export type Locomotive = {
    number?: number
    category?: LocomotiveCategory

    positionIndex?: number
    isTowed?: boolean
}

export function getCategoryFromNumber(number: number): LocomotiveCategory | null {
    if (number >= 601 && number <= 610) {
        return LocomotiveCategory.Ge_44_1
    }
    if (number >= 611 && number <= 633) {
        return LocomotiveCategory.Ge_44_2
    }
    if (number >= 641 && number <= 652) {
        return LocomotiveCategory.Ge_44_3
    }

    if (number >= 801 && number <= 802) {
        return LocomotiveCategory.Gem_44_1
    }

    if (number >= 3501 && number <= 3515) {
        return LocomotiveCategory.ABe_812_1
    }
    if (number >= 3101 && number <= 3105) {
        return LocomotiveCategory.ABe_416_1
    }
    if (number >= 3111 && number <= 3172) {
        return LocomotiveCategory.ABe_416_2
    }

    return null
}
export const locomotiveVariant = ({
    // Ge 4/4 II
    611: 'GRÜN & CHROM',
    612: 'Elektropartner',
    614: 'Rot',
    615: 'Rot',
    617: 'Rot',
    618: 'RhB groß',
    620: 'Rot',
    621: 'Rot',
    622: 'Hakone',
    623: 'Glacier Express',
    624: 'Rot',
    625: 'Rot',
    626: 'Alpine Classic - Pullman',
    627: 'Rot',
    629: 'Rot',
    630: 'Ihre Werbung',
    631: 'Südostschweiz',
    632: 'Rot',
    633: 'RTR',

    // Ge 4/4 III
    641: 'COOP',
    642: 'Rot',
    643: 'Rot',
    644: 'Weltrekord',
    645: 'RTR',
    646: 'BüGa',
    647: 'Rot',
    648: 'Watson',
    649: 'Skimarathon',
    650: 'Rot',
    651: 'Rot',
    652: 'Hockey Club Davos',

    // ABe 8/12 «Allegra»
    3514: 'Ahnenzug',

    // ABe 4/16 «Capricorn»
    3133: 'Champagner',
})

