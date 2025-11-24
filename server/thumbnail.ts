import { Router } from 'express'
import { spawnSync } from 'node:child_process'

import fs from 'node:fs'
import path from 'path'

import logger from './logger.ts'

const router = Router()

router.get("/*path", async (req, res) => {
    // @ts-ignore
    const videoSubpath: string[] = req.params.path
    const archivePath = process.env.VIDEO_ARCHIVE!
    const cachePath = process.env.THUMBNAIL_CACHE!

    const videoPath = path.normalize(path.join(archivePath, path.join(...videoSubpath)))
    const thumbnailPath = path.format({ ...path.parse(path.join(cachePath, path.join(...videoSubpath))), base: '', ext: '.png' })
    
    // Validate path
    if (!videoPath.startsWith(archivePath)) {
        res.status(403).send("Illegal file path")
        return
    }
    if (!fs.existsSync(videoPath)) {
        res.status(404).send("File not found")
        return
    }

    fs.readFile(thumbnailPath, (err, data) => {
        if (err) {
            // Thumbnail not found -> create one
            logger.info(`Creating thumbnail for video '${videoPath}' -> '${thumbnailPath}'`)

            const directory = path.dirname(thumbnailPath)
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory)
            }

            const thumbernailer = spawnSync("ffmpegthumbnailer", ["-i", videoPath, "-o", thumbnailPath, "-s0", "-t00:00:10"]) // scary..
            console.log(thumbernailer)

            data = fs.readFileSync(thumbnailPath)
        } else {
            logger.debug(`Found cached thumbnail for '${videoPath}'`)
        }

        res.status(200).set({
            'Content-Type': 'image/png',
            'Content-Length': data.byteLength,
            'Cache-Control': 'public, max-age=604800, immutable'
        })
        res.end(data)
    })
})

export default router
