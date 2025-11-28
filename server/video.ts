import { Router } from 'express'

import fs from 'node:fs'
import path from 'path'

const router = Router()

router.get("/*path", async (req, res) => {
    // @ts-ignore
    const videoSubpath: string[] = req.params.path
    const archivePath = process.env.WEBCAM_VIDEO_ARCHIVE!

    const videoPath = path.normalize(path.join(archivePath, path.join(...videoSubpath)))
    
    // Validate path
    if (!videoPath.startsWith(archivePath)) {
        res.status(403).send("Illegal file path")
        return
    }
    if (!fs.existsSync(videoPath)) {
        res.status(404).send("File not found")
        return
    }

    const videoStat = fs.statSync(videoPath);
    const fileSize = videoStat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-')

        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunkSize = end - start + 1

        res.status(206).set({
            'Content-Type': 'video/mp4',
            'Content-Length': chunkSize,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Cache-Control': 'public, max-age=604800, immutable',
            'Accept-Ranges': 'bytes',
        })

        fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
        res.status(200).set({
            'Content-Type': 'video/mp4',
            'Content-Length': fileSize,
            'Cache-Control': 'public, max-age=604800, immutable',
            'Accept-Ranges': 'bytes',
        })

        fs.createReadStream(videoPath).pipe(res)
    }
})

export default router
