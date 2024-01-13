# Kensa Minecraft Launcher

A custom made minecraft launcher mainly used for modded minecraft.\
The key feature is an automatic update of game file from a server to allow seamless update of mods, config, etc...
You can create multiple profiles from which the user can choose from, each profile is completely isolated from others to allow different config, saves, screenshot at the same time.

New feature : you can now create local profiles that don't rely on a server (see below)

## Launcher

You can download the last version from the [release](https://github.com/Kensaa/kensa-minecraft-launcher/releases/latest) page.

-   The .msi file is an installer for Windows
-   The .exe file is a portable executable for Windows
-   The .zip is a build for linux user

### Settings

#### Fields

-   **Game Folder** : The directory in which the launcher will download the game, the profiles, and java
-   **Ram** : The amount in GiB of Ram that the launcher will allocate to the game
-   **CDN Server** : The server used as CDN (leave empty unless told otherwise)
-   **JRE Executable** : The Java executable used to launch the game, you shouldn't touch that if you don't know what you're doing

#### Radio Buttons

-   **Close launcher when the game launches** : Kinda explicit

#### Buttons

-   **Reset Config** : Kinda explicit too
-   **Server Manager** : Open a Tab in which you can add other servers from which you can download profile
-   **Local Profile Manager** : Open Local Profile Manager (see below)

### Local Profile Manager

This tab is used to create local profiles (I.E. profile that doesn't auto update and is only accessible to you)

In this tab, you can see the list of all the local profiles (that is empty by default) and you can create new profiles

#### Creating A New Local Profile

When pressing the "Create new local profile" button a tab opens, in you can specify the following fields:

-   Name : the name of the profile
-   Version : the version of the game (ex: 1.12.2)
-   Forge Version : filename of the forge installer if you want to use forge (the installer need to be located in `[game folder]/forgeInstallers/`)
-   Game Folder : the name of the folder in which the profile will be stored (in `[game folder]/profiles/`). If empty, the name of the profile will be used

### Adding files to existing remote profile

If your want to add file (like mods) to an existing profile, you can add them in :\
`[game folder]/additionalFiles/[profile]`.\
 They will be automatically added in the game folder when you start the game. This is made so that people who want to add mods like Optifine, Betterfps, etc... can add them without them being removed at each start by the updater or without the creator of the profile having to add them to the profile which would install them for all the users

## Server

You can use the [docker image](https://hub.docker.com/repository/docker/kensa/kensa-minecraft-launcher-server/general) the deploy the server on docker.\
You can also launch it manually by cloning the repo and typing :\
`yarn && yarn start`
