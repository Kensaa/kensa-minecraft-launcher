const { execSync } = require('child_process')
const fs = require('fs')

const version = require('./package.json').version
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})
function input() {
    return new Promise(resolve => {
        readline.question('', resolve)
    })
} //build
//get note from args (parse \n)
//release
//delete release folder

;(async () => {
    console.log('building launcher')
    execSync('yarn build', { stdio: 'inherit' })
    let notes
    while (true) {
        notes = await askNotes()
        const addInscruction = await ask(
            'do you want to append the executables inscruction at the end ?'
        )
        if (addInscruction) {
            notes +=
                '\n.msi pour windows\n.exe pour la version (a moitié)portable\n.zip pour les autres'
        }
        console.log('----------------------------------')
        console.log(notes)

        if (await ask('is that correct ?')) break
    }
    fs.writeFileSync('notes', notes)

    const releaseCommand = `gh release create v${version} -t "v${version}" --notes-file notes "release/Kensa Minecraft Launcher ${version}.exe" "release/Kensa Minecraft Launcher ${version}.msi" "release/kensa-minecraft-launcher-${version}.zip"`

    execSync(releaseCommand)
    console.log('release successfully created !')
    fs.rmSync('notes')
    fs.rmSync('release', { recursive: true })
    process.exit(0)
})()

async function askNotes() {
    const lines = []
    console.log('enter the note for the release:')
    while (true) {
        const resp = await input()
        if (resp === '') break
        lines.push(resp)
    }
    return lines.join('\n')
}

async function ask(question) {
    console.log(question)
    console.log('Y/n ')
    const resp = (await input()).toLowerCase()
    return resp === '' || resp === 'y'
}
