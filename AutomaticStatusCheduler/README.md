# Automatic Status Scheduler

A BetterDiscord plugin that lets you schedule Discord presence and custom status changes directly from Discord's native custom status editor.

Instead of recreating Discord's emoji picker or maintaining a separate status editor, the plugin captures the status you already prepared in Discord - including Unicode emoji, custom server emoji, animated emoji, and text - and turns it into a recurring schedule.

## Features

- Creates scheduled status rules from Discord's native custom status editor.
- Uses Discord's own emoji picker, including custom and animated server emoji.
- Schedules rules for specific times and days of the week.
- Supports the following Discord presence states:
  - Online
  - Idle
  - Do Not Disturb
  - Invisible
- Applies both presence and custom status together.
- Supports status text, emoji-only statuses, and clearing the custom status.
- Automatically checks for scheduled changes every 15 seconds.
- Restores the most recent applicable rule after Discord starts.
- Attempts to migrate compatible rules created with older plugin versions.
- Keeps the settings page simple: schedules can be reviewed and deleted there.

## Requirements

- Discord Desktop
- [BetterDiscord](https://betterdiscord.app/)
- `0BDFDB.plugin.js` - the BDFDB Library Plugin by DevilBro

The plugin can offer to download the BDFDB Library automatically when it is missing. After installing the library, enable it and reload Discord.

## Installation

1. Download `HaxurusAutomaticStatusScheduler.plugin.js`.
2. Open Discord.
3. Go to **User Settings → BetterDiscord → Plugins**.
4. Select **Open Plugins Folder**.
5. Copy `HaxurusAutomaticStatusScheduler.plugin.js` into that folder.
6. Install and enable `0BDFDB.plugin.js` if requested.
7. Enable **Haxurus Automatic Status Scheduler**.
8. Reload Discord if the plugin or library does not start immediately.

## Creating a schedule

1. Open Discord's normal **Set Custom Status** window.
2. Choose an emoji using Discord's native emoji picker.
3. Enter the custom status text.
4. Select **Set schedule** instead of the normal save button.
5. Configure the rule:
   - **Rule name** - a descriptive name for the schedule.
   - **Time** - the local time at which the rule should become active.
   - **Presence** - Online, Idle, Do Not Disturb, or Invisible.
   - **Days** - the days of the week on which the rule applies.
6. Select **Create schedule**.

The status prepared in Discord is saved immediately when **Set schedule** is selected. The scheduling window then opens using the emoji and text captured from that saved status.

## Managing schedules

Open:

**User Settings → BetterDiscord → Plugins → Haxurus Automatic Status Scheduler → Settings**

The settings page shows every saved schedule with:

- Rule name
- Scheduled time
- Selected days
- Presence state
- Custom status text
- Custom status emoji

Use **Delete** to permanently remove a rule.

Schedules cannot currently be edited from the settings page. To change a rule, delete it and create a new one from Discord's custom status editor.

Deleting a rule does not automatically clear a status that has already been applied.

## Scheduling behavior

The plugin evaluates schedules using the computer's local date and time.

When several rules exist, the rule with the most recent valid occurrence is applied. Once applied, that status remains active until another scheduled rule becomes more recent.

### Example

| Rule | Days | Time | Result |
|---|---|---:|---|
| Working | Monday–Friday | 09:00 | Do Not Disturb + `Working` |
| Evening | Monday–Friday | 18:00 | Online + `Available` |
| Weekend | Saturday–Sunday | 10:00 | Idle + `Weekend` |

At 14:00 on Tuesday, **Working** is the most recent rule. At 20:00, **Evening** becomes the active rule.

## Startup and missed changes

When Discord starts, the plugin looks for the most recent applicable schedule and applies it after a short startup delay.

This also helps when:

- Discord was closed at the scheduled time.
- The computer was asleep.
- The plugin was temporarily disabled.

The plugin does not require Discord to be open at the exact scheduled minute. It applies the latest valid rule when it resumes checking.

## Custom status handling

Each schedule stores:

- Custom status text
- Emoji name
- Emoji ID for custom server emoji
- Presence state
- Time and selected days

Custom and animated emoji are captured from Discord's native status editor. When the rule runs, Discord determines the correct emoji asset from its ID.

Scheduled custom statuses are applied without an automatic expiration time. They remain active until another rule or a manual status change replaces them.

A rule with no text and no emoji clears the current custom status while still applying the selected presence state.

## Data storage

Schedules are stored locally through BetterDiscord's plugin data API.

The plugin does not:

- Read or store your Discord authentication token.
- Send schedule data to an external service.
- Require the separate `CustomStatusPresets` plugin to remain installed.

Removing the plugin file does not necessarily remove its saved BetterDiscord data. Delete your schedules first if you also want to remove the stored rules.

## Troubleshooting

### The BDFDB Library is missing

Install and enable `0BDFDB.plugin.js`, then reload Discord.

### The Set schedule button does not appear

- Confirm that both the scheduler and BDFDB Library are enabled.
- Reload Discord with `Ctrl + R`.
- Fully close Discord from the system tray and reopen it.
- Check whether a recent Discord update changed the custom status window.

### The custom status could not be read

Reopen Discord's custom status editor, select the emoji and text again, and press **Set schedule**.

### A scheduled status was not applied

- Confirm that Discord and BetterDiscord are running.
- Verify the computer's date, time, and time zone.
- Check that the rule uses the intended days.
- Reload Discord and wait a few seconds for the startup check.
- Open the Developer Console and look for messages containing `HaxurusAutomaticStatusScheduler`.

### A custom emoji is no longer displayed

The emoji may have been deleted, renamed, or become unavailable to the account. Recreate the schedule using an emoji currently available in Discord's native picker.

## Compatibility notes

BetterDiscord plugins rely on Discord's internal modules and interface components. Discord updates may temporarily break the **Set schedule** integration or status application until the plugin is updated.

The plugin is intended for the official Discord desktop client with BetterDiscord installed. Browser and mobile clients are not supported.

## Credits

- **Haxurus** - plugin author
- **DevilBro** - BDFDB Library and the `CustomStatusPresets` workflow that inspired the native custom-status capture approach
- **BetterDiscord** - plugin platform and API

## Disclaimer

This is an unofficial third-party plugin and is not affiliated with or endorsed by Discord Inc. Use BetterDiscord and third-party plugins at your own discretion.
