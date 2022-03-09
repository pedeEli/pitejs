const connect = () => {
    const ws = new WebSocket('ws://localhost:3000')
    ws.addEventListener('open', () => console.log('[pitejs] hotreload connected'))
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
        const i = setInterval(() => {
            try {
                location.reload()
                clearInterval(i)
            } catch (e) {}
        }, 100)
    })
}
connect()