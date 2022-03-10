let lostConnection = false

const connect = () => {
    const ws = new WebSocket('ws://localhost:3000')
    ws.addEventListener('open', () => {
        if (lostConnection)
            location.reload()
        console.log('[pitejs] hotreload connected')
    })
    ws.addEventListener('message', ({data}) => {
        const message = JSON.parse(data)
        if (message.action === 'refresh') {
            location.reload()
            return
        }
        if (message.action === 'reload') {
            const {path} = message
            console.log(`[pitejs] hotreloading "${path}"`)
            window.__pitejs__.get(path)()
            return
        }
    })
    ws.addEventListener('close', () => {
        console.log('[pitejs] hotreload lost connection')
        lostConnection = true
        setTimeout(() => {
            connect()
        }, 1000)
    })
    ws.addEventListener('error', console.error)
}
connect()