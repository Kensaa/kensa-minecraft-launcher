# Kensa Minecraft Launcher

A custom made minecraft launcher mainly used for modded minecraft.\
The key feature is an automatic update of game file from a server to allow seamless update of mods, config, etc...
You can create multiple profiles from which the user can choose from, each profile is completely isolated from others to allow different config, saves, screenshot at the same time.\

## Installation

### Launcher

You can download the last version from the [release](https://github.com/Kensaa/kensa-minecraft-launcher/releases/latest) page.\

-   The .msi file is an installer for Windows\
-   The .exe file is a portable executable for Windows\
-   The .zip is a build for linux user

### Server

You can use the [docker image](https://hub.docker.com/repository/docker/kensa/kensa-minecraft-launcher-server/general) the deploy the server on docker.\
You can also launch it manually by cloning the repo and typing :\
`yarn && yarn start`

### CDN

If you need it, you can also setup a CDN that the launcher can use instead of the primary server to download, you just have to clone the repo and use the same command as the server to start it, after you need the set the "CDNS" env variable on the server to the ip of the CDN
