window.__pitejs__ = window.__pitejs__ || new Map()

const style = document.createElement('style')
style.append('__css__')
document.head.append(style)

const reload = async () => {
    const data = await fetch('@pitejs?css=__name__')
    const {css, imports} = await data.json()
    style.innerText = css
    updateImports(imports)
}

let imports = __imports__
imports.forEach(imp => {
    window.__pitejs__.set(imp, reload)
})

const updateImports = (newImports) => {
    imports.forEach(imp => {
        window.__pitejs__.delete(imp)
    })
    newImports.forEach(imp => {
        window.__pitejs__.set(imp, reload)
    })
}