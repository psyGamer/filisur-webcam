export type Locomotive = {
    number?: number
    category?: LocomotiveCategory,
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
