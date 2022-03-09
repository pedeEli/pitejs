const express = require('express')
const {readFile, readdir} = require('fs/promises')
const {join, parse} = require('path')
const {create} = require('ts-node')
const postcss = require('postcss')
const postcssImport = require('postcss-import')
const cssnano = require('cssnano')
const {WebSocketServer} = require('ws')
const watch = require('node-watch')
const htmlParser = require('node-html-parser')

const tsc = create()
const app = express()

// setting up endpoints
app.use(async (req, res, next) => {
    if (req.method.toLowerCase() !== 'get')
        return next()

    const path = join(__dirname, 'src', req.url)

    try {
        await sendFile(res, path)
    } catch (e) {
        try {
            const files = await readdir(path)
            const indexFiles = files.filter(file => file.match(/^index\./))
            if (!indexFiles.length)
                return next()
    
            const indexPath = join(path, indexFiles[0])
            await sendFile(res, indexPath)
        } catch (e) {
            next()
        }
    }
})
app.get('/@pitejs', async (req, res) => {
    if (req.query.css) {
        const path = req.query.css
        const data = await parseCSS(path)
        res.json(data)
        return
    }
    const path = join(__dirname, 'client.js')
    await resSendFile(res, path)
})
const server = app.listen(3000, () => console.log('Listening on port 3000'))


// helper functions
const resSendFile = (res, path) => new Promise((resolve, reject) => {
    res.sendFile(path, (err) => {
        if (err)
            return reject(err)
        resolve()
    })
})
const sendFile = async (res, path) => {
    const {ext} = parse(path)

    if (ext === '.ts') {
        const file = await readFile(path, 'utf8')
        const compiledFile = tsc.compile(file, path)
        sendJs(res, compiledFile)
        return
    }
    if (ext === '.css') {
        const {css, imports} = await parseCSS(path)
        const loadCSS = await readFile('loadCSS.js', 'utf8')
        const modifiedLoadCSS = modifyLoadCSS(loadCSS, css, imports, path)
        sendJs(res, modifiedLoadCSS)
        return
    }
    if (ext === '.html') {
        const file = await readFile(path, 'utf8')
        const parsedFile = htmlParser.parse(file)
        const head = parsedFile.querySelector('head')
        head.appendChild(new htmlParser.HTMLElement('script', {src: '@pitejs'}, 'src="@pitejs"', head))
        res.setHeader('Content-Type', 'text/html')
        res.send(parsedFile.toString())
        return
    }
    await resSendFile(res, path)
}
const parseCSS = async (path) => {
    const file = await readFile(path, 'utf8')
    const css = await postcss([
        postcssImport({root: 'src'}),
        cssnano
    ]).process(file, {from: path})
    const imports = await getImports(parse(path).dir, path, file)
    return {imports: [path, ...imports], css: css.toString()}
}
const modifyLoadCSS = (file, css, imports, path) => {
    return file.replace(/__(css|imports|name)__/g, (sub) => {
        if (sub === '__css__') return css
        if (sub === '__imports__') return JSON.stringify(imports)
        if (sub === '__name__') return encodeURIComponent(path)
    })
}
const sendJs = (res, file) => {
    res.setHeader('Content-Type', 'application/javascript')
    res.send(file)
}
const getImports = async (dir, path, file) => {
    const css = postcss.parse(file, {from: path})
    const imports = css.nodes.filter(node => node.type === 'atrule' && node.name === 'import')
    const importPaths = await Promise.all(imports.map(async imp => {
        const importName = imp.params.slice(1, -1)
        const importPath = join(dir, importName)
        const importFile = await readFile(importPath, 'utf8')
        const info = parse(importPath)
        const recursiveImports = await getImports(info.dir, importPath, importFile)
        return [importPath, ...recursiveImports]
    }))
    return importPaths.flat()
}


// sending reload signals to client
const subscribers = new Set()
const watcher = watch('src', {recursive: true})
watcher.on('change', (event, path) => {
    const {ext} = parse(path)
    subscribers.forEach(subscriber => subscriber(event, path, ext))
})

const wss = new WebSocketServer({
    noServer: true
})
wss.on('connection', (socket, request) => {
    const subscriber = (event, path, ext) => {
        if (ext === '.css') {
            socket.send(JSON.stringify({action: 'reload', path: join(__dirname, path)}))
            return
        }
        socket.send(JSON.stringify({action: 'refresh'}))
    }

    subscribers.add(subscriber)
    socket.on('close', () => {
        subscribers.delete(subscriber)
    })
})
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request)
    })
})