/**
 * @name AdvancedBlockedUsers
 * @author Haxurus
 * @version 1.0.0
 * @description A searchable, sortable and exportable manager for Discord blocked users.
 */

const PLUGIN_NAME = "AdvancedBlockedUsers";

const DEFAULT_SETTINGS = Object.freeze({
    sort: "blocked-desc",
    pageSize: "50"
});

const STYLES = `
.abu-root {
    color: var(--text-normal);
    font-family: var(--font-primary, sans-serif);
    min-width: 0;
}

.abu-header {
    margin-bottom: 16px;
}

.abu-title {
    color: var(--header-primary);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.3;
    margin: 0 0 4px;
}

.abu-subtitle,
.abu-note,
.abu-summary,
.abu-meta,
.abu-pagination-label {
    color: var(--text-muted);
}

.abu-subtitle,
.abu-note {
    font-size: 13px;
    line-height: 1.45;
}

.abu-toolbar {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(180px, 240px) minmax(110px, 150px);
    gap: 10px;
    margin: 14px 0 10px;
}

.abu-toolbar-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.abu-export-group,
.abu-pagination,
.abu-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.abu-input,
.abu-select {
    width: 100%;
    box-sizing: border-box;
    min-height: 36px;
    border: 1px solid var(--input-border, transparent);
    border-radius: 4px;
    background: var(--input-background, var(--background-tertiary));
    color: var(--text-normal);
    padding: 8px 10px;
    outline: none;
}

.abu-input:focus,
.abu-select:focus {
    border-color: var(--brand-experiment, var(--brand-500));
}

.abu-button {
    appearance: none;
    border: 0;
    border-radius: 4px;
    min-height: 32px;
    padding: 6px 10px;
    background: var(--button-secondary-background, var(--background-modifier-selected));
    color: var(--button-secondary-text, var(--text-normal));
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
}

.abu-button:hover:not(:disabled) {
    background: var(--button-secondary-background-hover, var(--background-modifier-hover));
}

.abu-button:disabled {
    cursor: not-allowed;
    opacity: .45;
}

.abu-button-primary {
    background: var(--button-positive-background, var(--green-360));
    color: var(--white-500, #fff);
}

.abu-button-primary:hover:not(:disabled) {
    background: var(--button-positive-background-hover, var(--green-330));
}

.abu-button-danger {
    background: var(--button-danger-background, var(--red-400));
    color: var(--white-500, #fff);
}

.abu-button-danger:hover:not(:disabled) {
    background: var(--button-danger-background-hover, var(--red-430));
}

.abu-summary {
    font-size: 13px;
}

.abu-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: min(62vh, 720px);
    overflow-y: auto;
    padding-right: 4px;
}

.abu-row {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 11px;
    border: 1px solid var(--background-modifier-accent);
    border-radius: 8px;
    background: var(--background-secondary);
}

.abu-avatar,
.abu-avatar-fallback {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    flex: 0 0 auto;
}

.abu-avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--brand-experiment, var(--brand-500));
    color: #fff;
    font-size: 18px;
    font-weight: 700;
}

.abu-user-content {
    min-width: 0;
}

.abu-name-line {
    display: flex;
    align-items: baseline;
    gap: 7px;
    min-width: 0;
    margin-bottom: 3px;
}

.abu-display-name {
    color: var(--header-primary);
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.abu-username {
    color: var(--text-muted);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.abu-meta {
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.abu-meta strong {
    color: var(--text-normal);
    font-weight: 600;
}

.abu-empty,
.abu-error {
    padding: 26px 16px;
    text-align: center;
    border: 1px dashed var(--background-modifier-accent);
    border-radius: 8px;
    color: var(--text-muted);
}

.abu-error {
    color: var(--text-danger, var(--red-400));
}

.abu-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
}

.abu-pagination-label {
    font-size: 12px;
}

@media (max-width: 760px) {
    .abu-toolbar {
        grid-template-columns: 1fr;
    }

    .abu-row {
        grid-template-columns: 40px minmax(0, 1fr);
    }

    .abu-avatar,
    .abu-avatar-fallback {
        width: 40px;
        height: 40px;
    }

    .abu-actions {
        grid-column: 1 / -1;
        justify-content: flex-end;
    }

    .abu-footer {
        align-items: flex-start;
        flex-direction: column;
    }
}
`;

const STRINGS = {
    it: {
        title: "Gestione avanzata utenti bloccati",
        subtitle: "Cerca, ordina, esporta e gestisci l'intera lista degli utenti bloccati.",
        searchPlaceholder: "Cerca per nome, username, nickname o ID...",
        sortNameAsc: "Nome: A-Z",
        sortNameDesc: "Nome: Z-A",
        sortBlockedDesc: "Bloccati più recenti",
        sortBlockedAsc: "Bloccati meno recenti",
        sortIdAsc: "ID crescente",
        sortIdDesc: "ID decrescente",
        pageSize25: "25 per pagina",
        pageSize50: "50 per pagina",
        pageSize100: "100 per pagina",
        pageSize250: "250 per pagina",
        pageSizeAll: "Mostra tutti",
        refresh: "Aggiorna",
        exportJson: "Esporta JSON",
        exportCsv: "Esporta CSV",
        totalSummary: "{total} bloccati - {filtered} risultati",
        pageSummary: "Pagina {page} di {pages}",
        firstPage: "Prima",
        previousPage: "Indietro",
        nextPage: "Avanti",
        lastPage: "Ultima",
        empty: "Non risultano utenti bloccati.",
        noResults: "Nessun utente corrisponde alla ricerca.",
        unavailable: "Discord non ha reso disponibile la lista degli utenti bloccati.",
        unknownUser: "Utente sconosciuto",
        id: "ID",
        relationshipNickname: "Nickname relazione",
        serverNicknames: "Nickname nei server",
        blockedAt: "Bloccato il",
        detectedAt: "Rilevato dal plugin il",
        dateUnavailable: "Data non disponibile",
        copyId: "Copia ID",
        profile: "Profilo",
        unblock: "Sblocca",
        copied: "ID copiato negli appunti.",
        copyFailed: "Impossibile copiare l'ID.",
        profileUnavailable: "Apertura del profilo non disponibile in questa versione di Discord.",
        confirmTitle: "Sbloccare l'utente?",
        confirmBody: "Vuoi davvero sbloccare {name}?",
        confirm: "Sblocca",
        cancel: "Annulla",
        unblockSuccess: "Utente sbloccato.",
        unblockFailed: "Impossibile sbloccare l'utente.",
        exportSuccess: "Esportazione completata.",
        exportFailed: "Impossibile esportare la lista.",
        note: "Le date vengono lette da Discord quando disponibili. In assenza del dato originale, viene mostrato il primo rilevamento effettuato dal plugin.",
        unknown: "Sconosciuto"
    },
    en: {
        title: "Advanced blocked users manager",
        subtitle: "Search, sort, export and manage the complete blocked users list.",
        searchPlaceholder: "Search by name, username, nickname or ID...",
        sortNameAsc: "Name: A-Z",
        sortNameDesc: "Name: Z-A",
        sortBlockedDesc: "Most recently blocked",
        sortBlockedAsc: "Least recently blocked",
        sortIdAsc: "ID ascending",
        sortIdDesc: "ID descending",
        pageSize25: "25 per page",
        pageSize50: "50 per page",
        pageSize100: "100 per page",
        pageSize250: "250 per page",
        pageSizeAll: "Show all",
        refresh: "Refresh",
        exportJson: "Export JSON",
        exportCsv: "Export CSV",
        totalSummary: "{total} blocked - {filtered} results",
        pageSummary: "Page {page} of {pages}",
        firstPage: "First",
        previousPage: "Previous",
        nextPage: "Next",
        lastPage: "Last",
        empty: "There are no blocked users.",
        noResults: "No users match the search.",
        unavailable: "Discord did not expose the blocked users list.",
        unknownUser: "Unknown user",
        id: "ID",
        relationshipNickname: "Relationship nickname",
        serverNicknames: "Server nicknames",
        blockedAt: "Blocked on",
        detectedAt: "Detected by the plugin on",
        dateUnavailable: "Date unavailable",
        copyId: "Copy ID",
        profile: "Profile",
        unblock: "Unblock",
        copied: "ID copied to clipboard.",
        copyFailed: "Could not copy the ID.",
        profileUnavailable: "Opening profiles is unavailable in this Discord version.",
        confirmTitle: "Unblock user?",
        confirmBody: "Do you really want to unblock {name}?",
        confirm: "Unblock",
        cancel: "Cancel",
        unblockSuccess: "User unblocked.",
        unblockFailed: "Could not unblock the user.",
        exportSuccess: "Export completed.",
        exportFailed: "Could not export the list.",
        note: "Dates are read from Discord when available. When the original date is missing, the first detection made by the plugin is shown.",
        unknown: "Unknown"
    }
};

module.exports = class AdvancedBlockedUsers {
    constructor() {
        this.api = new BdApi(PLUGIN_NAME);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, this.api.Data.load("settings") || {});
        this.history = this.api.Data.load("history") || {};
        this.panels = new Set();
        this.currentBlockedIds = new Set();
        this.started = false;
        this.handleRelationshipChange = this.handleRelationshipChange.bind(this);
    }

    start() {
        this.resolveModules();
        BdApi.DOM.addStyle(PLUGIN_NAME, STYLES);
        this.started = true;

        if (!this.relationshipStore || typeof this.relationshipStore.getBlockedIDs !== "function") {
            this.api.UI.showToast("AdvancedBlockedUsers: RelationshipStore unavailable.", {type: "error"});
            return;
        }

        this.captureRelationshipState(true);
        this.relationshipStore.addChangeListener?.(this.handleRelationshipChange);
    }

    stop() {
        this.started = false;
        this.relationshipStore?.removeChangeListener?.(this.handleRelationshipChange);
        BdApi.DOM.removeStyle(PLUGIN_NAME);
        this.panels.clear();
    }

    getSettingsPanel() {
        if (!this.relationshipStore) this.resolveModules();
        if (this.relationshipStore && this.currentBlockedIds.size === 0) this.captureRelationshipState(true);
        return this.buildManagerPanel();
    }

    resolveModules() {
        const {Webpack} = BdApi;
        this.relationshipStore = Webpack.getStore("RelationshipStore");
        this.userStore = Webpack.getStore("UserStore");
        this.guildStore = Webpack.getStore("GuildStore");
        this.guildMemberStore = Webpack.getStore("GuildMemberStore");
        this.relationshipActions = Webpack.getByKeys("addRelationship", "removeRelationship")
            || Webpack.getByKeys("removeRelationship");
        this.profileActions = Webpack.getByKeys("openUserProfileModal");
    }

    getLanguage() {
        const locale = (document.documentElement.lang || navigator.language || "en").toLowerCase();
        return locale.startsWith("it") ? "it" : "en";
    }

    getStrings() {
        return STRINGS[this.getLanguage()];
    }

    interpolate(text, variables) {
        return text.replace(/\{(\w+)\}/g, (_, key) => String(variables[key] ?? ""));
    }

    loadBlockedIds() {
        if (!this.relationshipStore?.getBlockedIDs) return [];
        try {
            const ids = this.relationshipStore.getBlockedIDs();
            if (Array.isArray(ids)) return ids.map(String);
            if (ids instanceof Set) return Array.from(ids, String);
            if (ids && typeof ids[Symbol.iterator] === "function") return Array.from(ids, String);
            return [];
        }
        catch (error) {
            console.error(`[${PLUGIN_NAME}] Failed to load blocked IDs`, error);
            return [];
        }
    }

    captureRelationshipState(startup = false) {
        const now = Date.now();
        const ids = new Set(this.loadBlockedIds());
        let changed = false;

        for (const id of ids) {
            const existing = this.history[id];
            const wasAlreadyBlocked = existing?.isCurrentlyBlocked === true;

            if (!existing) {
                this.history[id] = {
                    firstSeenAt: now,
                    currentDetectedAt: now,
                    detectedOnStartup: startup,
                    isCurrentlyBlocked: true,
                    blockCount: 1,
                    lastUnblockedAt: null
                };
                changed = true;
            }
            else if (!wasAlreadyBlocked) {
                existing.currentDetectedAt = now;
                existing.detectedOnStartup = startup;
                existing.isCurrentlyBlocked = true;
                existing.blockCount = Math.max(1, Number(existing.blockCount) || 0) + 1;
                changed = true;
            }
        }

        for (const [id, entry] of Object.entries(this.history)) {
            if (entry?.isCurrentlyBlocked && !ids.has(id)) {
                entry.isCurrentlyBlocked = false;
                entry.lastUnblockedAt = now;
                changed = true;
            }
        }

        this.currentBlockedIds = ids;
        if (changed) this.api.Data.save("history", this.history);
    }

    handleRelationshipChange() {
        this.captureRelationshipState(false);
        this.refreshPanels();
    }

    refreshPanels() {
        for (const root of Array.from(this.panels)) {
            if (!root.isConnected) {
                this.panels.delete(root);
                continue;
            }
            root.__abuRefresh?.();
        }
    }

    getDiscordSince(userId) {
        try {
            let value = this.relationshipStore?.getSince?.(userId);
            if (value == null && this.relationshipStore?.getSinces) {
                const all = this.relationshipStore.getSinces();
                value = all instanceof Map ? all.get(userId) : all?.[userId];
            }
            return this.normalizeTimestamp(value);
        }
        catch {
            return null;
        }
    }

    normalizeTimestamp(value) {
        if (value == null || value === "") return null;
        if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;

        if (typeof value === "number") {
            const milliseconds = value < 100000000000 ? value * 1000 : value;
            return Number.isFinite(milliseconds) ? milliseconds : null;
        }

        if (typeof value === "string") {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && value.trim() !== "") return this.normalizeTimestamp(numeric);
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) ? parsed : null;
        }

        if (typeof value === "object") {
            return this.normalizeTimestamp(value.timestamp ?? value.since ?? value.date ?? value.value);
        }

        return null;
    }

    getGuildNicknames(userId) {
        if (!this.guildStore?.getGuilds || !this.guildMemberStore?.getNick) return [];
        const result = new Set();

        try {
            const guilds = this.guildStore.getGuilds() || {};
            for (const guildId of Object.keys(guilds)) {
                const nickname = this.guildMemberStore.getNick(guildId, userId);
                if (typeof nickname === "string" && nickname.trim()) result.add(nickname.trim());
            }
        }
        catch (error) {
            console.debug(`[${PLUGIN_NAME}] Could not collect all guild nicknames`, error);
        }

        return Array.from(result);
    }

    getUserRecord(userId) {
        const user = this.userStore?.getUser?.(userId) || null;
        const relationshipNickname = this.relationshipStore?.getNickname?.(userId) || "";
        const serverNicknames = this.getGuildNicknames(userId);
        const username = user?.username || "";
        const discriminator = user?.discriminator && user.discriminator !== "0" ? user.discriminator : "";
        const tag = username ? `${username}${discriminator ? `#${discriminator}` : ""}` : "";
        const displayName = user?.globalName || user?.displayName || relationshipNickname || username || "";
        const discordSince = this.getDiscordSince(userId);
        const detectedSince = this.normalizeTimestamp(this.history[userId]?.currentDetectedAt);
        const blockedAt = discordSince ?? detectedSince;
        const blockedAtSource = discordSince != null ? "discord" : detectedSince != null ? "detected" : "unknown";

        return {
            id: userId,
            user,
            username,
            discriminator,
            tag,
            displayName,
            relationshipNickname,
            serverNicknames,
            blockedAt,
            blockedAtSource,
            searchText: this.normalizeSearch([
                userId,
                username,
                tag,
                displayName,
                user?.globalName,
                relationshipNickname,
                ...serverNicknames
            ].filter(Boolean).join(" "))
        };
    }

    normalizeSearch(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase(this.getLanguage());
    }

    getFilteredRecords(query, sort) {
        const terms = this.normalizeSearch(query).split(/\s+/).filter(Boolean);
        const records = this.loadBlockedIds().map(id => this.getUserRecord(id));
        const filtered = terms.length
            ? records.filter(record => terms.every(term => record.searchText.includes(term)))
            : records;

        const locale = this.getLanguage() === "it" ? "it-IT" : "en-US";
        const compareText = (a, b) => a.localeCompare(b, locale, {sensitivity: "base", numeric: true});
        const compareId = (a, b) => {
            if (a.length !== b.length) return a.length - b.length;
            return a.localeCompare(b);
        };
        const compareDate = (a, b, direction) => {
            const aKnown = Number.isFinite(a.blockedAt);
            const bKnown = Number.isFinite(b.blockedAt);
            if (aKnown && !bKnown) return -1;
            if (!aKnown && bKnown) return 1;
            if (!aKnown && !bKnown) return compareText(a.displayName || a.username || a.id, b.displayName || b.username || b.id);
            return direction * (a.blockedAt - b.blockedAt);
        };

        filtered.sort((a, b) => {
            switch (sort) {
                case "name-desc":
                    return -compareText(a.displayName || a.username || a.id, b.displayName || b.username || b.id);
                case "blocked-asc":
                    return compareDate(a, b, 1);
                case "blocked-desc":
                    return compareDate(a, b, -1);
                case "id-asc":
                    return compareId(a.id, b.id);
                case "id-desc":
                    return -compareId(a.id, b.id);
                case "name-asc":
                default:
                    return compareText(a.displayName || a.username || a.id, b.displayName || b.username || b.id);
            }
        });

        return filtered;
    }

    buildManagerPanel() {
        const t = this.getStrings();
        const root = this.createElement("div", "abu-root");
        const state = {
            query: "",
            sort: this.settings.sort,
            pageSize: this.settings.pageSize,
            page: 1
        };

        const header = this.createElement("div", "abu-header");
        header.append(
            this.createElement("h2", "abu-title", t.title),
            this.createElement("div", "abu-subtitle", t.subtitle)
        );

        const toolbar = this.createElement("div", "abu-toolbar");
        const search = this.createElement("input", "abu-input");
        search.type = "search";
        search.placeholder = t.searchPlaceholder;
        search.autocomplete = "off";

        const sort = this.createSelect([
            ["name-asc", t.sortNameAsc],
            ["name-desc", t.sortNameDesc],
            ["blocked-desc", t.sortBlockedDesc],
            ["blocked-asc", t.sortBlockedAsc],
            ["id-asc", t.sortIdAsc],
            ["id-desc", t.sortIdDesc]
        ], state.sort);

        const pageSize = this.createSelect([
            ["25", t.pageSize25],
            ["50", t.pageSize50],
            ["100", t.pageSize100],
            ["250", t.pageSize250],
            ["all", t.pageSizeAll]
        ], state.pageSize);

        toolbar.append(search, sort, pageSize);

        const secondary = this.createElement("div", "abu-toolbar-secondary");
        const summary = this.createElement("div", "abu-summary");
        const exportGroup = this.createElement("div", "abu-export-group");
        const refreshButton = this.createButton(t.refresh, () => {
            this.captureRelationshipState(false);
            render();
        });
        const jsonButton = this.createButton(t.exportJson, () => this.exportRecords("json", state.query, state.sort));
        const csvButton = this.createButton(t.exportCsv, () => this.exportRecords("csv", state.query, state.sort));
        exportGroup.append(refreshButton, jsonButton, csvButton);
        secondary.append(summary, exportGroup);

        const list = this.createElement("div", "abu-list");
        const footer = this.createElement("div", "abu-footer");
        const note = this.createElement("div", "abu-note", t.note);
        const pagination = this.createElement("div", "abu-pagination");
        const firstButton = this.createButton(t.firstPage, () => {
            state.page = 1;
            render();
        });
        const previousButton = this.createButton(t.previousPage, () => {
            state.page = Math.max(1, state.page - 1);
            render();
        });
        const pageLabel = this.createElement("span", "abu-pagination-label");
        const nextButton = this.createButton(t.nextPage, () => {
            state.page += 1;
            render();
        });
        const lastButton = this.createButton(t.lastPage, () => {
            state.page = Number.MAX_SAFE_INTEGER;
            render();
        });
        pagination.append(firstButton, previousButton, pageLabel, nextButton, lastButton);
        footer.append(note, pagination);

        root.append(header, toolbar, secondary, list, footer);

        search.addEventListener("input", () => {
            state.query = search.value;
            state.page = 1;
            render();
        });

        sort.addEventListener("change", () => {
            state.sort = sort.value;
            state.page = 1;
            this.settings.sort = state.sort;
            this.saveSettings();
            render();
        });

        pageSize.addEventListener("change", () => {
            state.pageSize = pageSize.value;
            state.page = 1;
            this.settings.pageSize = state.pageSize;
            this.saveSettings();
            render();
        });

        const render = () => {
            list.replaceChildren();

            if (!this.relationshipStore?.getBlockedIDs) {
                list.append(this.createElement("div", "abu-error", t.unavailable));
                summary.textContent = "";
                pagination.hidden = true;
                return;
            }

            const allIds = this.loadBlockedIds();
            const records = this.getFilteredRecords(state.query, state.sort);
            const pageSizeValue = state.pageSize === "all" ? Math.max(1, records.length) : Math.max(1, Number(state.pageSize) || 50);
            const pages = Math.max(1, Math.ceil(records.length / pageSizeValue));
            state.page = Math.min(Math.max(1, state.page), pages);
            const start = state.pageSize === "all" ? 0 : (state.page - 1) * pageSizeValue;
            const visibleRecords = state.pageSize === "all" ? records : records.slice(start, start + pageSizeValue);

            summary.textContent = this.interpolate(t.totalSummary, {
                total: allIds.length,
                filtered: records.length
            });

            if (allIds.length === 0) {
                list.append(this.createElement("div", "abu-empty", t.empty));
            }
            else if (records.length === 0) {
                list.append(this.createElement("div", "abu-empty", t.noResults));
            }
            else {
                const fragment = document.createDocumentFragment();
                for (const record of visibleRecords) fragment.append(this.buildUserRow(record, render));
                list.append(fragment);
            }

            const paginated = state.pageSize !== "all" && records.length > pageSizeValue;
            pagination.hidden = !paginated;
            pageLabel.textContent = this.interpolate(t.pageSummary, {page: state.page, pages});
            firstButton.disabled = state.page <= 1;
            previousButton.disabled = state.page <= 1;
            nextButton.disabled = state.page >= pages;
            lastButton.disabled = state.page >= pages;
        };

        root.__abuRefresh = render;
        this.panels.add(root);
        render();
        return root;
    }

    buildUserRow(record, rerender) {
        const t = this.getStrings();
        const row = this.createElement("div", "abu-row");
        row.dataset.userId = record.id;

        const avatar = this.buildAvatar(record);
        const content = this.createElement("div", "abu-user-content");
        const nameLine = this.createElement("div", "abu-name-line");
        const displayName = this.createElement("span", "abu-display-name", record.displayName || t.unknownUser);
        const username = this.createElement("span", "abu-username", record.tag ? `@${record.tag}` : "");
        nameLine.append(displayName, username);

        const meta = this.createElement("div", "abu-meta");
        meta.append(this.buildMetaLine(t.id, record.id));
        if (record.relationshipNickname) meta.append(this.buildMetaLine(t.relationshipNickname, record.relationshipNickname));
        if (record.serverNicknames.length) meta.append(this.buildMetaLine(t.serverNicknames, record.serverNicknames.join(", ")));

        if (record.blockedAt) {
            const label = record.blockedAtSource === "discord" ? t.blockedAt : t.detectedAt;
            meta.append(this.buildMetaLine(label, this.formatDate(record.blockedAt)));
        }
        else {
            meta.append(this.buildMetaLine(t.blockedAt, t.dateUnavailable));
        }

        content.append(nameLine, meta);

        const actions = this.createElement("div", "abu-actions");
        const copyButton = this.createButton(t.copyId, () => this.copyId(record.id));
        const profileButton = this.createButton(t.profile, () => this.openProfile(record.id));
        profileButton.disabled = !this.profileActions?.openUserProfileModal;
        const unblockButton = this.createButton(t.unblock, () => this.confirmUnblock(record, rerender), "abu-button-danger");
        unblockButton.disabled = !this.relationshipActions?.removeRelationship;
        actions.append(copyButton, profileButton, unblockButton);

        row.append(avatar, content, actions);
        return row;
    }

    buildAvatar(record) {
        const initial = (record.displayName || record.username || "?").trim().charAt(0).toUpperCase() || "?";
        const fallback = this.createElement("div", "abu-avatar-fallback", initial);
        const url = this.getAvatarUrl(record.user);
        if (!url) return fallback;

        const image = this.createElement("img", "abu-avatar");
        image.alt = "";
        image.loading = "lazy";
        image.src = url;
        image.addEventListener("error", () => image.replaceWith(fallback), {once: true});
        return image;
    }

    getAvatarUrl(user) {
        if (!user) return null;
        try {
            if (typeof user.getAvatarURL === "function") return user.getAvatarURL(null, 64, true);
        }
        catch {}

        if (user.avatar && user.id) {
            const extension = String(user.avatar).startsWith("a_") ? "gif" : "png";
            return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=64`;
        }
        return null;
    }

    buildMetaLine(label, value) {
        const line = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = `${label}: `;
        line.append(strong, document.createTextNode(String(value)));
        return line;
    }

    createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text != null) element.textContent = String(text);
        return element;
    }

    createButton(text, onClick, additionalClass = "") {
        const button = this.createElement("button", `abu-button ${additionalClass}`.trim(), text);
        button.type = "button";
        button.addEventListener("click", onClick);
        return button;
    }

    createSelect(options, value) {
        const select = this.createElement("select", "abu-select");
        for (const [optionValue, label] of options) {
            const option = document.createElement("option");
            option.value = optionValue;
            option.textContent = label;
            option.selected = optionValue === value;
            select.append(option);
        }
        return select;
    }

    saveSettings() {
        this.api.Data.save("settings", this.settings);
    }

    formatDate(timestamp) {
        const locale = this.getLanguage() === "it" ? "it-IT" : "en-US";
        try {
            return new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short"
            }).format(new Date(timestamp));
        }
        catch {
            return new Date(timestamp).toLocaleString(locale);
        }
    }

    async copyId(userId) {
        const t = this.getStrings();
        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(userId);
            else {
                const textarea = document.createElement("textarea");
                textarea.value = userId;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.append(textarea);
                textarea.select();
                document.execCommand("copy");
                textarea.remove();
            }
            this.api.UI.showToast(t.copied, {type: "success"});
        }
        catch (error) {
            console.error(`[${PLUGIN_NAME}] Copy failed`, error);
            this.api.UI.showToast(t.copyFailed, {type: "error"});
        }
    }

    openProfile(userId) {
        const t = this.getStrings();
        const action = this.profileActions?.openUserProfileModal;
        if (typeof action !== "function") {
            this.api.UI.showToast(t.profileUnavailable, {type: "warning"});
            return;
        }

        try {
            action.call(this.profileActions, {userId});
        }
        catch (firstError) {
            try {
                action.call(this.profileActions, userId);
            }
            catch (secondError) {
                console.error(`[${PLUGIN_NAME}] Could not open profile`, firstError, secondError);
                this.api.UI.showToast(t.profileUnavailable, {type: "error"});
            }
        }
    }

    confirmUnblock(record, rerender) {
        const t = this.getStrings();
        const name = record.displayName || record.tag || record.id;
        const body = this.interpolate(t.confirmBody, {name});

        this.api.UI.showConfirmationModal(t.confirmTitle, body, {
            danger: true,
            confirmText: t.confirm,
            cancelText: t.cancel,
            onConfirm: async () => {
                try {
                    await Promise.resolve(this.relationshipActions.removeRelationship(record.id, {
                        location: "Advanced Blocked Users"
                    }));
                    this.captureRelationshipState(false);
                    rerender?.();
                    this.api.UI.showToast(t.unblockSuccess, {type: "success"});
                }
                catch (error) {
                    console.error(`[${PLUGIN_NAME}] Unblock failed`, error);
                    this.api.UI.showToast(t.unblockFailed, {type: "error"});
                }
            }
        });
    }

    exportRecords(format, query, sort) {
        const t = this.getStrings();
        try {
            const records = this.getFilteredRecords(query, sort).map(record => ({
                id: record.id,
                username: record.username || null,
                discriminator: record.discriminator || null,
                displayName: record.displayName || null,
                relationshipNickname: record.relationshipNickname || null,
                serverNicknames: record.serverNicknames,
                blockedAt: record.blockedAt ? new Date(record.blockedAt).toISOString() : null,
                blockedAtSource: record.blockedAtSource
            }));

            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            if (format === "json") {
                const payload = JSON.stringify({
                    exportedAt: new Date().toISOString(),
                    count: records.length,
                    users: records
                }, null, 2);
                this.downloadText(`blocked-users-${stamp}.json`, payload, "application/json;charset=utf-8");
            }
            else {
                const headers = [
                    "id",
                    "username",
                    "discriminator",
                    "displayName",
                    "relationshipNickname",
                    "serverNicknames",
                    "blockedAt",
                    "blockedAtSource"
                ];
                const rows = records.map(record => headers.map(key => {
                    const value = key === "serverNicknames" ? record[key].join(" | ") : record[key];
                    return this.escapeCsv(value);
                }).join(";"));
                const csv = `\uFEFF${headers.join(";")}\r\n${rows.join("\r\n")}`;
                this.downloadText(`blocked-users-${stamp}.csv`, csv, "text/csv;charset=utf-8");
            }
            this.api.UI.showToast(t.exportSuccess, {type: "success"});
        }
        catch (error) {
            console.error(`[${PLUGIN_NAME}] Export failed`, error);
            this.api.UI.showToast(t.exportFailed, {type: "error"});
        }
    }

    escapeCsv(value) {
        const text = value == null ? "" : String(value);
        return `"${text.replace(/"/g, '""')}"`;
    }

    downloadText(filename, content, type) {
        const blob = new Blob([content], {type});
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = "none";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
};
