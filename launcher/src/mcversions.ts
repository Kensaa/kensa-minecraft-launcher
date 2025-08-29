import { ipcRenderer } from 'electron'
import { Version } from './types'

export let mcversions: Version[] = []

ipcRenderer.invoke('fetch-mcversions').then(res => (mcversions = res))
