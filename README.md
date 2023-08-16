# Kensa Minecraft Launcher

A custom made minecraft launcher mainly used for modded minecraft.\
The key feature is an automatic update of game file from a server to allow seamless update of mods, config, etc...
You can create multiple profiles from which the user can choose from, each profile is completely isolated from others to allow different config, saves, screenshot at the same time.

## Launcher

You can download the last version from the [release](https://github.com/Kensaa/kensa-minecraft-launcher/releases/latest) page.

-   The .msi file is an installer for Windows
-   The .exe file is a portable executable for Windows
-   The .zip is a build for linux user

### Settings

#### Fields

-   **Game Folder** : The directory in which the launcher will download the game, the profiles, and java
-   **Ram** : The amount in GiB of Ram that the launcher will allocate to the game
-   **Main Server** : The server used by the launcher to download profiles
-   **CDN Server** : The server used as CDN (leave empty unless told otherwise)
-   **JRE Executable** : The Java executable used to launch the game, you shouldn't touch that if you don't know what you're doing

#### Radio Buttons

-   **Close launcher when the game launches** : Kinda explicit
-   **Disable Auto-Update** : Toggle that if you want to disable the auto update feature of the launcher, I highly recommand not activating it because your profiles will no longer be updated (I will remove that one day)

#### Buttons

-   **Install Java** : Install the right version of java in the game directory and sets it as the JRE Executable
-   **Reset Config** : Kinda explicit too

> **_NOTE:_**
> The "Install Java" button now works on Windows and Linux, it downloads the java 19 binaries and places them into the game directory.\
> For linux Users, if your game directory is on a ntfs partition, make sure to have the execution rights activated in your `/etc/fstab` with the parameter `exec`

## Server

You can use the [docker image](https://hub.docker.com/repository/docker/kensa/kensa-minecraft-launcher-server/general) the deploy the server on docker.\
You can also launch it manually by cloning the repo and typing :\
`yarn && yarn start`

## CDN

If you need it, you can also setup a CDN that the launcher can use instead of the primary server to download, you just have to clone the repo and use the same command as the server to start it, after you need the set the "CDNS" env variable on the server to the ip of the CDN
