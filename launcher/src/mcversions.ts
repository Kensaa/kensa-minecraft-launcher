import { ipcRenderer } from 'electron'
import { MinecraftVersion } from './types'

export let mcversions: MinecraftVersion[] = []

ipcRenderer.invoke('fetch-mcversions').then(res => (mcversions = res))
