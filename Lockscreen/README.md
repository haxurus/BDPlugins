# Haxurus Lockscreen

A BetterDiscord plugin that adds a local lockscreen to Discord using a PIN, password, or Android-style pattern.

**Haxurus Lockscreen** can automatically protect the Discord interface when the client starts or after a configurable period of inactivity. It can also be activated manually from Discord or with a keyboard shortcut.

## Features

- Locks Discord when the client starts.
- Automatically locks Discord after a configurable inactivity period.
- Supports four unlock methods:
  - 4-digit PIN;
  - 6-digit PIN;
  - password;
  - Android-style 3x3 pattern.
- Provides a manual lock button in the lower-right corner.
- Supports the `Ctrl + Shift + L` keyboard shortcut.
- Temporarily blocks additional attempts after five incorrect credentials.
- Allows the inactivity and temporary lockout durations to be configured.
- Stores only a derived credential verifier and a random salt.
- Uses a custom lockscreen interface without replacing Discord's internal pages.
- Does not display a clock or date on the lockscreen.
- Does not require external libraries.

## Unlock Methods

| Method | Requirements |
| --- | --- |
| 4-digit PIN | Exactly 4 numeric digits. |
| 6-digit PIN | Exactly 6 numeric digits. |
| Password | At least 4 characters. |
| Pattern | At least 4 points on the 3x3 grid. |

The selected credential must be entered twice when it is configured or changed.

## Installation

1. Download `Lockscreen.plugin.js`.
2. Open Discord.
3. Go to **User Settings > BetterDiscord > Plugins**.
4. Select **Open Plugins Folder**.
5. Copy the plugin file into that folder.
6. Return to Discord and enable **Lockscreen**.
7. Open the plugin settings and configure an unlock method.

The plugin does not require any external libraries.

## Usage

Open BetterDiscord settings, go to **Plugins**, and click the settings icon next to **Lockscreen**.

From the settings panel, you can:

- select and configure the unlock method;
- replace the current credential;
- enable or disable locking at startup;
- set the inactivity delay from 0 to 1,440 minutes;
- set the temporary lockout duration from 0 to 3,600 seconds;
- enable or disable the manual lock button;
- enable or disable the `Ctrl + Shift + L` shortcut;
- lock Discord immediately;
- remove the configured credential.

Setting the inactivity delay to `0` disables automatic locking for inactivity. Setting the lockout duration to `0` disables the waiting period after five incorrect attempts.

## Locking Behavior

### Startup

When **Lock at startup** is enabled, the lockscreen appears shortly after Discord and the plugin have loaded.

If Discord was closed or the plugin was stopped while the lockscreen was active, the locked state is preserved and restored when the plugin starts again.

### Inactivity

The inactivity timer is reset by activity inside Discord, including mouse movement, mouse clicks, keyboard input, scrolling, touch input, and pointer input.

The plugin does not lock Discord merely because the window loses focus, is minimized, or the user switches to another application.

### Manual Lock

Discord can be locked manually using:

- the lock button displayed in the lower-right corner;
- the **Lock now** button in the plugin settings;
- the `Ctrl + Shift + L` keyboard shortcut.

## Failed Attempts and Lockout

After an incorrect credential, the lockscreen shows how many attempts remain.

After five consecutive incorrect attempts, new attempts are temporarily disabled for the configured number of seconds. The counter is reset after the lockout begins or after Discord is successfully unlocked.

## Credential Storage

The original PIN, password, or pattern is not stored directly.

The plugin stores locally:

- the selected unlock method;
- a random 16-byte salt;
- a PBKDF2-SHA-256 verifier generated with 210,000 iterations;
- plugin preferences;
- the current locked or unlocked state.

The verifier is compared locally when the user attempts to unlock Discord. The plugin does not send credentials, settings, or usage data to external services and does not use telemetry.

## Security Limitations

Haxurus Lockscreen provides a local visual privacy layer. It is not equivalent to operating-system account security, device encryption, or a separate encrypted Discord session.

A person with sufficient access to the computer may bypass the lockscreen by:

- disabling BetterDiscord;
- disabling or removing the plugin;
- deleting or modifying the plugin's stored data;
- modifying the plugin source code;
- accessing Discord through another client or browser;
- accessing local Discord data outside the visible interface.

Use the operating system's screen lock when leaving the computer unattended and protect the device account with a strong password or PIN.

## Compatibility

- BetterDiscord
- Discord desktop client
- Windows, macOS, and Linux, within the compatibility limits provided by BetterDiscord

Browser and mobile Discord clients are not supported.

The plugin uses BetterDiscord's public plugin API and a standalone DOM overlay. Future Discord or BetterDiscord updates may still require changes to the plugin.

## Troubleshooting

### The lockscreen does not appear at startup

Check that:

- an unlock credential has been configured;
- **Lock at startup** is enabled;
- the plugin is enabled and loaded without errors.

### Discord does not lock after inactivity

Check that:

- the inactivity value is greater than `0`;
- an unlock credential has been configured;
- activity is not continuously being generated inside the Discord window.

### The manual lock button is missing

Make sure that:

- **Show lock button** is enabled;
- an unlock credential has been configured.

### The shortcut does not work

Make sure **Ctrl + Shift + L shortcut** is enabled. Another application or plugin may intercept the same keyboard combination.

### The credential was forgotten

The plugin cannot recover the original credential because it is not stored in plaintext. Disable the plugin or remove its stored settings, then configure a new credential.

## Development

The entire plugin is contained in:

```text
Lockscreen.plugin.js
```

No build process or additional dependencies are required. After editing the file, reload the plugin or restart Discord.

## Author

Developed by **Haxurus**.

## Disclaimer

This project is not affiliated with, endorsed by, or supported by Discord Inc. or BetterDiscord. The use of unofficial client modifications and third-party plugins is at the user's own risk.