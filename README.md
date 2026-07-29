# Haxurus BetterDiscord Plugins

A collection of custom BetterDiscord plugins created and maintained by **Haxurus**.

These plugins add practical features that are missing from the standard Discord client, with a focus on local data storage, usability and simple installation.

> [!WARNING]
> BetterDiscord is an unofficial client modification. Discord and BetterDiscord updates can change internal modules and temporarily break individual plugins. Use third-party plugins at your own discretion.

## Plugins

| Plugin | Version | Description | Requirements |
| --- | ---: | --- | --- |
| [Automatic Status Scheduler](./AutomaticStatusCheduler/) | `2.0.0` | Schedules recurring Discord presence and custom status changes directly from Discord's native custom status editor. | BDFDB Library |
| [Server History](./ServerHistory/) | `1.1.0` | Keeps a local history of servers and group DMs that become unavailable, disappear or later return. | None |
| [Advanced Blocked Users](./AdvancedBlockedUsers/) | `1.0.0` | Provides a searchable, sortable, paginated and exportable manager for the complete blocked-users list. | None |
| [MessageLoggerV2](./MessageLoggerV2/) | Redirect | Points to the separately maintained compatibility-fixed version of MessageLoggerV2. | See linked repository |

## Direct Downloads

- [Download Automatic Status Scheduler](https://raw.githubusercontent.com/haxurus/BDPlugins/main/AutomaticStatusCheduler/AutomaticStatusScheduler.plugin.js)
- [Download Server History](https://raw.githubusercontent.com/haxurus/BDPlugins/main/ServerHistory/ServerHistory.plugin.js)
- [Download Advanced Blocked Users](https://raw.githubusercontent.com/haxurus/BDPlugins/main/AdvancedBlockedUsers/AdvancedBlockedUsers.plugin.js)
- [Open the maintained MessageLoggerV2 version](https://github.com/haxurus/BetterDiscordPlugins/tree/master/Plugins/MessageLoggerV2)

## Installation

1. Install [BetterDiscord](https://betterdiscord.app/) on the Discord desktop client.
2. Download the desired file ending in `.plugin.js`.
3. Open Discord and go to **User Settings > BetterDiscord > Plugins**.
4. Select **Open Plugins Folder**.
5. Copy the downloaded plugin file into that folder.
6. Return to Discord and enable the plugin.
7. Install any required library when prompted.

On Windows, the default plugin folder is usually:

```text
%AppData%\BetterDiscord\plugins
```

## Updating

Download the latest version of the plugin and replace the existing `.plugin.js` file in the BetterDiscord plugins folder. Reload Discord with `Ctrl + R` when necessary.

## Data and Privacy

Unless stated otherwise in a plugin's documentation:

- settings and history are stored locally through BetterDiscord's data API;
- plugins do not require an external account;
- exported JSON or CSV files are created locally;
- no telemetry or analytics service is used.

Read the README inside each plugin folder for its complete feature list, limitations, stored data and troubleshooting instructions.

## Compatibility

The plugins are intended for:

- the official Discord desktop client;
- BetterDiscord;
- Windows, macOS and Linux within BetterDiscord's compatibility limits.

Browser and mobile Discord clients are not supported.

## Issues and Suggestions

Use the repository's [Issues](https://github.com/haxurus/BDPlugins/issues) section to report bugs or suggest improvements. Include:

- the affected plugin and version;
- your Discord and BetterDiscord versions;
- steps to reproduce the problem;
- relevant console errors or screenshots;
- whether the problem started after a Discord update.

## Development

Most plugins are distributed as standalone JavaScript files and do not require a build process. After editing a plugin, replace or reload the file inside the BetterDiscord plugins folder and restart or reload Discord.

Contributions and compatibility fixes are welcome through pull requests.

## Author

Developed by **[Haxurus](https://github.com/haxurus)**.

## Disclaimer

This repository is not affiliated with, endorsed by or supported by Discord Inc. or BetterDiscord. All Discord trademarks and assets belong to their respective owners. Use unofficial client modifications and third-party plugins at your own risk.
