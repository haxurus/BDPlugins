# Advanced Blocked Users

A BetterDiscord plugin that provides a complete and manageable view of Discord's blocked users list.

## Features

- Displays the complete blocked users list instead of a small subset.
- Searches by user ID, username, display name, relationship nickname and nicknames used in mutual servers.
- Sorts by:
  - name, A-Z or Z-A;
  - block date, newest or oldest first;
  - Discord user ID.
- Supports 25, 50, 100, 250 users per page or the entire list at once.
- Copies user IDs.
- Opens user profiles when the required Discord module is available.
- Unblocks users after a confirmation prompt.
- Exports the filtered list to JSON or CSV.
- Automatically uses Italian when Discord is in Italian, otherwise English.
- Updates the list when Discord relationships change.

## Block dates

The plugin first tries to use the date exposed by Discord's `RelationshipStore`.

When Discord does not provide an original date, the plugin stores the first time it detects the blocked relationship locally. A detected date is therefore not guaranteed to be the real historical block date for users who were already blocked before the plugin was installed.

## Installation

1. Download `AdvancedBlockedUsers.plugin.js`.
2. Open Discord settings.
3. Go to **BetterDiscord > Plugins**.
4. Click **Open Plugins Folder**.
5. Move the plugin file into that folder.
6. Enable **AdvancedBlockedUsers**.

## Usage

1. Open **Discord Settings**.
2. Go to **BetterDiscord > Plugins**.
3. Find **AdvancedBlockedUsers**.
4. Open the plugin settings using its settings button.

The plugin uses its own manager instead of directly replacing Discord's native blocked-users component. This reduces the number of elements that can break after Discord interface updates.

## Compatibility note

Discord's internal modules are not a public stable API and may change without notice. The plugin uses feature detection and disables individual actions when their internal module is unavailable.

## Privacy

The plugin does not send data to external services. Preferences and detected dates are stored locally through BetterDiscord's data storage. Exports are created locally on the computer.
