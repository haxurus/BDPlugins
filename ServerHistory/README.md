# Haxurus Server History

A BetterDiscord plugin that keeps a local history of Discord servers and group DMs that become unavailable or disappear from your account.

When Discord removes a server or group from the interface, there is often no visible record left behind. **Server History** stores the name, ID, date, event type, and confidence level so you can review what happened later.

## Features

- Logs servers that become temporarily unavailable.
- Logs when an unavailable server becomes accessible again.
- Detects voluntary server departures performed while the plugin is running.
- Logs external removals from the server list.
- Tracks servers that later reappear in the account.
- Supports group DMs.
- Displays notifications directly in Discord.
- Stores history persistently and locally.
- Allows events to be searched by name or ID.
- Allows filtering between servers and group DMs.
- Exports history as JSON or CSV.
- Allows the maximum number of stored events to be configured.

## Detected Events

### Servers

| Event | Description |
| --- | --- |
| Server unavailable | Discord reports the server as temporarily unavailable. |
| Server available again | A previously unavailable server becomes accessible again. |
| Voluntary leave | The plugin detects that the user initiated leaving the server. |
| Voluntary deletion | The owner initiates the deletion of their own server. |
| External removal | The server is removed from the account without a detected voluntary action. |
| Server no longer found | The server remains missing after several consecutive checks. |
| Server added again | A previously removed server reappears in the account. |

### Group DMs

| Event | Description |
| --- | --- |
| Voluntary leave | The plugin detects that the user voluntarily left the group. |
| Removed from group | Discord reports that the account was removed from the participant list. |
| Group no longer available | The group disappears without a cause that can be determined with certainty. |
| Group no longer found | The group remains missing after several checks. |
| Group added again | A previously removed group reappears in the account. |

## Confidence Levels

Each event includes a confidence level describing how reliable the detection is:

- **Confirmed**: the event was reported directly by Discord or intercepted during a voluntary action.
- **Probable**: the available information suggests a likely cause, but Discord does not provide complete confirmation.
- **Possible**: the event was inferred by comparing the previous state with the current state.
- **Undetermined**: there is not enough information to classify the event more accurately.

## Installation

1. Download `HaxurusServerHistory.plugin.js`.
2. Open Discord.
3. Go to **User Settings > BetterDiscord > Plugins**.
4. Select **Open Plugins Folder**.
5. Copy the plugin file into that folder.
6. Return to Discord and enable **Haxurus Server History**.

The plugin does not require any external libraries.

## Usage

Open BetterDiscord settings, go to **Plugins**, and click the settings icon next to **Haxurus Server History**.

From the settings panel, you can:

- enable or disable notifications;
- choose whether to track group DMs;
- choose whether to log temporary outages;
- store between 50 and 10,000 events;
- browse and search the history;
- filter events by entity type;
- export the history as JSON or CSV;
- clear the event history without deleting the list of known entities.

## Stored Data

For each event, the plugin stores:

- date and time;
- entity type;
- server or group name;
- Discord ID;
- event type;
- confidence level;
- event description.

The plugin also keeps a technical archive of known servers and groups. This is required to compare the previous state with the current state.

All data is stored locally through BetterDiscord's storage API. The plugin does not send information to external servers and does not use telemetry services.

## Exporting History

The history can be exported directly from the plugin settings panel.

### JSON

Preserves the complete event structure and is suitable for backups, analysis, or future imports.

### CSV

Can be opened with Excel, LibreOffice Calc, or other compatible applications. The exported columns are:

```text
date, entity_type, id, name, event, confidence, description
```

## Limitations

Discord does not tell the client the exact reason why an account was removed from a server. An external removal may be caused by:

- a kick;
- a ban;
- deletion of the server;
- removal of the account by Discord;
- other server-side changes.

The plugin can reliably distinguish a voluntary leave only when the action is performed while the plugin is running. If Discord or the plugin was closed, the disappearance is detected through later checks and is recorded with a lower confidence level.

The history cannot restore the server, messages, files, channels, or an invitation link. It only preserves a local record of the event and the information that was previously known.

## Compatibility

- BetterDiscord
- Discord desktop client
- Windows, macOS, and Linux, within the compatibility limits provided by BetterDiscord

The plugin uses internal Discord client modules. Future updates to Discord or BetterDiscord may require changes to the plugin code.

## Troubleshooting

### The plugin does not start

Check that:

- BetterDiscord is installed and working;
- the filename ends with `.plugin.js`;
- the plugin was copied to the correct folder;
- the Discord developer console does not show relevant errors.

### A missing server was not recorded

Detection may require several checks to prevent false positives during disconnections, restarts, or temporary Discord issues. Also make sure the plugin was already enabled and had previously detected the server.

### A group DM is not being tracked

Make sure the **Track group DMs** option is enabled in the plugin settings.

## Development

The entire plugin is contained in:

```text
HaxurusServerHistory.plugin.js
```

No build process or additional dependencies are required. After editing the file, reload the plugin or restart Discord.

## Author

Developed by **Haxurus**.

## Disclaimer

This project is not affiliated with, endorsed by, or supported by Discord Inc. or BetterDiscord. The use of unofficial client modifications is at the user's own risk.
