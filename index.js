const express = require('express')
const {readFile, readdir} = require('fs/promises')
const {join, parse} = require('path')
const {create} = require('ts-node')


const tsc = create()
const app = express()

app.use(async (req, res, next) => {
    if (req.method.toLowerCase() !== 'get')
        return next()
    
    const path = join(__dirname, 'src', req.url)

    try {
        await resSendFile(res, path)
    } catch (e) {
        const files = await readdir(path)
        const indexFiles = files.filter(file => file.match(/^index\./))
        if (!indexFiles.length)
            return next()

        const indexPath = join(path, indexFiles[0])
        await resSendFile(res, indexPath)
    }
})

const resSendFile = (res, path) => new Promise((resolve, reject) => {
    res.sendFile(path, (err) => {
        if (err)
            return reject(err)
        resolve()
    })
})

app.listen(3000, () => console.log('Listening on port 3000'))