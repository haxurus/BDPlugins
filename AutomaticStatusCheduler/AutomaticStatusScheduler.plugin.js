/**
 * @name AutomaticStatusScheduler
 * @author Haxurus
 * @version 2.0.0
 * @description Adds a Set schedule button to Discord's custom status editor and automatically applies saved status rules.
 */

module.exports = (_ => {
    const changeLog = {};

    return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
        constructor(meta) {
            for (const key in meta) this[key] = meta[key];
        }

        getName() { return this.name; }
        getAuthor() { return this.author; }
        getVersion() { return this.version; }
        getDescription() {
            return `The BDFDB Library Plugin required by ${this.name} is missing. Open the plugin settings to download it.\n\n${this.description}`;
        }

        downloadLibrary() {
            BdApi.Net.fetch("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js")
                .then(response => {
                    if (!response || response.status !== 200) throw new Error("Download failed");
                    return response.text();
                })
                .then(body => {
                    if (!body) throw new Error("Downloaded file was empty");
                    const fs = require("fs");
                    const path = require("path");
                    fs.writeFile(
                        path.join(BdApi.Plugins.folder, "0BDFDB.plugin.js"),
                        body,
                        error => {
                            if (error) {
                                BdApi.UI.showToast("Could not install BDFDB Library.", {type: "error"});
                                return;
                            }
                            BdApi.UI.showToast("BDFDB Library installed. Enable it and reload Discord.", {type: "success"});
                        }
                    );
                })
                .catch(error => {
                    BdApi.Logger.error(this.name, error);
                    BdApi.UI.alert(
                        "Library download failed",
                        "Download BDFDB Library manually from the BetterDiscordAddons website and place it in the plugins folder."
                    );
                });
        }

        load() {
            if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) {
                window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, {pluginQueue: []});
            }

            if (!window.BDFDB_Global.downloadModal) {
                window.BDFDB_Global.downloadModal = true;
                BdApi.UI.showConfirmationModal(
                    "Library missing",
                    `The BDFDB Library Plugin required by ${this.name} is missing.`,
                    {
                        confirmText: "Download now",
                        cancelText: "Cancel",
                        onCancel: () => delete window.BDFDB_Global.downloadModal,
                        onConfirm: () => {
                            delete window.BDFDB_Global.downloadModal;
                            this.downloadLibrary();
                        }
                    }
                );
            }

            if (!window.BDFDB_Global.pluginQueue.includes(this.name)) {
                window.BDFDB_Global.pluginQueue.push(this.name);
            }
        }

        start() { this.load(); }
        stop() {}

        getSettingsPanel() {
            const panel = document.createElement("div");
            panel.style.color = "var(--text-normal)";
            panel.style.padding = "16px";
            panel.innerHTML = `
                <div style="font-size:16px;font-weight:600;margin-bottom:8px;">BDFDB Library is required</div>
                <div style="color:var(--text-muted);margin-bottom:12px;">Install the library to use this plugin.</div>
            `;
            const button = document.createElement("button");
            button.textContent = "Download now";
            button.className = "bd-button bd-button-filled bd-button-color-brand bd-button-medium";
            button.addEventListener("click", () => this.downloadLibrary());
            panel.append(button);
            return panel;
        }
    } : (([Plugin, BDFDB]) => {
        let pluginInstance;
        let pendingCapture = null;
        let captureTimeout = null;

        const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const DAY_LONG_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const STATUS_LABELS = {
            online: "Online",
            idle: "Idle",
            dnd: "Do Not Disturb",
            invisible: "Invisible"
        };

        const DEFAULT_SETTINGS = {
            applyOnStartup: true,
            showNotifications: true,
            schedules: []
        };

        const ScheduleListComponent = class ScheduleList extends BdApi.React.Component {
            constructor(props) {
                super(props);
                this.state = {version: 0};
            }

            renderEmoji(schedule) {
                const emoji = schedule.customStatusEmoji;
                if (!emoji) return null;

                if (emoji.id) {
                    const url = `https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=48&quality=lossless`;
                    return BdApi.React.createElement("img", {
                        src: url,
                        alt: emoji.name || "",
                        style: {
                            width: "24px",
                            height: "24px",
                            objectFit: "contain",
                            flex: "0 0 auto"
                        }
                    });
                }

                return BdApi.React.createElement("span", {
                    style: {fontSize: "22px", lineHeight: 1, flex: "0 0 auto"}
                }, emoji.name || "");
            }

            render() {
                const plugin = this.props.plugin;
                const schedules = plugin.settings.schedules;

                if (!schedules.length) {
                    return BdApi.React.createElement("div", {
                        style: {
                            padding: "18px",
                            borderRadius: "8px",
                            background: "var(--background-secondary)",
                            color: "var(--text-muted)",
                            lineHeight: 1.5
                        }
                    }, "No schedules have been created. Open Discord's custom status editor, prepare the status, and select Set schedule.");
                }

                return BdApi.React.createElement("div", {
                    style: {display: "grid", gap: "10px"}
                }, schedules.map(schedule => {
                    const days = schedule.days.map(day => DAY_LABELS[day]).join(", ");
                    const statusText = schedule.customStatusText || "Clear custom status";

                    return BdApi.React.createElement("div", {
                        key: schedule.id,
                        style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid var(--background-modifier-accent)",
                            background: "var(--background-secondary)"
                        }
                    }, [
                        this.renderEmoji(schedule),
                        BdApi.React.createElement("div", {
                            key: "content",
                            style: {minWidth: 0, flex: "1 1 auto"}
                        }, [
                            BdApi.React.createElement("div", {
                                key: "name",
                                style: {
                                    color: "var(--header-primary)",
                                    fontWeight: 600,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }
                            }, schedule.name),
                            BdApi.React.createElement("div", {
                                key: "details",
                                style: {
                                    color: "var(--text-muted)",
                                    fontSize: "12px",
                                    marginTop: "3px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }
                            }, `${schedule.time} · ${days} · ${STATUS_LABELS[schedule.status]}`),
                            BdApi.React.createElement("div", {
                                key: "status",
                                style: {
                                    color: "var(--text-normal)",
                                    fontSize: "13px",
                                    marginTop: "5px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                }
                            }, statusText)
                        ]),
                        BdApi.React.createElement("button", {
                            key: "delete",
                            type: "button",
                            children: "Delete",
                            style: {
                                flex: "0 0 auto",
                                border: 0,
                                borderRadius: "6px",
                                padding: "8px 12px",
                                background: "var(--status-danger)",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: 600
                            },
                            onClick: () => {
                                BdApi.UI.showConfirmationModal(
                                    "Delete schedule",
                                    `Delete “${schedule.name}”?`,
                                    {
                                        danger: true,
                                        confirmText: "Delete",
                                        cancelText: "Cancel",
                                        onConfirm: () => {
                                            plugin.deleteSchedule(schedule.id);
                                            this.setState({version: this.state.version + 1});
                                        }
                                    }
                                );
                            }
                        })
                    ]);
                }));
            }
        };

        return class AutomaticStatusScheduler extends Plugin {
            onLoad() {
                pluginInstance = this;
                this.settings = structuredClone(DEFAULT_SETTINGS);
                this.timer = null;
                this.startupTimer = null;
                this.isChecking = false;
                this.lastAppliedKey = null;
                this.lastErrorToastAt = 0;
                this.statusSetting = null;

                this.modulePatches = {
                    before: ["ModalRoot"],
                    after: ["CustomStatusModalWithPreview"]
                };

                this.css = `
                    .hass-schedule-form {
                        display: grid;
                        gap: 14px;
                        color: var(--text-normal);
                    }
                    .hass-schedule-field {
                        display: grid;
                        gap: 6px;
                    }
                    .hass-schedule-label {
                        color: var(--header-secondary);
                        font-size: 12px;
                        font-weight: 700;
                        text-transform: uppercase;
                    }
                    .hass-schedule-input,
                    .hass-schedule-select {
                        width: 100%;
                        box-sizing: border-box;
                        padding: 10px 12px;
                        border: 1px solid var(--background-modifier-accent);
                        border-radius: 6px;
                        background: var(--input-background, var(--background-tertiary));
                        color: var(--text-normal);
                        outline: none;
                    }
                    .hass-schedule-days {
                        display: grid;
                        grid-template-columns: repeat(7, minmax(0, 1fr));
                        gap: 6px;
                    }
                    .hass-schedule-day {
                        border: 1px solid var(--background-modifier-accent);
                        border-radius: 6px;
                        padding: 8px 4px;
                        background: var(--background-secondary);
                        color: var(--text-muted);
                        cursor: pointer;
                        font-weight: 600;
                    }
                    .hass-schedule-day-selected {
                        background: var(--brand-500);
                        border-color: var(--brand-500);
                        color: white;
                    }
                    .hass-status-preview {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 10px 12px;
                        border-radius: 6px;
                        background: var(--background-secondary);
                        min-width: 0;
                    }
                    .hass-status-preview img {
                        width: 28px;
                        height: 28px;
                        object-fit: contain;
                        flex: 0 0 auto;
                    }
                    .hass-status-preview-text {
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                `;
            }

            onStart() {
                this.loadSettings();

                const settingsStore = BDFDB.DiscordUtils.getSettingsStore();
                if (settingsStore) {
                    BDFDB.PatchUtils.patch(this, settingsStore, "updateAsync", {
                        after: event => this.captureCustomStatusUpdate(event)
                    });
                }

                this.startupTimer = setTimeout(() => {
                    if (this.settings.applyOnStartup) this.checkSchedule(true);
                }, 2500);

                this.timer = setInterval(() => this.checkSchedule(false), 15000);
                this.forceUpdateAll();
            }

            onStop() {
                if (this.timer) clearInterval(this.timer);
                if (this.startupTimer) clearTimeout(this.startupTimer);
                if (captureTimeout) clearTimeout(captureTimeout);
                this.timer = null;
                this.startupTimer = null;
                captureTimeout = null;
                pendingCapture = null;
                this.forceUpdateAll();
            }

            loadSettings() {
                const saved = BdApi.Data.load(this.name, "settings") || {};
                this.settings = {
                    ...structuredClone(DEFAULT_SETTINGS),
                    ...saved,
                    schedules: Array.isArray(saved.schedules)
                        ? saved.schedules.map(item => this.normalizeSchedule(item))
                        : []
                };
                this.saveSettings();
            }

            saveSettings() {
                BdApi.Data.save(this.name, "settings", this.settings);
            }

            normalizeSchedule(item = {}) {
                const days = Array.isArray(item.days)
                    ? [...new Set(item.days.map(Number).filter(day => day >= 0 && day <= 6))]
                    : [0, 1, 2, 3, 4, 5, 6];

                const status = Object.prototype.hasOwnProperty.call(STATUS_LABELS, item.status)
                    ? item.status
                    : "online";

                const emojiSource = item.customStatusEmoji ?? item.customEmoji ?? item.emoji ?? item.emojiInfo ?? null;
                const emoji = this.normalizeEmoji(emojiSource);
                const text = String(item.customStatusText ?? item.customText ?? item.text ?? "").trim().slice(0, 128);

                return {
                    id: String(item.id || this.createId()),
                    name: String(item.name || text || "Scheduled status").trim().slice(0, 80) || "Scheduled status",
                    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(item.time)) ? String(item.time) : "09:00",
                    status,
                    customStatusText: text,
                    customStatusEmoji: emoji,
                    days: days.length ? days.sort((a, b) => a - b) : [new Date().getDay()],
                    enabled: item.enabled !== false
                };
            }

            normalizeEmoji(value) {
                if (!value) return null;

                if (typeof value === "string") {
                    const customMatch = /^<(a?):([A-Za-z0-9_]+):(\d+)>$/.exec(value.trim());
                    if (customMatch) {
                        return {
                            id: customMatch[3],
                            name: customMatch[2],
                            animated: customMatch[1] === "a"
                        };
                    }
                    return value.trim() ? {id: null, name: value.trim().slice(0, 64), animated: false} : null;
                }

                const id = String(value.id ?? value.emojiId ?? value.emoji_id ?? "").trim();
                const name = String(value.name ?? value.emojiName ?? value.emoji_name ?? value.unicode ?? "").trim();
                if (!id && !name) return null;

                return {
                    id: id && id !== "0" ? id : null,
                    name: name.slice(0, 64),
                    animated: Boolean(value.animated)
                };
            }

            createId() {
                if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
                return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            }

            getDefaultTime() {
                const date = new Date(Date.now() + 60 * 60 * 1000);
                date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
                if (date.getMinutes() === 60) {
                    date.setHours(date.getHours() + 1, 0, 0, 0);
                }
                return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
            }

            findStatusSetting() {
                const isStatusSetting = setting => setting &&
                    typeof setting === "object" &&
                    setting.userSettingsAPIGroup === "status" &&
                    setting.userSettingsAPIName === "status" &&
                    typeof setting.getSetting === "function" &&
                    typeof setting.updateSetting === "function";

                if (isStatusSetting(this.statusSetting)) return this.statusSetting;
                const found = BdApi.Webpack.getModule(isStatusSetting, {searchExports: true});
                if (found) this.statusSetting = found;
                return found || null;
            }

            getCurrentPresence() {
                try {
                    const setting = this.findStatusSetting();
                    const value = setting?.getSetting?.();
                    return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value) ? value : "online";
                }
                catch (_) {
                    return "online";
                }
            }

            captureCustomStatusUpdate(event) {
                if (!pendingCapture || event.methodArguments[0] !== "status") return;

                const nextSettings = {value: undefined};
                try {
                    event.methodArguments[1](nextSettings);
                }
                catch (error) {
                    BdApi.Logger.error(this.name, "Could not read the custom status update.", error);
                    return;
                }

                if (!Object.prototype.hasOwnProperty.call(nextSettings, "customStatus")) return;

                const request = pendingCapture;
                pendingCapture = null;
                if (captureTimeout) clearTimeout(captureTimeout);
                captureTimeout = null;

                const status = nextSettings.customStatus || {};
                const captured = {
                    text: String(status.text || "").trim().slice(0, 128),
                    emoji: this.normalizeEmoji({
                        id: status.emojiId,
                        name: status.emojiName
                    })
                };

                setTimeout(() => {
                    if (request.cancelled) return;
                    this.openScheduleModal(captured);
                }, 0);
            }

            requestScheduleCapture(saveAction, modalInstance, event) {
                if (!saveAction || typeof saveAction.onClick !== "function") {
                    BdApi.UI.showToast("The custom status save action could not be found.", {type: "error"});
                    return;
                }

                pendingCapture = {requestedAt: Date.now(), cancelled: false};
                if (captureTimeout) clearTimeout(captureTimeout);
                captureTimeout = setTimeout(() => {
                    if (!pendingCapture) return;
                    pendingCapture.cancelled = true;
                    pendingCapture = null;
                    BdApi.UI.showToast("The custom status could not be read. Reopen the status editor and try again.", {type: "error"});
                }, 5000);

                try {
                    saveAction.onClick(event);
                    if (!event?.shiftKey) modalInstance?.props?.onClose?.();
                }
                catch (error) {
                    pendingCapture = null;
                    if (captureTimeout) clearTimeout(captureTimeout);
                    captureTimeout = null;
                    BdApi.Logger.error(this.name, error);
                    BdApi.UI.showToast("The custom status could not be saved.", {type: "error"});
                }
            }

            openScheduleModal(capturedStatus) {
                const React = BdApi.React;
                const initialName = capturedStatus.text || (capturedStatus.emoji ? `${capturedStatus.emoji.name} status` : "Scheduled status");
                const draft = {
                    name: initialName.slice(0, 80),
                    time: this.getDefaultTime(),
                    status: this.getCurrentPresence(),
                    days: [0, 1, 2, 3, 4, 5, 6]
                };

                const plugin = this;

                function ScheduleForm() {
                    const [name, setName] = React.useState(draft.name);
                    const [time, setTime] = React.useState(draft.time);
                    const [presence, setPresence] = React.useState(draft.status);
                    const [days, setDays] = React.useState(draft.days);

                    const toggleDay = day => {
                        let next;
                        if (days.includes(day)) {
                            if (days.length === 1) return;
                            next = days.filter(value => value !== day);
                        }
                        else {
                            next = [...days, day].sort((a, b) => a - b);
                        }
                        draft.days = next;
                        setDays(next);
                    };

                    const emojiElement = capturedStatus.emoji
                        ? capturedStatus.emoji.id
                            ? React.createElement("img", {
                                src: `https://cdn.discordapp.com/emojis/${capturedStatus.emoji.id}.webp?size=64&quality=lossless`,
                                alt: capturedStatus.emoji.name || ""
                            })
                            : React.createElement("span", {style: {fontSize: "26px"}}, capturedStatus.emoji.name)
                        : null;

                    return React.createElement("div", {className: "hass-schedule-form"}, [
                        React.createElement("div", {key: "preview", className: "hass-status-preview"}, [
                            emojiElement,
                            React.createElement("div", {
                                key: "text",
                                className: "hass-status-preview-text",
                                style: {color: capturedStatus.text ? "var(--text-normal)" : "var(--text-muted)"}
                            }, capturedStatus.text || "This rule will clear the custom status.")
                        ]),
                        React.createElement("label", {key: "name", className: "hass-schedule-field"}, [
                            React.createElement("span", {key: "label", className: "hass-schedule-label"}, "Rule name"),
                            React.createElement("input", {
                                key: "input",
                                className: "hass-schedule-input",
                                value: name,
                                maxLength: 80,
                                onChange: inputEvent => {
                                    draft.name = inputEvent.target.value;
                                    setName(inputEvent.target.value);
                                }
                            })
                        ]),
                        React.createElement("div", {
                            key: "time-presence",
                            style: {display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}
                        }, [
                            React.createElement("label", {key: "time", className: "hass-schedule-field"}, [
                                React.createElement("span", {key: "label", className: "hass-schedule-label"}, "Time"),
                                React.createElement("input", {
                                    key: "input",
                                    type: "time",
                                    className: "hass-schedule-input",
                                    value: time,
                                    onChange: inputEvent => {
                                        draft.time = inputEvent.target.value;
                                        setTime(inputEvent.target.value);
                                    }
                                })
                            ]),
                            React.createElement("label", {key: "presence", className: "hass-schedule-field"}, [
                                React.createElement("span", {key: "label", className: "hass-schedule-label"}, "Presence"),
                                React.createElement("select", {
                                    key: "select",
                                    className: "hass-schedule-select",
                                    value: presence,
                                    onChange: inputEvent => {
                                        draft.status = inputEvent.target.value;
                                        setPresence(inputEvent.target.value);
                                    }
                                }, Object.entries(STATUS_LABELS).map(([value, label]) => React.createElement("option", {
                                    key: value,
                                    value
                                }, label)))
                            ])
                        ]),
                        React.createElement("div", {key: "days", className: "hass-schedule-field"}, [
                            React.createElement("span", {key: "label", className: "hass-schedule-label"}, "Days"),
                            React.createElement("div", {key: "buttons", className: "hass-schedule-days"}, DAY_LABELS.map((label, day) => React.createElement("button", {
                                key: day,
                                type: "button",
                                title: DAY_LONG_LABELS[day],
                                className: `hass-schedule-day${days.includes(day) ? " hass-schedule-day-selected" : ""}`,
                                onClick: () => toggleDay(day)
                            }, label)))
                        ])
                    ]);
                }

                BdApi.UI.showConfirmationModal(
                    "Schedule this status",
                    React.createElement(ScheduleForm),
                    {
                        confirmText: "Create schedule",
                        cancelText: "Cancel",
                        onConfirm: () => {
                            const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time) ? draft.time : this.getDefaultTime();
                            const schedule = this.normalizeSchedule({
                                id: this.createId(),
                                name: draft.name.trim() || capturedStatus.text || "Scheduled status",
                                time,
                                status: draft.status,
                                customStatusText: capturedStatus.text,
                                customStatusEmoji: capturedStatus.emoji,
                                days: draft.days,
                                enabled: true
                            });

                            this.settings.schedules.push(schedule);
                            this.saveSettings();
                            BdApi.UI.showToast(`Schedule created for ${schedule.time}.`, {type: "success"});
                        }
                    }
                );
            }

            processModalRoot(event) {
                if (!BDFDB.ReactUtils.findChild(event.instance, {
                    props: [["className", BDFDB.disCN.customstatusmodalprofilepreview]]
                })) return;

                event.instance.props.size = BDFDB.LibraryComponents.ModalComponents.ModalSize.MEDIUM;
            }

            processCustomStatusModalWithPreview(event) {
                const actions = event.returnvalue?.props?.actions;
                if (!Array.isArray(actions) || !actions.length) return;
                if (actions.some(action => action?.hassScheduleAction)) return;

                const saveAction = actions[actions.length - 1];
                actions.splice(-1, 0, {
                    hassScheduleAction: true,
                    text: "Set schedule",
                    onClick: clickEvent => this.requestScheduleCapture(saveAction, event.instance, clickEvent)
                });
            }

            getSettingsPanel() {
                const list = BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsPanelList, {
                    title: "Scheduled statuses",
                    dividerTop: true,
                    children: BDFDB.ReactUtils.createElement(ScheduleListComponent, {
                        plugin: this
                    })
                });

                const help = BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextElement, {
                    style: {marginBottom: "14px", color: "var(--text-muted)", lineHeight: 1.5},
                    children: "Create schedules from Discord's custom status editor. These settings are intentionally read-only except for deleting rules."
                });

                return BDFDB.PluginUtils.createSettingsPanel(this, [help, list]);
            }

            deleteSchedule(id) {
                this.settings.schedules = this.settings.schedules.filter(schedule => schedule.id !== id);
                this.saveSettings();
                BdApi.UI.showToast("Schedule deleted.", {type: "success"});
            }

            getMostRecentSchedule(now) {
                let winner = null;

                for (const schedule of this.settings.schedules) {
                    if (!schedule.enabled || !schedule.days.length) continue;
                    const [hours, minutes] = schedule.time.split(":").map(Number);

                    for (let offset = 0; offset <= 7; offset++) {
                        const candidate = new Date(now);
                        candidate.setHours(0, 0, 0, 0);
                        candidate.setDate(candidate.getDate() - offset);

                        if (!schedule.days.includes(candidate.getDay())) continue;
                        candidate.setHours(hours, minutes, 0, 0);
                        if (candidate > now) continue;

                        if (!winner || candidate > winner.date) {
                            winner = {schedule, date: candidate};
                        }
                        break;
                    }
                }

                return winner;
            }

            makeOccurrenceKey(occurrence) {
                return [
                    occurrence.schedule.id,
                    occurrence.date.getTime(),
                    occurrence.schedule.status,
                    occurrence.schedule.customStatusText,
                    occurrence.schedule.customStatusEmoji?.id || "",
                    occurrence.schedule.customStatusEmoji?.name || ""
                ].join(":");
            }

            async checkSchedule(force = false) {
                if (this.isChecking) return;
                const occurrence = this.getMostRecentSchedule(new Date());
                if (!occurrence) return;

                const key = this.makeOccurrenceKey(occurrence);
                if (!force && key === this.lastAppliedKey) return;

                this.isChecking = true;
                try {
                    await this.applySchedule(occurrence.schedule);
                    this.lastAppliedKey = key;

                    if (this.settings.showNotifications) {
                        BdApi.UI.showToast(`Applied schedule: ${occurrence.schedule.name}.`, {type: "success"});
                    }
                }
                catch (error) {
                    BdApi.Logger.error(this.name, error);
                    const now = Date.now();
                    if (now - this.lastErrorToastAt > 60000) {
                        this.lastErrorToastAt = now;
                        BdApi.UI.showToast(`Could not apply the scheduled status: ${error?.message || error}`, {
                            type: "error",
                            timeout: 7000
                        });
                    }
                }
                finally {
                    this.isChecking = false;
                }
            }

            async applySchedule(schedule) {
                const emoji = this.normalizeEmoji(schedule.customStatusEmoji);

                BDFDB.DiscordUtils.setSetting("status", "status", schedule.status);
                BDFDB.DiscordUtils.setSetting("status", "customStatus", {
                    text: schedule.customStatusText || "",
                    expiresAtMs: "0",
                    emojiId: emoji?.id || "0",
                    emojiName: emoji?.name || ""
                });
            }

            forceUpdateAll() {
                this.loadSettings();
                BDFDB.PatchUtils.forceAllUpdates(this);
            }
        };
    })(window.BDFDB_Global.PluginUtils.buildPlugin(changeLog));
})();
