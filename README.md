# Kensa Minecraft Launcher

A custom made Minecraft launcher mainly used for modded minecraft.\
The key feature is an automatic update of game file from a server to allow seamless update of mods, config, etc...
You can create multiple profiles from which the user can choose from, each profile is completely isolated from others to allow different config, saves, screenshot at the same time.

New feature : you can now create local profiles that don't rely on a server (see below)

## Launcher

You can download the last version from the [release](https://github.com/Kensaa/kensa-minecraft-launcher/releases/latest) page.
- `Kensa-Minecraft-Launcher-[version].exe` is a portable executable for Windows
- `Kensa-Minecraft-Launcher-Setup-[version].exe` is an installer for Windows
- `kensa-minecraft-launcher-[version].zip` is a linux build

### Settings

#### Fields

-   **Game Folder** : The directory in which the launcher will download the game, the profiles, and java
-   **Ram** : The amount of RAM that the launcher will allocate to the game

#### Radio Buttons

-   **Close launcher when the game launches** : Kinda explicit
-   **Open Logs when the game starts** : Also explicit

#### Buttons

-   **Reset Config** : Also explicit
-   **Server Manager** : Opens a Tab in which you can add other servers from which you can download profile
-   **Local Profile Manager** : Opens Local Profile Manager (see below)
-   **Open Logs** : Opens another window where the launcher and game logs are displayed

### Local Profile Manager

This tab is used to create local profiles (profiles that doesn't auto update and are only accessible to you)

In this tab, you can see the list of all the local profiles (empty by default) and can create new profiles.

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

If the currently selected profile is a remote profile, you can also press the **Convert remote profile to local** to download it and register a copy as a local profile

## Server

You can use the [docker image](https://hub.docker.com/repository/docker/kensa/kensa-minecraft-launcher-server/general) the deploy the server on docker.\
You can also launch it manually by cloning the repo and typing :\
`yarn && yarn start`
