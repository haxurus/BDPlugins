/**
 * @name ServerHistory
 * @author Haxurus
 * @description Keeps a persistent history of Discord servers and group DMs that become unavailable or from which the account is removed.
 * @version 1.1.0
 */

module.exports = class ServerHistory {
    constructor(meta) {
        this.meta = meta;
        this.api = new BdApi(meta.name);

        this.defaults = {
            notifications: true,
            trackGroups: true,
            trackUnavailable: true,
            maxEntries: 1000,
            reconciliationInterval: 15,
            missingChecksRequired: 3
        };

        this.settings = {...this.defaults};
        this.history = [];
        this.knownGuilds = {};
        this.knownGroups = {};
        this.missingGuildChecks = new Map();
        this.missingGroupChecks = new Map();
        this.manualGuildActions = new Map();
        this.manualGroupActions = new Map();
        this.subscriptions = [];
        this.storeUnsubscribers = [];
        this.timers = new Set();
        this.panelRoots = new Set();
        this.startedAt = 0;
        this.interval = null;
        this.pendingStoreReconcile = null;

        this.onGuildDelete = this.handleGuildDelete.bind(this);
        this.onGuildCreate = this.handleGuildCreate.bind(this);
        this.onGuildUnavailable = this.handleGuildUnavailable.bind(this);
        this.onStoreChange = this.handleStoreChange.bind(this);
        this.onChannelDelete = this.handleChannelDelete.bind(this);
        this.onChannelCreate = this.handleChannelCreate.bind(this);
        this.onChannelUpdate = this.handleChannelUpdate.bind(this);
        this.onRecipientRemove = this.handleRecipientRemove.bind(this);
        this.onRecipientAdd = this.handleRecipientAdd.bind(this);
        this.onConnectionOpen = this.handleConnectionOpen.bind(this);
    }

    start() {
        this.startedAt = Date.now();
        this.loadData();
        this.resolveModules();
        this.addStyles();

        if (!this.GuildStore || !this.ChannelStore) {
            this.api.UI.showToast("Server History: unable to find the required Discord stores.", {type: "error"});
            this.api.Logger.error("Missing Discord stores", {
                GuildStore: Boolean(this.GuildStore),
                ChannelStore: Boolean(this.ChannelStore)
            });
            return;
        }

        this.patchManualActions();
        this.subscribeToEvents();
        this.subscribeToStores();
        this.seedCurrentEntities();
        this.syncUnavailableGuildsFromStore();
        this.scheduleReconciliation(8000);
        this.scheduleReconciliation(20000);

        const seconds = Math.max(10, Number(this.settings.reconciliationInterval) || 15);
        this.interval = setInterval(() => this.reconcile(), seconds * 1000);

        this.api.UI.showToast("Server History is active.", {type: "success"});
    }

    stop() {
        for (const [event, handler] of this.subscriptions) {
            try {
                this.Dispatcher?.unsubscribe?.(event, handler);
            }
            catch (error) {
                this.api.Logger.warn(`Unable to unsubscribe from ${event}`, error);
            }
        }
        this.subscriptions = [];

        for (const unsubscribe of this.storeUnsubscribers) {
            try {
                unsubscribe();
            }
            catch (error) {
                this.api.Logger.warn("Unable to remove a Discord store listener", error);
            }
        }
        this.storeUnsubscribers = [];
        this.pendingStoreReconcile = null;

        if (this.interval) clearInterval(this.interval);
        this.interval = null;

        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();

        this.api.Patcher.unpatchAll();
        this.api.DOM.removeStyle();
        this.panelRoots.clear();
    }

    loadData() {
        try {
            this.settings = Object.assign({}, this.defaults, this.api.Data.load("settings") || {});
            const storedHistory = this.api.Data.load("history");
            this.history = Array.isArray(storedHistory) ? storedHistory : [];
            this.knownGuilds = this.api.Data.load("knownGuilds") || {};
            this.knownGroups = this.api.Data.load("knownGroups") || {};
        }
        catch (error) {
            this.api.Logger.error("Error while loading data", error);
            this.settings = {...this.defaults};
            this.history = [];
            this.knownGuilds = {};
            this.knownGroups = {};
        }

        this.trimHistory();
    }

    resolveModules() {
        const {Webpack} = BdApi;
        const {Filters} = Webpack;

        this.GuildStore = Webpack.getStore("GuildStore");
        this.ChannelStore = Webpack.getStore("ChannelStore");
        this.PrivateChannelSortStore = Webpack.getStore("PrivateChannelSortStore");
        this.UserStore = Webpack.getStore("UserStore");
        this.GatewayConnectionStore = Webpack.getStore("GatewayConnectionStore");
        this.GuildAvailabilityStore = Webpack.getStore("GuildAvailabilityStore");

        this.Dispatcher = Webpack.getModule(
            Filters.byKeys("dispatch", "subscribe", "unsubscribe"),
            {searchExports: true}
        );

        this.GuildActions = Webpack.getModule(
            module => module && (
                typeof module.leaveGuild === "function" ||
                typeof module.deleteGuild === "function"
            ),
            {searchExports: true}
        );

        this.GroupActions = Webpack.getModule(
            module => module && (
                typeof module.leaveGroupDM === "function" ||
                typeof module.leaveGroupDm === "function"
            ),
            {searchExports: true}
        );
    }

    patchManualActions() {
        if (this.GuildActions?.leaveGuild) {
            this.api.Patcher.before(this.GuildActions, "leaveGuild", (_, args) => {
                const guildId = this.extractId(args?.[0]);
                if (guildId) this.manualGuildActions.set(guildId, {type: "manual_leave", at: Date.now()});
            });
        }

        if (this.GuildActions?.deleteGuild) {
            this.api.Patcher.before(this.GuildActions, "deleteGuild", (_, args) => {
                const guildId = this.extractId(args?.[0]);
                if (guildId) this.manualGuildActions.set(guildId, {type: "manual_delete", at: Date.now()});
            });
        }

        const groupMethod = this.GroupActions?.leaveGroupDM
            ? "leaveGroupDM"
            : this.GroupActions?.leaveGroupDm
                ? "leaveGroupDm"
                : null;

        if (groupMethod) {
            this.api.Patcher.before(this.GroupActions, groupMethod, (_, args) => {
                const channelId = this.extractId(args?.[0]);
                if (channelId) this.manualGroupActions.set(channelId, {type: "manual_leave", at: Date.now()});
            });
        }
    }

    subscribeToEvents() {
        if (!this.Dispatcher?.subscribe) {
            this.api.Logger.warn("Discord dispatcher is unavailable: only periodic reconciliation will be used.");
            return;
        }

        const events = [
            ["GUILD_DELETE", this.onGuildDelete],
            ["GUILD_CREATE", this.onGuildCreate],
            ["GUILD_UNAVAILABLE", this.onGuildUnavailable],
            ["CHANNEL_DELETE", this.onChannelDelete],
            ["CHANNEL_CREATE", this.onChannelCreate],
            ["CHANNEL_UPDATE", this.onChannelUpdate],
            ["CHANNEL_RECIPIENT_REMOVE", this.onRecipientRemove],
            ["CHANNEL_RECIPIENT_ADD", this.onRecipientAdd],
            ["CONNECTION_OPEN", this.onConnectionOpen],
            ["CONNECTION_RESUMED", this.onConnectionOpen],
            ["POST_CONNECTION_OPEN", this.onConnectionOpen]
        ];

        for (const [event, handler] of events) {
            try {
                this.Dispatcher.subscribe(event, handler);
                this.subscriptions.push([event, handler]);
            }
            catch (error) {
                this.api.Logger.warn(`Unable to subscribe to ${event}`, error);
            }
        }
    }


    subscribeToStores() {
        const stores = [
            ["GuildStore", this.GuildStore],
            ["GuildAvailabilityStore", this.GuildAvailabilityStore],
            ["ChannelStore", this.ChannelStore],
            ["PrivateChannelSortStore", this.PrivateChannelSortStore]
        ];

        for (const [name, store] of stores) {
            if (typeof store?.addChangeListener !== "function") continue;

            try {
                const returnedUnsubscribe = store.addChangeListener(this.onStoreChange);
                if (typeof returnedUnsubscribe === "function") {
                    this.storeUnsubscribers.push(returnedUnsubscribe);
                }
                else if (typeof store.removeChangeListener === "function") {
                    this.storeUnsubscribers.push(() => store.removeChangeListener(this.onStoreChange));
                }
            }
            catch (error) {
                this.api.Logger.warn(`Unable to subscribe to ${name} changes`, error);
            }
        }
    }

    handleStoreChange() {
        if (this.pendingStoreReconcile) {
            clearTimeout(this.pendingStoreReconcile);
            this.timers.delete(this.pendingStoreReconcile);
        }

        this.pendingStoreReconcile = this.schedule(() => {
            this.pendingStoreReconcile = null;
            this.syncUnavailableGuildsFromStore();
            this.reconcile();
        }, 350);
    }

    seedCurrentEntities() {
        const currentGuilds = this.getCurrentGuilds();
        const currentGroups = this.getCurrentGroups();
        let guildsChanged = false;
        let groupsChanged = false;

        for (const guild of Object.values(currentGuilds)) {
            const previous = this.knownGuilds[guild.id];
            const next = this.guildRecordFromGuild(guild, previous?.status || "active");
            if (!previous) {
                this.knownGuilds[guild.id] = next;
                guildsChanged = true;
            }
            else if (previous.name !== next.name || previous.icon !== next.icon || previous.ownerId !== next.ownerId) {
                this.knownGuilds[guild.id] = {...previous, ...next, status: previous.status};
                guildsChanged = true;
            }
        }

        if (this.settings.trackGroups) {
            for (const group of Object.values(currentGroups)) {
                const previous = this.knownGroups[group.id];
                const next = this.groupRecordFromChannel(group, previous?.status || "active");
                if (!previous) {
                    this.knownGroups[group.id] = next;
                    groupsChanged = true;
                }
                else if (previous.name !== next.name || JSON.stringify(previous.recipientIds) !== JSON.stringify(next.recipientIds)) {
                    this.knownGroups[group.id] = {...previous, ...next, status: previous.status};
                    groupsChanged = true;
                }
            }
        }

        if (guildsChanged) this.saveKnownGuilds();
        if (groupsChanged) this.saveKnownGroups();
    }


    handleGuildUnavailable(event) {
        const guildId = this.extractGuildId(event);
        if (!guildId) return;

        const cachedGuild = this.getGuild(guildId);
        const previous = this.knownGuilds[guildId] || (cachedGuild ? this.guildRecordFromGuild(cachedGuild) : null);
        const name = previous?.name || cachedGuild?.name || `Server ${guildId}`;

        if (this.settings.trackUnavailable && previous?.status !== "unavailable") {
            this.addHistory({
                entityType: "guild",
                entityId: guildId,
                name,
                eventType: "guild_unavailable",
                confidence: "certain",
                description: "Discord reported the server as temporarily unavailable."
            });
        }

        this.knownGuilds[guildId] = {
            ...(previous || {id: guildId, name, firstSeenAt: Date.now()}),
            id: guildId,
            name,
            status: "unavailable",
            unavailableSince: previous?.unavailableSince || Date.now(),
            updatedAt: Date.now()
        };
        this.missingGuildChecks.delete(guildId);
        this.saveKnownGuilds();
    }

    handleGuildDelete(event) {
        const guildId = this.extractGuildId(event);
        if (!guildId) return;

        const unavailable = Boolean(
            event?.unavailable ??
            event?.guild?.unavailable ??
            this.isGuildUnavailable(guildId)
        );
        const cachedGuild = this.getGuild(guildId);
        const previous = this.knownGuilds[guildId] || (cachedGuild ? this.guildRecordFromGuild(cachedGuild) : null);
        const name = previous?.name || cachedGuild?.name || `Server ${guildId}`;

        if (unavailable) {
            this.handleGuildUnavailable({guildId});
            return;
        }

        const manual = this.consumeRecentAction(this.manualGuildActions, guildId);
        let eventType = "guild_removed_external";
        let description = "The server was removed from your account list. Discord does not tell the client whether this was caused by a kick, ban, or server deletion.";
        let confidence = "certain";

        if (manual?.type === "manual_leave") {
            eventType = "guild_left_manually";
            description = "You voluntarily initiated leaving the server.";
        }
        else if (manual?.type === "manual_delete") {
            eventType = "guild_deleted_manually";
            description = "You voluntarily initiated deleting the server.";
        }

        if (previous?.status !== "removed" || manual) {
            this.addHistory({
                entityType: "guild",
                entityId: guildId,
                name,
                eventType,
                confidence,
                description
            });
        }

        this.knownGuilds[guildId] = {
            ...(previous || {id: guildId, name}),
            id: guildId,
            name,
            status: "removed",
            removedAt: Date.now(),
            removalType: eventType
        };
        this.missingGuildChecks.delete(guildId);
        this.saveKnownGuilds();
    }

    handleGuildCreate(event) {
        const guild = event?.guild || event;
        const guildId = this.extractGuildId(event);
        if (!guildId) return;

        const actualGuild = guild?.name ? guild : this.getGuild(guildId);
        const previous = this.knownGuilds[guildId];
        const name = actualGuild?.name || previous?.name || `Server ${guildId}`;
        const unavailable = Boolean(event?.unavailable ?? actualGuild?.unavailable);

        if (unavailable) {
            if (this.settings.trackUnavailable && previous?.status !== "unavailable") {
                this.addHistory({
                    entityType: "guild",
                    entityId: guildId,
                    name,
                    eventType: "guild_unavailable",
                    confidence: "certain",
                    description: "Discord loaded the server as temporarily unavailable."
                });
            }

            this.knownGuilds[guildId] = this.guildRecordFromGuild(actualGuild || {id: guildId, name}, "unavailable");
            this.saveKnownGuilds();
            return;
        }

        if (previous?.status === "unavailable") {
            this.addHistory({
                entityType: "guild",
                entityId: guildId,
                name,
                eventType: "guild_restored",
                confidence: "certain",
                description: "The server is available again."
            });
        }
        else if (previous?.status === "removed") {
            this.addHistory({
                entityType: "guild",
                entityId: guildId,
                name,
                eventType: "guild_rejoined",
                confidence: "certain",
                description: "The server appeared in the account again."
            });
        }

        this.knownGuilds[guildId] = this.guildRecordFromGuild(actualGuild || {id: guildId, name}, "active");
        this.missingGuildChecks.delete(guildId);
        this.saveKnownGuilds();
    }

    handleChannelDelete(event) {
        if (!this.settings.trackGroups) return;

        const channel = event?.channel || event;
        const channelId = this.extractChannelId(event);
        if (!channelId) return;

        const previous = this.knownGroups[channelId];
        const actualChannel = this.isGroupChannel(channel) ? channel : null;
        if (!previous && !actualChannel) return;

        const group = actualChannel || this.getChannel(channelId);
        const name = previous?.name || this.getGroupName(group) || `Group DM ${channelId}`;
        const manual = this.consumeRecentAction(this.manualGroupActions, channelId);
        const eventType = manual ? "group_left_manually" : "group_removed";
        const description = manual
            ? "You voluntarily initiated leaving the group DM."
            : "The group DM is no longer available. You may have been removed, or the group DM may have been deleted.";

        if (previous?.status !== "removed" || manual) {
            this.addHistory({
                entityType: "group",
                entityId: channelId,
                name,
                eventType,
                confidence: manual ? "certain" : "likely",
                description
            });
        }

        this.knownGroups[channelId] = {
            ...(previous || {id: channelId, name}),
            id: channelId,
            name,
            status: "removed",
            removedAt: Date.now(),
            removalType: eventType
        };
        this.missingGroupChecks.delete(channelId);
        this.saveKnownGroups();
    }

    handleChannelCreate(event) {
        if (!this.settings.trackGroups) return;
        const channel = event?.channel || event;
        if (!this.isGroupChannel(channel)) return;

        const previous = this.knownGroups[channel.id];
        const name = this.getGroupName(channel);

        if (previous?.status === "removed") {
            this.addHistory({
                entityType: "group",
                entityId: channel.id,
                name,
                eventType: "group_rejoined",
                confidence: "certain",
                description: "The group DM appeared in the account again."
            });
        }

        this.knownGroups[channel.id] = this.groupRecordFromChannel(channel, "active");
        this.missingGroupChecks.delete(channel.id);
        this.saveKnownGroups();
    }

    handleChannelUpdate(event) {
        if (!this.settings.trackGroups) return;
        const channel = event?.channel || event;
        if (!this.isGroupChannel(channel)) return;

        const previous = this.knownGroups[channel.id];
        this.knownGroups[channel.id] = this.groupRecordFromChannel(channel, previous?.status || "active");
        this.saveKnownGroups();
    }

    handleRecipientRemove(event) {
        if (!this.settings.trackGroups) return;

        const channelId = this.extractChannelId(event);
        const removedUserId = event?.user?.id || event?.userId || event?.user_id;
        const currentUserId = this.UserStore?.getCurrentUser?.()?.id;
        if (!channelId || !removedUserId || removedUserId !== currentUserId) return;

        const previous = this.knownGroups[channelId];
        const channel = this.getChannel(channelId);
        const name = previous?.name || this.getGroupName(channel) || `Group DM ${channelId}`;
        const manual = this.consumeRecentAction(this.manualGroupActions, channelId);

        this.addHistory({
            entityType: "group",
            entityId: channelId,
            name,
            eventType: manual ? "group_left_manually" : "group_self_removed",
            confidence: "certain",
            description: manual
                ? "You voluntarily initiated leaving the group DM."
                : "Your account was removed from the group DM."
        });

        this.knownGroups[channelId] = {
            ...(previous || {id: channelId, name}),
            id: channelId,
            name,
            status: "removed",
            removedAt: Date.now(),
            removalType: manual ? "group_left_manually" : "group_self_removed"
        };
        this.saveKnownGroups();
    }

    handleRecipientAdd(event) {
        if (!this.settings.trackGroups) return;
        const channelId = this.extractChannelId(event);
        if (!channelId) return;
        this.schedule(() => {
            const channel = this.getChannel(channelId);
            if (this.isGroupChannel(channel)) this.handleChannelCreate({channel});
        }, 500);
    }

    handleConnectionOpen() {
        this.schedule(() => this.syncUnavailableGuildsFromStore(), 1500);
        this.scheduleReconciliation(5000);
        this.scheduleReconciliation(15000);
    }

    reconcile() {
        if (!this.isConnected()) return;
        if (Date.now() - this.startedAt < 7000) return;

        this.reconcileGuilds();
        if (this.settings.trackGroups) this.reconcileGroups();
        this.refreshOpenPanels();
    }

    reconcileGuilds() {
        const current = this.getCurrentGuilds();
        const currentIds = new Set(Object.keys(current));
        const unavailableIds = this.getUnavailableGuildIds();
        const knownIds = Object.keys(this.knownGuilds);

        if (knownIds.length > 0 && currentIds.size === 0 && unavailableIds.size === 0) return;

        let changed = false;


        for (const guildId of unavailableIds) {
            if (currentIds.has(guildId)) continue;

            const previous = this.knownGuilds[guildId];
            const name = previous?.name || `Server ${guildId}`;

            if (this.settings.trackUnavailable && previous?.status !== "unavailable") {
                this.addHistory({
                    entityType: "guild",
                    entityId: guildId,
                    name,
                    eventType: "guild_unavailable",
                    confidence: "certain",
                    description: "Discord's availability store indicates that the server is temporarily unavailable."
                });
            }

            if (!previous || previous.status !== "unavailable") {
                this.knownGuilds[guildId] = {
                    ...(previous || {id: guildId, name, firstSeenAt: Date.now()}),
                    id: guildId,
                    name,
                    status: "unavailable",
                    unavailableSince: previous?.unavailableSince || Date.now(),
                    updatedAt: Date.now()
                };
                changed = true;
            }
            this.missingGuildChecks.delete(guildId);
        }

        for (const guild of Object.values(current)) {
            const previous = this.knownGuilds[guild.id];
            const unavailable = this.isGuildUnavailable(guild.id);
            const status = unavailable ? "unavailable" : "active";
            const name = guild.name || previous?.name || `Server ${guild.id}`;

            if (unavailable && this.settings.trackUnavailable && previous?.status !== "unavailable") {
                this.addHistory({
                    entityType: "guild",
                    entityId: guild.id,
                    name,
                    eventType: "guild_unavailable",
                    confidence: "certain",
                    description: "Discord's internal availability check indicates that the server is temporarily unavailable."
                });
            }
            else if (!unavailable && previous?.status === "unavailable") {
                this.addHistory({
                    entityType: "guild",
                    entityId: guild.id,
                    name,
                    eventType: "guild_restored",
                    confidence: "certain",
                    description: "The server is available again."
                });
            }
            else if (!unavailable && previous?.status === "removed") {
                this.addHistory({
                    entityType: "guild",
                    entityId: guild.id,
                    name,
                    eventType: "guild_rejoined",
                    confidence: "certain",
                    description: "The server appeared in the account again."
                });
            }

            const next = this.guildRecordFromGuild(guild, status);
            if (!previous || previous.status !== next.status || previous.name !== next.name || previous.icon !== next.icon) {
                this.knownGuilds[guild.id] = next;
                changed = true;
            }
            this.missingGuildChecks.delete(guild.id);
        }

        const requiredChecks = Math.max(2, Number(this.settings.missingChecksRequired) || 3);
        for (const guildId of knownIds) {
            const previous = this.knownGuilds[guildId];
            if (currentIds.has(guildId) || unavailableIds.has(guildId) || previous.status === "removed") continue;

            const checks = (this.missingGuildChecks.get(guildId) || 0) + 1;
            this.missingGuildChecks.set(guildId, checks);
            if (checks < requiredChecks) continue;

            this.addHistory({
                entityType: "guild",
                entityId: guildId,
                name: previous.name || `Server ${guildId}`,
                eventType: "guild_missing_after_restart",
                confidence: "likely",
                description: "The server no longer appears after several checks while Discord is connected. The removal may have happened while the plugin or Discord was closed."
            });

            this.knownGuilds[guildId] = {
                ...previous,
                status: "removed",
                removedAt: Date.now(),
                removalType: "guild_missing_after_restart"
            };
            this.missingGuildChecks.delete(guildId);
            changed = true;
        }

        if (changed) this.saveKnownGuilds();
    }

    reconcileGroups() {
        const current = this.getCurrentGroups();
        const currentIds = new Set(Object.keys(current));
        const knownIds = Object.keys(this.knownGroups);

        if (knownIds.length > 0 && currentIds.size === 0) return;

        let changed = false;

        for (const group of Object.values(current)) {
            const previous = this.knownGroups[group.id];
            if (previous?.status === "removed") {
                this.addHistory({
                    entityType: "group",
                    entityId: group.id,
                    name: this.getGroupName(group),
                    eventType: "group_rejoined",
                    confidence: "certain",
                    description: "The group DM appeared in the account again."
                });
            }

            const next = this.groupRecordFromChannel(group, "active");
            if (!previous || previous.status !== "active" || previous.name !== next.name || JSON.stringify(previous.recipientIds) !== JSON.stringify(next.recipientIds)) {
                this.knownGroups[group.id] = next;
                changed = true;
            }
            this.missingGroupChecks.delete(group.id);
        }

        const requiredChecks = Math.max(4, Number(this.settings.missingChecksRequired) + 1 || 4);
        for (const groupId of knownIds) {
            const previous = this.knownGroups[groupId];
            if (currentIds.has(groupId) || previous.status === "removed") continue;

            const checks = (this.missingGroupChecks.get(groupId) || 0) + 1;
            this.missingGroupChecks.set(groupId, checks);
            if (checks < requiredChecks) continue;

            this.addHistory({
                entityType: "group",
                entityId: groupId,
                name: previous.name || `Group DM ${groupId}`,
                eventType: "group_missing_after_restart",
                confidence: "possible",
                description: "The group DM is no longer present in the private-message cache after several checks. It may have been deleted, or you may have been removed."
            });

            this.knownGroups[groupId] = {
                ...previous,
                status: "removed",
                removedAt: Date.now(),
                removalType: "group_missing_after_restart"
            };
            this.missingGroupChecks.delete(groupId);
            changed = true;
        }

        if (changed) this.saveKnownGroups();
    }

    getCurrentGuilds() {
        try {
            return this.GuildStore?.getGuilds?.() || {};
        }
        catch (error) {
            this.api.Logger.warn("Error while reading servers", error);
            return {};
        }
    }

    getCurrentGroups() {
        const found = {};

        const addChannel = value => {
            const channel = typeof value === "string" ? this.getChannel(value) : value;
            if (this.isGroupChannel(channel)) found[channel.id] = channel;
        };

        try {
            const mutable = this.ChannelStore?.getMutablePrivateChannels?.();
            if (Array.isArray(mutable)) mutable.forEach(addChannel);
            else if (mutable && typeof mutable === "object") Object.values(mutable).forEach(addChannel);
        }
        catch (error) {
            this.api.Logger.debug("getMutablePrivateChannels is unavailable", error);
        }

        try {
            const sorted = this.ChannelStore?.getSortedPrivateChannels?.();
            if (Array.isArray(sorted)) sorted.forEach(addChannel);
            else if (sorted && typeof sorted === "object") Object.values(sorted).forEach(addChannel);
        }
        catch (error) {
            this.api.Logger.debug("getSortedPrivateChannels is unavailable", error);
        }

        try {
            const ids = this.PrivateChannelSortStore?.getPrivateChannelIds?.();
            if (Array.isArray(ids)) ids.forEach(addChannel);
        }
        catch (error) {
            this.api.Logger.debug("getPrivateChannelIds is unavailable", error);
        }

        return found;
    }

    getGuild(id) {
        try {
            return this.GuildStore?.getGuild?.(id) || this.getCurrentGuilds()?.[id] || null;
        }
        catch (_) {
            return null;
        }
    }

    getChannel(id) {
        try {
            return this.ChannelStore?.getChannel?.(id) || null;
        }
        catch (_) {
            return null;
        }
    }


    getUnavailableGuildIds() {
        const result = new Set();

        try {
            const raw = this.GuildAvailabilityStore?.unavailableGuilds;

            if (Array.isArray(raw)) {
                for (const id of raw) if (id != null) result.add(String(id));
            }
            else if (raw instanceof Set || raw instanceof Map) {
                for (const value of raw instanceof Map ? raw.keys() : raw.values()) {
                    if (value != null) result.add(String(value));
                }
            }
            else if (raw && typeof raw === "object") {
                for (const [id, unavailable] of Object.entries(raw)) {
                    if (unavailable) result.add(String(id));
                }
            }
        }
        catch (error) {
            this.api.Logger.debug("Unable to read unavailable server IDs", error);
        }

        return result;
    }

    syncUnavailableGuildsFromStore() {
        const unavailableIds = this.getUnavailableGuildIds();
        if (unavailableIds.size === 0) return;

        let changed = false;
        for (const guildId of unavailableIds) {
            const previous = this.knownGuilds[guildId];
            const cachedGuild = this.getGuild(guildId);
            const name = previous?.name || cachedGuild?.name || `Server ${guildId}`;

            if (this.settings.trackUnavailable && previous?.status !== "unavailable") {
                this.addHistory({
                    entityType: "guild",
                    entityId: guildId,
                    name,
                    eventType: "guild_unavailable",
                    confidence: "certain",
                    description: "Discord's availability store indicates that the server is temporarily unavailable."
                });
            }

            if (!previous || previous.status !== "unavailable") {
                this.knownGuilds[guildId] = {
                    ...(previous || {id: guildId, name, firstSeenAt: Date.now()}),
                    id: guildId,
                    name,
                    status: "unavailable",
                    unavailableSince: previous?.unavailableSince || Date.now(),
                    updatedAt: Date.now()
                };
                changed = true;
            }
            this.missingGuildChecks.delete(guildId);
        }

        if (changed) this.saveKnownGuilds();
    }

    isGuildUnavailable(id) {
        try {
            if (typeof this.GuildAvailabilityStore?.isUnavailable === "function") {
                return Boolean(this.GuildAvailabilityStore.isUnavailable(id));
            }
            return this.getUnavailableGuildIds().has(String(id));
        }
        catch (_) {
            return false;
        }
    }

    isConnected() {
        try {
            if (typeof this.GatewayConnectionStore?.isConnected === "function") {
                return Boolean(this.GatewayConnectionStore.isConnected());
            }
        }
        catch (_) {}
        return navigator.onLine !== false;
    }

    guildRecordFromGuild(guild, status = "active") {
        return {
            id: String(guild?.id || ""),
            name: guild?.name || `Server ${guild?.id || "unknown"}`,
            icon: guild?.icon || null,
            ownerId: guild?.ownerId || guild?.owner_id || null,
            status,
            firstSeenAt: this.knownGuilds[guild?.id]?.firstSeenAt || Date.now(),
            updatedAt: Date.now()
        };
    }

    groupRecordFromChannel(channel, status = "active") {
        return {
            id: String(channel?.id || ""),
            name: this.getGroupName(channel),
            icon: channel?.icon || null,
            recipientIds: this.getRecipientIds(channel),
            status,
            firstSeenAt: this.knownGroups[channel?.id]?.firstSeenAt || Date.now(),
            updatedAt: Date.now()
        };
    }

    getGroupName(channel) {
        if (!channel) return "Unknown group DM";
        if (typeof channel.name === "string" && channel.name.trim()) return channel.name.trim();

        const users = [];
        if (Array.isArray(channel.rawRecipients)) users.push(...channel.rawRecipients);

        if (users.length === 0 && Array.isArray(channel.recipients)) {
            for (const recipient of channel.recipients) {
                if (typeof recipient === "object" && recipient) users.push(recipient);
                else {
                    const user = this.UserStore?.getUser?.(recipient);
                    if (user) users.push(user);
                }
            }
        }

        const names = users
            .map(user => user?.globalName || user?.displayName || user?.username || user?.id)
            .filter(Boolean);

        return names.length ? `Group DM with ${names.join(", ")}` : `Group DM ${channel.id}`;
    }

    getRecipientIds(channel) {
        const ids = [];
        if (Array.isArray(channel?.recipients)) {
            for (const recipient of channel.recipients) ids.push(String(recipient?.id || recipient));
        }
        else if (Array.isArray(channel?.rawRecipients)) {
            for (const recipient of channel.rawRecipients) if (recipient?.id) ids.push(String(recipient.id));
        }
        return [...new Set(ids)].sort();
    }

    isGroupChannel(channel) {
        return Boolean(channel && (
            channel.type === 3 ||
            channel.type === "GROUP_DM" ||
            channel.type === "GROUP_DM_CHANNEL"
        ));
    }

    extractId(value) {
        if (!value) return null;
        if (typeof value === "string" || typeof value === "number") return String(value);
        return value.id || value.guildId || value.guild_id || value.channelId || value.channel_id || null;
    }

    extractGuildId(event) {
        return String(event?.guildId || event?.guild_id || event?.guild?.id || event?.id || "") || null;
    }

    extractChannelId(event) {
        return String(event?.channelId || event?.channel_id || event?.channel?.id || event?.id || "") || null;
    }

    consumeRecentAction(map, id) {
        const action = map.get(id);
        map.delete(id);
        if (!action || Date.now() - action.at > 30000) return null;
        return action;
    }

    addHistory(entry) {
        const now = Date.now();
        const duplicate = this.history.find(item =>
            item.entityId === entry.entityId &&
            item.eventType === entry.eventType &&
            Math.abs(now - Number(item.timestamp)) < 5000
        );
        if (duplicate) return false;

        const record = {
            id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
            timestamp: now,
            entityType: entry.entityType,
            entityId: String(entry.entityId),
            name: entry.name || "Unknown",
            eventType: entry.eventType,
            confidence: entry.confidence || "unknown",
            description: entry.description || ""
        };

        this.history.unshift(record);
        this.trimHistory();
        this.saveHistory();
        this.notify(record);
        this.refreshOpenPanels();
        return true;
    }

    trimHistory() {
        const max = Math.min(10000, Math.max(50, Number(this.settings.maxEntries) || 1000));
        if (this.history.length > max) this.history = this.history.slice(0, max);
    }

    notify(record) {
        if (!this.settings.notifications) return;
        const label = this.getEventLabel(record.eventType);
        const toastType = record.eventType.includes("restored") || record.eventType.includes("rejoined")
            ? "success"
            : record.eventType.includes("unavailable")
                ? "warning"
                : "error";
        this.api.UI.showToast(`${label}: ${record.name}`, {type: toastType, timeout: 6000});
    }

    saveSettings() {
        this.api.Data.save("settings", this.settings);
    }

    saveHistory() {
        this.api.Data.save("history", this.history);
    }

    saveKnownGuilds() {
        this.api.Data.save("knownGuilds", this.knownGuilds);
    }

    saveKnownGroups() {
        this.api.Data.save("knownGroups", this.knownGroups);
    }

    schedule(callback, delay) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            try {
                callback();
            }
            catch (error) {
                this.api.Logger.error("Error during a scheduled operation", error);
            }
        }, delay);
        this.timers.add(timer);
        return timer;
    }

    scheduleReconciliation(delay) {
        this.schedule(() => this.reconcile(), delay);
    }

    getEventLabel(type) {
        const labels = {
            guild_unavailable: "Server unavailable",
            guild_restored: "Server available again",
            guild_left_manually: "Left server voluntarily",
            guild_deleted_manually: "Server deleted voluntarily",
            guild_removed_external: "Externally removed from server",
            guild_missing_after_restart: "Server no longer found",
            guild_rejoined: "Server rejoined",
            group_left_manually: "Left group DM voluntarily",
            group_self_removed: "Removed from group DM",
            group_removed: "Group DM no longer available",
            group_missing_after_restart: "Group DM no longer found",
            group_rejoined: "Group DM rejoined"
        };
        return labels[type] || type;
    }

    getConfidenceLabel(confidence) {
        const labels = {
            certain: "Confirmed",
            likely: "Likely",
            possible: "Possible",
            unknown: "Undetermined"
        };
        return labels[confidence] || confidence;
    }

    getSettingsPanel() {
        const root = document.createElement("div");
        root.className = "hsh-root";
        this.panelRoots.add(root);

        const header = document.createElement("div");
        header.className = "hsh-header";

        const title = document.createElement("h2");
        title.textContent = "Server and Group DM History";
        const subtitle = document.createElement("p");
        subtitle.textContent = "Keeps a local record even when Discord removes a server or group DM from the interface.";
        header.append(title, subtitle);

        const stats = document.createElement("div");
        stats.className = "hsh-stats";

        const settingsCard = document.createElement("section");
        settingsCard.className = "hsh-card";
        const settingsTitle = document.createElement("h3");
        settingsTitle.textContent = "Settings";
        settingsCard.append(settingsTitle);

        settingsCard.append(
            this.createToggle("Notifications", "Show a notification when an event is recorded.", "notifications"),
            this.createToggle("Track group DMs", "Also record private group DMs and participant removals.", "trackGroups"),
            this.createToggle("Track unavailability", "Record when Discord reports a server as temporarily unavailable.", "trackUnavailable")
        );

        const maxRow = document.createElement("label");
        maxRow.className = "hsh-setting-row";
        const maxText = document.createElement("div");
        maxText.innerHTML = "<strong>Maximum number of events</strong><span>From 50 to 10,000 entries.</span>";
        const maxInput = document.createElement("input");
        maxInput.className = "hsh-number";
        maxInput.type = "number";
        maxInput.min = "50";
        maxInput.max = "10000";
        maxInput.step = "50";
        maxInput.value = String(this.settings.maxEntries);
        maxInput.addEventListener("change", () => {
            this.settings.maxEntries = Math.min(10000, Math.max(50, Number(maxInput.value) || 1000));
            maxInput.value = String(this.settings.maxEntries);
            this.trimHistory();
            this.saveSettings();
            this.saveHistory();
            this.refreshOpenPanels();
        });
        maxRow.append(maxText, maxInput);
        settingsCard.append(maxRow);

        const historyCard = document.createElement("section");
        historyCard.className = "hsh-card";
        const historyHeader = document.createElement("div");
        historyHeader.className = "hsh-history-header";
        const historyTitle = document.createElement("h3");
        historyTitle.textContent = "History";
        historyHeader.append(historyTitle);

        const toolbar = document.createElement("div");
        toolbar.className = "hsh-toolbar";

        const search = document.createElement("input");
        search.className = "hsh-input";
        search.type = "search";
        search.placeholder = "Search by name or ID...";

        const filter = document.createElement("select");
        filter.className = "hsh-select";
        for (const [value, text] of [["all", "All"], ["guild", "Server"], ["group", "Group DMs"]]) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = text;
            filter.append(option);
        }

        const exportJson = this.createButton("Export JSON", "secondary", () => this.exportHistory("json"));
        const exportCsv = this.createButton("Export CSV", "secondary", () => this.exportHistory("csv"));
        const clear = this.createButton("Clear", "danger", () => this.confirmClearHistory());

        toolbar.append(search, filter, exportJson, exportCsv, clear);

        const list = document.createElement("div");
        list.className = "hsh-history-list";

        const info = document.createElement("div");
        info.className = "hsh-info";
        info.textContent = "Note: Discord can reliably distinguish an unavailable server from a server removed from the account, but it does not tell the client whether the removal was caused by a kick, ban, or server deletion. The plugin can identify voluntary departures performed while it is active.";

        historyCard.append(historyHeader, toolbar, list, info);
        root.append(header, stats, settingsCard, historyCard);

        const render = () => {
            this.renderStats(stats);
            this.renderHistory(list, search.value, filter.value);
        };
        root._hshRender = render;

        search.addEventListener("input", render);
        filter.addEventListener("change", render);
        render();

        return root;
    }

    createToggle(title, note, settingKey) {
        const row = document.createElement("label");
        row.className = "hsh-setting-row";

        const text = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = title;
        const span = document.createElement("span");
        span.textContent = note;
        text.append(strong, span);

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "hsh-toggle-input";
        input.checked = Boolean(this.settings[settingKey]);

        const visual = document.createElement("span");
        visual.className = "hsh-toggle";

        input.addEventListener("change", () => {
            this.settings[settingKey] = input.checked;
            this.saveSettings();
            if (settingKey === "trackGroups" && input.checked) this.seedCurrentEntities();
        });

        const control = document.createElement("span");
        control.className = "hsh-toggle-wrap";
        control.append(input, visual);
        row.append(text, control);
        return row;
    }

    createButton(text, variant, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `hsh-button hsh-button-${variant}`;
        button.textContent = text;
        button.addEventListener("click", onClick);
        return button;
    }

    renderStats(container) {
        container.replaceChildren();
        const activeGuilds = Object.values(this.knownGuilds).filter(item => item.status === "active").length;
        const unavailableGuilds = Object.values(this.knownGuilds).filter(item => item.status === "unavailable").length;
        const activeGroups = Object.values(this.knownGroups).filter(item => item.status === "active").length;

        for (const [value, label] of [
            [activeGuilds, "Active servers"],
            [unavailableGuilds, "Unavailable"],
            [activeGroups, "Known group DMs"],
            [this.history.length, "Saved events"]
        ]) {
            const card = document.createElement("div");
            card.className = "hsh-stat";
            const number = document.createElement("strong");
            number.textContent = String(value);
            const text = document.createElement("span");
            text.textContent = label;
            card.append(number, text);
            container.append(card);
        }
    }

    renderHistory(container, query = "", filter = "all") {
        container.replaceChildren();
        const normalized = query.trim().toLocaleLowerCase("en-US");
        const items = this.history.filter(item => {
            if (filter !== "all" && item.entityType !== filter) return false;
            if (!normalized) return true;
            return `${item.name} ${item.entityId} ${this.getEventLabel(item.eventType)}`
                .toLocaleLowerCase("en-US")
                .includes(normalized);
        });

        if (items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "hsh-empty";
            empty.textContent = this.history.length ? "No events match the current filters." : "No events have been recorded.";
            container.append(empty);
            return;
        }

        for (const item of items) {
            const row = document.createElement("article");
            row.className = `hsh-event hsh-event-${item.entityType}`;

            const top = document.createElement("div");
            top.className = "hsh-event-top";

            const name = document.createElement("strong");
            name.textContent = item.name;
            const badge = document.createElement("span");
            badge.className = `hsh-badge hsh-badge-${item.confidence}`;
            badge.textContent = this.getConfidenceLabel(item.confidence);
            top.append(name, badge);

            const eventLabel = document.createElement("div");
            eventLabel.className = "hsh-event-label";
            eventLabel.textContent = this.getEventLabel(item.eventType);

            const description = document.createElement("p");
            description.textContent = item.description;

            const meta = document.createElement("div");
            meta.className = "hsh-event-meta";
            const date = new Date(Number(item.timestamp));
            meta.textContent = `${date.toLocaleString("en-US")} - ID: ${item.entityId}`;

            row.append(top, eventLabel, description, meta);
            container.append(row);
        }
    }

    refreshOpenPanels() {
        for (const root of [...this.panelRoots]) {
            if (!root.isConnected) {
                this.panelRoots.delete(root);
                continue;
            }
            try {
                root._hshRender?.();
            }
            catch (error) {
                this.api.Logger.warn("Error while refreshing the panel", error);
            }
        }
    }

    confirmClearHistory() {
        this.api.UI.showConfirmationModal(
            "Clear history?",
            "This removes all saved events while preserving the list of known servers and group DMs.",
            {
                confirmText: "Clear",
                cancelText: "Cancel",
                danger: true,
                onConfirm: () => {
                    this.history = [];
                    this.saveHistory();
                    this.refreshOpenPanels();
                    this.api.UI.showToast("History cleared.", {type: "success"});
                }
            }
        );
    }

    async exportHistory(format) {
        try {
            const extension = format === "csv" ? "csv" : "json";
            const now = new Date().toISOString().replace(/[:.]/g, "-");
            const defaultPath = `discord-server-history-${now}.${extension}`;
            const result = await this.api.UI.openDialog({
                mode: "save",
                title: `Export history as ${extension.toUpperCase()}`,
                defaultPath,
                filters: [{name: extension.toUpperCase(), extensions: [extension]}],
                showOverwriteConfirmation: true
            });

            if (result?.canceled || result?.cancelled || !result?.filePath) return;
            const content = format === "csv" ? this.toCsv(this.history) : JSON.stringify(this.history, null, 2);
            require("fs").writeFileSync(result.filePath, content, "utf8");
            this.api.UI.showToast("History exported.", {type: "success"});
        }
        catch (error) {
            this.api.Logger.error("Error while exporting history", error);
            this.api.UI.showToast("Export failed.", {type: "error"});
        }
    }

    toCsv(items) {
        const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const rows = [["date", "entity_type", "id", "name", "event", "confidence", "description"]];
        for (const item of items) {
            rows.push([
                new Date(Number(item.timestamp)).toISOString(),
                item.entityType,
                item.entityId,
                item.name,
                item.eventType,
                item.confidence,
                item.description
            ]);
        }
        return rows.map(row => row.map(escape).join(",")).join("\r\n");
    }

    addStyles() {
        this.api.DOM.addStyle(`
            .hsh-root {
                color: var(--text-normal);
                padding-bottom: 32px;
            }
            .hsh-header h2, .hsh-card h3 {
                margin: 0;
                color: var(--header-primary);
            }
            .hsh-header p {
                margin: 6px 0 0;
                color: var(--text-muted);
                line-height: 1.45;
            }
            .hsh-stats {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 10px;
                margin: 18px 0;
            }
            .hsh-stat, .hsh-card {
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-accent);
                border-radius: 10px;
            }
            .hsh-stat {
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .hsh-stat strong {
                font-size: 22px;
                color: var(--header-primary);
            }
            .hsh-stat span {
                color: var(--text-muted);
                font-size: 12px;
            }
            .hsh-card {
                padding: 16px;
                margin-bottom: 14px;
            }
            .hsh-setting-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 24px;
                padding: 14px 0;
                border-bottom: 1px solid var(--background-modifier-accent);
                cursor: pointer;
            }
            .hsh-setting-row:last-child {
                border-bottom: 0;
            }
            .hsh-setting-row > div {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .hsh-setting-row strong {
                color: var(--header-primary);
            }
            .hsh-setting-row span {
                color: var(--text-muted);
                font-size: 13px;
            }
            .hsh-toggle-wrap {
                position: relative;
                flex: 0 0 auto;
            }
            .hsh-toggle-input {
                position: absolute;
                opacity: 0;
                pointer-events: none;
            }
            .hsh-toggle {
                display: block;
                width: 40px;
                height: 24px;
                border-radius: 999px;
                background: var(--background-modifier-selected);
                transition: 150ms ease;
            }
            .hsh-toggle::after {
                content: "";
                display: block;
                width: 18px;
                height: 18px;
                margin: 3px;
                border-radius: 50%;
                background: white;
                transition: 150ms ease;
            }
            .hsh-toggle-input:checked + .hsh-toggle {
                background: var(--brand-500);
            }
            .hsh-toggle-input:checked + .hsh-toggle::after {
                transform: translateX(16px);
            }
            .hsh-number, .hsh-input, .hsh-select {
                box-sizing: border-box;
                border: 1px solid var(--input-border, var(--background-modifier-accent));
                border-radius: 6px;
                background: var(--input-background, var(--background-tertiary));
                color: var(--text-normal);
                min-height: 36px;
                padding: 8px 10px;
                outline: none;
            }
            .hsh-number {
                width: 110px;
            }
            .hsh-input:focus, .hsh-select:focus, .hsh-number:focus {
                border-color: var(--brand-500);
            }
            .hsh-history-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            }
            .hsh-toolbar {
                display: grid;
                grid-template-columns: minmax(160px, 1fr) 120px auto auto auto;
                gap: 8px;
                margin-bottom: 12px;
            }
            .hsh-button {
                border: 0;
                border-radius: 6px;
                min-height: 36px;
                padding: 8px 12px;
                color: white;
                cursor: pointer;
                font-weight: 600;
            }
            .hsh-button-secondary {
                background: var(--brand-500);
            }
            .hsh-button-secondary:hover {
                background: var(--brand-560);
            }
            .hsh-button-danger {
                background: var(--status-danger);
            }
            .hsh-history-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 520px;
                overflow: auto;
                padding-right: 4px;
            }
            .hsh-event {
                border: 1px solid var(--background-modifier-accent);
                border-left: 4px solid var(--brand-500);
                border-radius: 8px;
                background: var(--background-primary);
                padding: 12px;
            }
            .hsh-event-group {
                border-left-color: var(--status-positive);
            }
            .hsh-event-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .hsh-event-top strong {
                color: var(--header-primary);
                overflow-wrap: anywhere;
            }
            .hsh-event-label {
                margin-top: 4px;
                color: var(--text-link);
                font-weight: 600;
                font-size: 13px;
            }
            .hsh-event p {
                margin: 7px 0;
                color: var(--text-normal);
                line-height: 1.4;
            }
            .hsh-event-meta {
                color: var(--text-muted);
                font-size: 12px;
                overflow-wrap: anywhere;
            }
            .hsh-badge {
                border-radius: 999px;
                padding: 3px 8px;
                font-size: 11px;
                font-weight: 700;
                white-space: nowrap;
                color: white;
                background: var(--background-modifier-selected);
            }
            .hsh-badge-certain { background: var(--status-positive); }
            .hsh-badge-likely { background: var(--status-warning); color: var(--black-500, #111); }
            .hsh-badge-possible, .hsh-badge-unknown { background: var(--status-danger); }
            .hsh-empty {
                padding: 32px 12px;
                text-align: center;
                color: var(--text-muted);
                border: 1px dashed var(--background-modifier-accent);
                border-radius: 8px;
            }
            .hsh-info {
                margin-top: 12px;
                padding: 11px 12px;
                border-radius: 8px;
                background: var(--background-secondary-alt);
                color: var(--text-muted);
                font-size: 12px;
                line-height: 1.45;
            }
            @media (max-width: 850px) {
                .hsh-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .hsh-toolbar { grid-template-columns: 1fr 1fr; }
                .hsh-toolbar .hsh-input { grid-column: 1 / -1; }
            }
        `);
    }
};
