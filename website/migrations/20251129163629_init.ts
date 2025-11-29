import type { Knex } from "knex";

import { LocomotiveCategory } from '../common/locomotive.ts'
import { directionNames } from "../common/direction.ts";

export async function up(knex: Knex): Promise<void> {
    return knex.schema
        .createTable("categorized_trains", table => {
            table.increments("id")
            table.string("video").notNullable()
            table.string("number").notNullable()

            const directions = Object.keys(directionNames)
            table.enum("from", directions)
            table.enum("to", directions)
        })
        .createTable("categorized_locomotives", table => {
            table.integer("train_id").unsigned()
                .references("id").inTable("categorized_trains")

            table.integer("number").unsigned().notNullable().defaultTo(0)
            table.enum("category", Object.values(LocomotiveCategory)).notNullable()

            table.integer("position").unsigned().notNullable().defaultTo(0)
            table.boolean("towed").notNullable().defaultTo(false)
        })
}


export async function down(knex: Knex): Promise<void> {
    return knex.schema
        .dropTable("categorized_trains")
        .dropTable("categorized_locomotives")
}

