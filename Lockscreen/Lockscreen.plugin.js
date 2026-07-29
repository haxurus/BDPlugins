/**
 * @name Lockscreen
 * @author Haxurus
 * @version 1.1.0
 * @description Adds a local lockscreen to Discord with 4-digit PIN, 6-digit PIN, password, or Android-style pattern unlock.
 */

module.exports = class Lockscreen {
    constructor() {
        this.pluginName = "Lockscreen";
        this.api = new BdApi(this.pluginName);

        this.defaults = {
            method: "pin4",
            salt: null,
            verifier: null,
            lockOnStartup: true,
            inactivityMinutes: 0,
            lockoutSeconds: 30,
            showLockButton: true,
            enableShortcut: true
        };

        this.settings = {...this.defaults};
        this.overlay = null;
        this.lockButton = null;
        this.locked = false;
        this.lastActivity = Date.now();
        this.inactivityTimer = null;
        this.clockTimer = null;
        this.failedAttempts = 0;
        this.lockoutUntil = 0;
        this.lockoutTimer = null;

        this.boundActivity = this.handleActivity.bind(this);
        this.boundShortcut = this.handleGlobalKeydown.bind(this);
    }

    start() {
        this.settings = {...this.defaults, ...(this.api.Data.load("settings") || {})};
        if (Object.prototype.hasOwnProperty.call(this.settings, "lockOnBlur")) {
            delete this.settings.lockOnBlur;
            this.saveSettings();
        }
        this.addStyles();
        this.attachListeners();
        this.updateLockButton();
        this.startInactivityWatcher();

        const wasLocked = Boolean(this.api.Data.load("locked"));
        if (this.hasCredential() && (this.settings.lockOnStartup || wasLocked)) {
            setTimeout(() => this.lock(), 600);
        }
        else if (!this.hasCredential()) {
            this.api.UI.showToast("Haxurus Lockscreen: configure an unlock method in the plugin settings.", {type: "warning", timeout: 7000});
        }
    }

    stop() {
        this.detachListeners();
        this.stopInactivityWatcher();
        this.clearTimers();
        this.removeOverlay(false);
        this.removeLockButton();
        this.api.DOM.removeStyle("haxurus-lockscreen-styles");
        document.documentElement.removeAttribute("data-haxurus-locked");
    }

    hasCredential() {
        return Boolean(this.settings.salt && this.settings.verifier && this.settings.method);
    }

    saveSettings() {
        this.api.Data.save("settings", this.settings);
    }

    attachListeners() {
        const activityEvents = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "pointerdown"];
        for (const eventName of activityEvents) {
            document.addEventListener(eventName, this.boundActivity, true);
        }
        document.addEventListener("keydown", this.boundShortcut, true);
    }

    detachListeners() {
        const activityEvents = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "pointerdown"];
        for (const eventName of activityEvents) {
            document.removeEventListener(eventName, this.boundActivity, true);
        }
        document.removeEventListener("keydown", this.boundShortcut, true);
    }

    handleActivity() {
        if (!this.locked) this.lastActivity = Date.now();
    }

    handleGlobalKeydown(event) {
        if (this.locked) {
            if (this.overlay?.contains(event.target)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        if (
            this.settings.enableShortcut &&
            this.hasCredential() &&
            event.ctrlKey &&
            event.shiftKey &&
            event.code === "KeyL"
        ) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.lock();
        }
    }

    startInactivityWatcher() {
        this.stopInactivityWatcher();
        this.inactivityTimer = setInterval(() => {
            const minutes = Number(this.settings.inactivityMinutes) || 0;
            if (!minutes || this.locked || !this.hasCredential()) return;
            if (Date.now() - this.lastActivity >= minutes * 60_000) this.lock();
        }, 5000);
    }

    stopInactivityWatcher() {
        clearInterval(this.inactivityTimer);
        this.inactivityTimer = null;
    }

    clearTimers() {
        clearInterval(this.clockTimer);
        clearInterval(this.lockoutTimer);
        this.clockTimer = null;
        this.lockoutTimer = null;
    }

    lock() {
        if (this.locked) return;
        if (!this.hasCredential()) {
            this.api.UI.showToast("Configure a PIN, password, or pattern first.", {type: "warning"});
            return;
        }

        this.locked = true;
        this.failedAttempts = 0;
        this.lockoutUntil = 0;
        this.api.Data.save("locked", true);
        document.documentElement.setAttribute("data-haxurus-locked", "true");
        this.createOverlay();
    }

    unlock() {
        this.locked = false;
        this.failedAttempts = 0;
        this.lockoutUntil = 0;
        this.api.Data.save("locked", false);
        document.documentElement.removeAttribute("data-haxurus-locked");
        this.removeOverlay(true);
        this.lastActivity = Date.now();
    }

    createOverlay() {
        this.removeOverlay(false);

        const overlay = document.createElement("div");
        overlay.id = "haxurus-lockscreen-overlay";
        overlay.tabIndex = -1;
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Discord locked");

        overlay.addEventListener("contextmenu", event => {
            event.preventDefault();
            event.stopPropagation();
        });
        overlay.addEventListener("keydown", event => event.stopPropagation());
        overlay.addEventListener("keyup", event => event.stopPropagation());
        overlay.addEventListener("keypress", event => event.stopPropagation());

        const card = document.createElement("div");
        card.className = "hls-card";

        const shield = document.createElement("div");
        shield.className = "hls-shield";
        shield.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2 4.5 5v6.1c0 5.1 3.2 9.7 7.5 10.9 4.3-1.2 7.5-5.8 7.5-10.9V5L12 2Zm0 4.1a3 3 0 0 1 3 3v1.1h.7c.7 0 1.3.6 1.3 1.3v4.4c0 .7-.6 1.3-1.3 1.3H8.3c-.7 0-1.3-.6-1.3-1.3v-4.4c0-.7.6-1.3 1.3-1.3H9V9.1a3 3 0 0 1 3-3Zm0 1.8c-.7 0-1.2.5-1.2 1.2v1.1h2.4V9.1c0-.7-.5-1.2-1.2-1.2Z" />
            </svg>`;

        const time = document.createElement("div");
        time.className = "hls-time";
        const date = document.createElement("div");
        date.className = "hls-date";

        const title = document.createElement("h1");
        title.textContent = "Discord locked";
        const subtitle = document.createElement("p");
        subtitle.className = "hls-subtitle";
        subtitle.textContent = this.getMethodPrompt();

        const inputArea = document.createElement("div");
        inputArea.className = "hls-input-area";

        const error = document.createElement("div");
        error.className = "hls-error";
        error.setAttribute("aria-live", "polite");

        const footer = document.createElement("div");
        footer.className = "hls-footer";
        footer.textContent = this.settings.enableShortcut ? "Quickly lock with Ctrl + Shift + L" : "Haxurus Lockscreen";

        card.append(shield, time, date, title, subtitle, inputArea, error, footer);
        overlay.append(card);
        document.body.append(overlay);
        this.overlay = overlay;

        const updateClock = () => {
            const now = new Date();
            time.textContent = now.toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit"});
            date.textContent = now.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long"
            });
        };
        updateClock();
        this.clockTimer = setInterval(updateClock, 1000);

        if (this.settings.method === "pin4" || this.settings.method === "pin6") {
            this.renderPinUnlock(inputArea, error);
        }
        else if (this.settings.method === "password") {
            this.renderPasswordUnlock(inputArea, error);
        }
        else {
            this.renderPatternUnlock(inputArea, error);
        }

        requestAnimationFrame(() => {
            overlay.classList.add("hls-visible");
            overlay.focus();
        });
    }

    removeOverlay(animate = true) {
        clearInterval(this.clockTimer);
        clearInterval(this.lockoutTimer);
        this.clockTimer = null;
        this.lockoutTimer = null;

        const overlay = this.overlay || document.getElementById("haxurus-lockscreen-overlay");
        this.overlay = null;
        if (!overlay) return;

        if (animate) {
            overlay.classList.remove("hls-visible");
            overlay.classList.add("hls-leaving");
            setTimeout(() => overlay.remove(), 180);
        }
        else {
            overlay.remove();
        }
    }

    getMethodPrompt() {
        switch (this.settings.method) {
            case "pin4": return "Enter the 4-digit PIN";
            case "pin6": return "Enter the 6-digit PIN";
            case "password": return "Enter the password";
            case "pattern": return "Draw the pattern to unlock";
            default: return "Enter your credentials";
        }
    }

    renderPinUnlock(container, errorElement) {
        const requiredLength = this.settings.method === "pin6" ? 6 : 4;
        let value = "";

        const dots = document.createElement("div");
        dots.className = "hls-pin-dots";
        const dotElements = [];
        for (let i = 0; i < requiredLength; i++) {
            const dot = document.createElement("span");
            dots.append(dot);
            dotElements.push(dot);
        }

        const keypad = document.createElement("div");
        keypad.className = "hls-keypad";
        const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

        const refresh = () => {
            dotElements.forEach((dot, index) => dot.classList.toggle("filled", index < value.length));
        };

        const submit = async () => {
            if (value.length !== requiredLength || this.isLockedOut()) return;
            const candidate = value;
            value = "";
            refresh();
            const valid = await this.verifySecret(candidate);
            if (valid) this.unlock();
            else this.registerFailure(errorElement, container);
        };

        for (const key of keys) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "hls-key";

            if (key === "clear") {
                button.classList.add("hls-key-small");
                button.textContent = "C";
                button.setAttribute("aria-label", "Clear PIN");
            }
            else if (key === "back") {
                button.classList.add("hls-key-small");
                button.textContent = "⌫";
                button.setAttribute("aria-label", "Delete last digit");
            }
            else {
                button.textContent = key;
                button.setAttribute("aria-label", `Digit ${key}`);
            }

            button.addEventListener("click", () => {
                if (this.isLockedOut()) return;
                errorElement.textContent = "";
                if (key === "clear") value = "";
                else if (key === "back") value = value.slice(0, -1);
                else if (value.length < requiredLength) value += key;
                refresh();
                if (value.length === requiredLength) setTimeout(submit, 100);
            });
            keypad.append(button);
        }

        const keyboardHandler = event => {
            if (this.isLockedOut()) return;
            if (/^[0-9]$/.test(event.key) && value.length < requiredLength) {
                value += event.key;
                refresh();
                if (value.length === requiredLength) setTimeout(submit, 100);
            }
            else if (event.key === "Backspace") {
                value = value.slice(0, -1);
                refresh();
            }
            else if (event.key === "Escape" || event.key === "Delete") {
                value = "";
                refresh();
            }
            event.preventDefault();
        };

        this.overlay.addEventListener("keydown", keyboardHandler);
        container.append(dots, keypad);
    }

    renderPasswordUnlock(container, errorElement) {
        const form = document.createElement("form");
        form.className = "hls-password-form";

        const inputWrap = document.createElement("div");
        inputWrap.className = "hls-password-wrap";
        const input = document.createElement("input");
        input.type = "password";
        input.autocomplete = "off";
        input.placeholder = "Password";
        input.setAttribute("aria-label", "Unlock password");

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "hls-password-toggle";
        toggle.textContent = "Show";
        toggle.addEventListener("click", () => {
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            toggle.textContent = show ? "Hide" : "Show";
            input.focus();
        });

        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "hls-primary-button";
        submit.textContent = "Unlock";

        form.addEventListener("submit", async event => {
            event.preventDefault();
            event.stopPropagation();
            if (this.isLockedOut() || !input.value) return;
            submit.disabled = true;
            const valid = await this.verifySecret(input.value);
            submit.disabled = false;
            if (valid) this.unlock();
            else {
                input.value = "";
                input.focus();
                this.registerFailure(errorElement, form);
            }
        });

        inputWrap.append(input, toggle);
        form.append(inputWrap, submit);
        container.append(form);
        setTimeout(() => input.focus(), 80);
    }

    renderPatternUnlock(container, errorElement) {
        const hint = document.createElement("div");
        hint.className = "hls-pattern-hint";
        hint.textContent = "Connect at least 4 dots";

        const pattern = this.createPatternPad({
            onComplete: async sequence => {
                if (this.isLockedOut()) return false;
                if (sequence.length < 4) {
                    errorElement.textContent = "The pattern must contain at least 4 dots.";
                    return false;
                }
                const valid = await this.verifySecret(sequence.join("-"));
                if (valid) {
                    this.unlock();
                    return true;
                }
                this.registerFailure(errorElement, pattern);
                return false;
            },
            disabled: () => this.isLockedOut()
        });

        container.append(hint, pattern);
    }

    createPatternPad({onComplete, disabled = () => false, compact = false} = {}) {
        const pad = document.createElement("div");
        pad.className = `hls-pattern-pad${compact ? " compact" : ""}`;
        pad.setAttribute("role", "application");
        pad.setAttribute("aria-label", "Pattern drawing area");

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 300 300");
        svg.setAttribute("preserveAspectRatio", "none");
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("fill", "none");
        polyline.setAttribute("stroke-linecap", "round");
        polyline.setAttribute("stroke-linejoin", "round");
        svg.append(polyline);
        pad.append(svg);

        const centers = [];
        const nodes = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const index = row * 3 + col + 1;
                const x = 50 + col * 100;
                const y = 50 + row * 100;
                centers.push({x, y});

                const node = document.createElement("div");
                node.className = "hls-pattern-node";
                node.dataset.index = String(index);
                node.style.left = `${(x / 300) * 100}%`;
                node.style.top = `${(y / 300) * 100}%`;
                node.innerHTML = "<span></span>";
                pad.append(node);
                nodes.push(node);
            }
        }

        let drawing = false;
        let selected = [];
        let pointer = null;

        const updateLine = () => {
            const points = selected.map(index => centers[index - 1]);
            if (drawing && pointer) points.push(pointer);
            polyline.setAttribute("points", points.map(point => `${point.x},${point.y}`).join(" "));
        };

        const addNode = index => {
            if (selected.includes(index)) return;
            selected.push(index);
            nodes[index - 1].classList.add("selected");
            updateLine();
        };

        const findNode = event => {
            const rect = pad.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 300;
            const y = ((event.clientY - rect.top) / rect.height) * 300;
            pointer = {x: Math.max(0, Math.min(300, x)), y: Math.max(0, Math.min(300, y))};

            let best = null;
            let bestDistance = compact ? 38 : 34;
            centers.forEach((center, idx) => {
                const distance = Math.hypot(center.x - x, center.y - y);
                if (distance <= bestDistance) {
                    bestDistance = distance;
                    best = idx + 1;
                }
            });
            return best;
        };

        const clearSelection = () => {
            selected = [];
            nodes.forEach(node => node.classList.remove("selected"));
            polyline.setAttribute("points", "");
            pad.classList.remove("success", "failure");
        };

        const reset = (state = "") => {
            drawing = false;
            pointer = null;
            pad.classList.remove("success", "failure");
            if (!state) {
                clearSelection();
                return;
            }
            pad.classList.add(state);
            setTimeout(clearSelection, 450);
        };

        pad.addEventListener("pointerdown", event => {
            if (disabled()) return;
            event.preventDefault();
            pad.setPointerCapture?.(event.pointerId);
            reset();
            drawing = true;
            const index = findNode(event);
            if (index) addNode(index);
            updateLine();
        });

        pad.addEventListener("pointermove", event => {
            if (!drawing || disabled()) return;
            event.preventDefault();
            const index = findNode(event);
            if (index) addNode(index);
            updateLine();
        });

        const finish = async event => {
            if (!drawing) return;
            event?.preventDefault();
            drawing = false;
            pointer = null;
            updateLine();
            const sequence = [...selected];
            const result = await onComplete?.(sequence);
            reset(result === true ? "success" : result === false ? "failure" : "");
        };

        pad.addEventListener("pointerup", finish);
        pad.addEventListener("pointercancel", () => reset());
        pad.addEventListener("lostpointercapture", event => {
            if (drawing) finish(event);
        });

        return pad;
    }

    async verifySecret(secret) {
        try {
            const calculated = await this.deriveVerifier(secret, this.settings.salt);
            return this.constantTimeEqual(calculated, this.settings.verifier);
        }
        catch (error) {
            this.api.Logger.error("Unable to verify credential", error);
            return false;
        }
    }

    registerFailure(errorElement, shakeElement) {
        this.failedAttempts += 1;
        shakeElement.classList.remove("hls-shake");
        void shakeElement.offsetWidth;
        shakeElement.classList.add("hls-shake");

        if (this.failedAttempts >= 5) {
            this.failedAttempts = 0;
            const lockoutSeconds = Math.max(0, Number(this.settings.lockoutSeconds) || 0);
            if (lockoutSeconds > 0) {
                this.lockoutUntil = Date.now() + lockoutSeconds * 1000;
                this.startLockoutCountdown(errorElement);
            }
            else {
                this.lockoutUntil = 0;
                errorElement.textContent = "Incorrect credential. You can try again.";
            }
        }
        else {
            const remaining = 5 - this.failedAttempts;
            errorElement.textContent = `Incorrect credential. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining before the temporary lockout.`;
        }
    }

    isLockedOut() {
        return Date.now() < this.lockoutUntil;
    }

    startLockoutCountdown(errorElement) {
        clearInterval(this.lockoutTimer);
        const update = () => {
            const seconds = Math.max(0, Math.ceil((this.lockoutUntil - Date.now()) / 1000));
            if (!seconds) {
                clearInterval(this.lockoutTimer);
                this.lockoutTimer = null;
                errorElement.textContent = "You can try again.";
                return;
            }
            errorElement.textContent = `Too many attempts. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`;
        };
        update();
        this.lockoutTimer = setInterval(update, 250);
    }

    async setCredential(method, secret) {
        const saltBytes = crypto.getRandomValues(new Uint8Array(16));
        const salt = this.bytesToBase64(saltBytes);
        const verifier = await this.deriveVerifier(secret, salt);
        this.settings.method = method;
        this.settings.salt = salt;
        this.settings.verifier = verifier;
        this.saveSettings();
        this.api.Data.save("locked", false);
    }

    async deriveVerifier(secret, saltBase64) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            {name: "PBKDF2"},
            false,
            ["deriveBits"]
        );

        const bits = await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                hash: "SHA-256",
                salt: this.base64ToBytes(saltBase64),
                iterations: 210000
            },
            keyMaterial,
            256
        );

        return this.bytesToBase64(new Uint8Array(bits));
    }

    constantTimeEqual(a, b) {
        if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
        let difference = 0;
        for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return difference === 0;
    }

    bytesToBase64(bytes) {
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
    }

    base64ToBytes(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    }

    updateLockButton() {
        this.removeLockButton();
        if (!this.settings.showLockButton || !this.hasCredential()) return;

        const button = document.createElement("button");
        button.id = "haxurus-lockscreen-button";
        button.type = "button";
        button.title = "Lock Discord";
        button.setAttribute("aria-label", "Lock Discord");
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Zm3 9.7V18h-2v-1.3a2 2 0 1 1 2 0Z" />
            </svg>`;
        button.addEventListener("click", () => this.lock());
        document.body.append(button);
        this.lockButton = button;
    }

    removeLockButton() {
        this.lockButton?.remove();
        document.getElementById("haxurus-lockscreen-button")?.remove();
        this.lockButton = null;
    }

    getSettingsPanel() {
        const panel = document.createElement("div");
        panel.className = "hls-settings";

        const heading = document.createElement("div");
        heading.className = "hls-settings-heading";
        heading.innerHTML = `
            <div class="hls-settings-icon">
                <svg viewBox="0 0 24 24"><path d="M12 2 4.5 5v6.1c0 5.1 3.2 9.7 7.5 10.9 4.3-1.2 7.5-5.8 7.5-10.9V5L12 2Z"/></svg>
            </div>
            <div>
                <h2>Haxurus Lockscreen</h2>
                <p>Local protection for the Discord interface.</p>
            </div>`;

        const warning = document.createElement("div");
        warning.className = "hls-settings-warning";
        warning.innerHTML = "<strong>Security notice:</strong> this is a local visual protection layer. Anyone who can disable BetterDiscord, remove the plugin, or modify its data can bypass it.";

        const credentialCard = this.createSettingsCard("Unlock method", "Set or replace the credential used by the lockscreen.");
        const methodRow = this.createSettingRow("Type", "Choose a PIN, password, or pattern.");
        const methodSelect = document.createElement("select");
        methodSelect.className = "hls-settings-input";
        methodSelect.innerHTML = `
            <option value="pin4">4-digit PIN</option>
            <option value="pin6">6-digit PIN</option>
            <option value="password">Password</option>
            <option value="pattern">Pattern</option>`;
        methodSelect.value = this.settings.method || "pin4";
        methodRow.append(methodSelect);

        const setupArea = document.createElement("div");
        setupArea.className = "hls-credential-setup";
        credentialCard.body.append(methodRow, setupArea);

        const renderCredentialSetup = () => {
            setupArea.replaceChildren();
            const method = methodSelect.value;
            const status = document.createElement("div");
            status.className = "hls-settings-status";

            if (method === "pattern") {
                let firstPattern = null;
                let confirmedPattern = null;
                let stage = 1;

                const instructions = document.createElement("div");
                instructions.className = "hls-pattern-setup-title";
                instructions.textContent = "Draw the new pattern";

                const pad = this.createPatternPad({
                    compact: true,
                    onComplete: sequence => {
                        if (sequence.length < 4) {
                            status.textContent = "The pattern must contain at least 4 dots.";
                            status.className = "hls-settings-status error";
                            return false;
                        }

                        if (stage === 1) {
                            firstPattern = sequence.join("-");
                            stage = 2;
                            instructions.textContent = "Draw the pattern again to confirm";
                            status.textContent = "First pattern recorded.";
                            status.className = "hls-settings-status success";
                            return true;
                        }

                        confirmedPattern = sequence.join("-");
                        if (firstPattern !== confirmedPattern) {
                            firstPattern = null;
                            confirmedPattern = null;
                            stage = 1;
                            instructions.textContent = "The patterns do not match. Start again";
                            status.textContent = "Confirmation failed.";
                            status.className = "hls-settings-status error";
                            return false;
                        }

                        instructions.textContent = "Pattern confermato";
                        status.textContent = "Press Save pattern to apply it.";
                        status.className = "hls-settings-status success";
                        return true;
                    }
                });

                const buttons = document.createElement("div");
                buttons.className = "hls-settings-actions";
                const reset = this.createButton("Start again", "secondary", () => {
                    firstPattern = null;
                    confirmedPattern = null;
                    stage = 1;
                    instructions.textContent = "Draw the new pattern";
                    status.textContent = "";
                });
                const save = this.createButton("Save pattern", "primary", async () => {
                    if (!firstPattern || !confirmedPattern || firstPattern !== confirmedPattern) {
                        status.textContent = "Draw and confirm the pattern first.";
                        status.className = "hls-settings-status error";
                        return;
                    }
                    save.disabled = true;
                    status.textContent = "Saving...";
                    status.className = "hls-settings-status";
                    try {
                        await this.setCredential("pattern", firstPattern);
                        status.textContent = "Pattern updated successfully.";
                        status.className = "hls-settings-status success";
                        this.updateLockButton();
                    }
                    catch (error) {
                        this.api.Logger.error("Unable to save pattern", error);
                        status.textContent = "Unable to save the pattern.";
                        status.className = "hls-settings-status error";
                    }
                    save.disabled = false;
                });
                buttons.append(reset, save);
                setupArea.append(instructions, pad, status, buttons);
                return;
            }

            const requiredLength = method === "pin4" ? 4 : method === "pin6" ? 6 : null;
            const firstRow = this.createSettingRow("New credential", requiredLength ? `Enter exactly ${requiredLength} digits.` : "Use at least 4 characters.");
            const firstInput = document.createElement("input");
            firstInput.className = "hls-settings-input";
            firstInput.type = "password";
            firstInput.autocomplete = "new-password";
            firstInput.placeholder = requiredLength ? "•".repeat(requiredLength) : "New password";
            if (requiredLength) {
                firstInput.inputMode = "numeric";
                firstInput.maxLength = requiredLength;
                firstInput.addEventListener("input", () => firstInput.value = firstInput.value.replace(/\D/g, "").slice(0, requiredLength));
            }
            firstRow.append(firstInput);

            const confirmRow = this.createSettingRow("Confirm", "Enter the same credential again.");
            const confirmInput = document.createElement("input");
            confirmInput.className = "hls-settings-input";
            confirmInput.type = "password";
            confirmInput.autocomplete = "new-password";
            confirmInput.placeholder = "Confirm";
            if (requiredLength) {
                confirmInput.inputMode = "numeric";
                confirmInput.maxLength = requiredLength;
                confirmInput.addEventListener("input", () => confirmInput.value = confirmInput.value.replace(/\D/g, "").slice(0, requiredLength));
            }
            confirmRow.append(confirmInput);

            const actions = document.createElement("div");
            actions.className = "hls-settings-actions";
            const save = this.createButton("Save credential", "primary", async () => {
                const first = firstInput.value;
                const second = confirmInput.value;
                status.className = "hls-settings-status";

                if (requiredLength && !new RegExp(`^\\d{${requiredLength}}$`).test(first)) {
                    status.textContent = `The PIN must contain exactly ${requiredLength} digits.`;
                    status.classList.add("error");
                    return;
                }
                if (!requiredLength && first.length < 4) {
                    status.textContent = "The password must contain at least 4 characters.";
                    status.classList.add("error");
                    return;
                }
                if (first !== second) {
                    status.textContent = "The credentials do not match.";
                    status.classList.add("error");
                    return;
                }

                save.disabled = true;
                status.textContent = "Saving...";
                try {
                    await this.setCredential(method, first);
                    firstInput.value = "";
                    confirmInput.value = "";
                    status.textContent = "Credential updated successfully.";
                    status.className = "hls-settings-status success";
                    this.updateLockButton();
                }
                catch (error) {
                    this.api.Logger.error("Unable to save credential", error);
                    status.textContent = "Unable to save the credential.";
                    status.className = "hls-settings-status error";
                }
                save.disabled = false;
            });
            actions.append(save);
            setupArea.append(firstRow, confirmRow, status, actions);
        };

        methodSelect.addEventListener("change", renderCredentialSetup);
        renderCredentialSetup();

        const behaviorCard = this.createSettingsCard("Behavior", "Choose when Discord should lock.");
        behaviorCard.body.append(
            this.createToggleRow("Lock on startup", "Show the lockscreen when Discord starts.", "lockOnStartup"),
            this.createNumberRow("Lock after inactivity", "Minutes without activity before locking. Use 0 to disable.", "inactivityMinutes", 0, 1440),
            this.createNumberRow("Lockout duration", "Seconds to wait after 5 failed attempts. Use 0 to disable.", "lockoutSeconds", 0, 3600),
            this.createToggleRow("Show lock button", "Adds a small button in the bottom-right corner.", "showLockButton", () => this.updateLockButton()),
            this.createToggleRow("Ctrl + Shift + L shortcut", "Allows Discord to be locked from the keyboard.", "enableShortcut")
        );

        const actionsCard = this.createSettingsCard("Actions", "Immediate lockscreen controls.");
        const actionButtons = document.createElement("div");
        actionButtons.className = "hls-settings-actions hls-settings-actions-wide";

        const lockNow = this.createButton("Lock now", "primary", () => {
            if (!this.hasCredential()) {
                this.api.UI.showToast("Configure a credential first.", {type: "warning"});
                return;
            }
            this.lock();
        });

        const removeCredential = this.createButton("Remove credential", "danger", () => {
            this.api.UI.showConfirmationModal(
                "Remove the credential?",
                "The lockscreen will remain disabled until you configure a new unlock method.",
                {
                    danger: true,
                    confirmText: "Remove",
                    cancelText: "Cancel",
                    onConfirm: () => {
                        this.settings.salt = null;
                        this.settings.verifier = null;
                        this.saveSettings();
                        this.api.Data.save("locked", false);
                        this.updateLockButton();
                        this.api.UI.showToast("Credential removed.", {type: "success"});
                    }
                }
            );
        });

        actionButtons.append(lockNow, removeCredential);
        actionsCard.body.append(actionButtons);

        panel.append(heading, warning, credentialCard.card, behaviorCard.card, actionsCard.card);
        return panel;
    }

    createSettingsCard(title, description) {
        const card = document.createElement("section");
        card.className = "hls-settings-card";
        const header = document.createElement("div");
        header.className = "hls-settings-card-header";
        const heading = document.createElement("h3");
        heading.textContent = title;
        const text = document.createElement("p");
        text.textContent = description;
        header.append(heading, text);
        const body = document.createElement("div");
        body.className = "hls-settings-card-body";
        card.append(header, body);
        return {card, body};
    }

    createSettingRow(title, description) {
        const row = document.createElement("label");
        row.className = "hls-setting-row";
        const text = document.createElement("div");
        text.className = "hls-setting-copy";
        const heading = document.createElement("div");
        heading.className = "hls-setting-title";
        heading.textContent = title;
        const detail = document.createElement("div");
        detail.className = "hls-setting-description";
        detail.textContent = description;
        text.append(heading, detail);
        row.append(text);
        return row;
    }

    createToggleRow(title, description, key, callback) {
        const row = this.createSettingRow(title, description);
        const toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.className = "hls-toggle";
        toggle.checked = Boolean(this.settings[key]);
        toggle.addEventListener("change", () => {
            this.settings[key] = toggle.checked;
            this.saveSettings();
            callback?.(toggle.checked);
        });
        row.append(toggle);
        return row;
    }

    createNumberRow(title, description, key, min, max) {
        const row = this.createSettingRow(title, description);
        const input = document.createElement("input");
        input.type = "number";
        input.className = "hls-settings-input hls-number-input";
        input.min = String(min);
        input.max = String(max);
        input.step = "1";
        input.value = String(Number(this.settings[key]) || 0);
        input.addEventListener("change", () => {
            const value = Math.max(min, Math.min(max, Number.parseInt(input.value, 10) || 0));
            input.value = String(value);
            this.settings[key] = value;
            this.saveSettings();
            this.lastActivity = Date.now();
        });
        row.append(input);
        return row;
    }

    createButton(text, type, onClick) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `hls-settings-button ${type}`;
        button.textContent = text;
        button.addEventListener("click", onClick);
        return button;
    }

    addStyles() {
        this.api.DOM.addStyle("haxurus-lockscreen-styles", `
            #haxurus-lockscreen-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                box-sizing: border-box;
                color: #f2f3f5;
                background:
                    radial-gradient(circle at 20% 10%, rgba(35, 165, 90, .22), transparent 35%),
                    radial-gradient(circle at 85% 85%, rgba(88, 101, 242, .25), transparent 40%),
                    rgba(12, 14, 18, .84);
                backdrop-filter: blur(18px) saturate(.8);
                -webkit-backdrop-filter: blur(18px) saturate(.8);
                opacity: 0;
                transition: opacity .18s ease;
                user-select: none;
                font-family: var(--font-primary, "gg sans", sans-serif);
            }

            #haxurus-lockscreen-overlay.hls-visible { opacity: 1; }
            #haxurus-lockscreen-overlay.hls-leaving { opacity: 0; }

            #haxurus-lockscreen-overlay * { box-sizing: border-box; }

            .hls-card {
                width: min(430px, 100%);
                max-height: calc(100vh - 48px);
                overflow: auto;
                padding: 30px 32px 24px;
                border: 1px solid rgba(255, 255, 255, .1);
                border-radius: 24px;
                background: rgba(24, 26, 32, .92);
                box-shadow: 0 24px 80px rgba(0, 0, 0, .5);
                text-align: center;
                transform: translateY(8px) scale(.985);
                transition: transform .18s ease;
            }

            .hls-visible .hls-card { transform: translateY(0) scale(1); }

            .hls-shield {
                width: 56px;
                height: 56px;
                display: grid;
                place-items: center;
                margin: 0 auto 14px;
                border-radius: 18px;
                background: linear-gradient(145deg, #23a55a, #157a40);
                box-shadow: 0 10px 28px rgba(35, 165, 90, .28);
            }

            .hls-shield svg { width: 32px; height: 32px; fill: white; }
            .hls-time { font-size: 42px; line-height: 1; font-weight: 700; letter-spacing: -1px; }
            .hls-date { margin-top: 8px; color: #b5bac1; font-size: 15px; text-transform: capitalize; }
            .hls-card h1 { margin: 24px 0 6px; font-size: 24px; line-height: 1.2; }
            .hls-subtitle { margin: 0; color: #b5bac1; font-size: 15px; }
            .hls-input-area { margin-top: 24px; }
            .hls-error { min-height: 38px; margin-top: 16px; color: #fa777c; font-size: 13px; line-height: 1.35; }
            .hls-footer { margin-top: 6px; color: #80848e; font-size: 12px; }

            .hls-pin-dots { display: flex; justify-content: center; gap: 14px; margin: 0 auto 24px; }
            .hls-pin-dots span {
                width: 13px;
                height: 13px;
                border: 2px solid #6d6f78;
                border-radius: 50%;
                transition: .12s ease;
            }
            .hls-pin-dots span.filled { border-color: #23a55a; background: #23a55a; transform: scale(1.08); }

            .hls-keypad {
                display: grid;
                grid-template-columns: repeat(3, 68px);
                justify-content: center;
                gap: 12px 18px;
            }

            .hls-key {
                width: 68px;
                height: 56px;
                border: 1px solid rgba(255, 255, 255, .09);
                border-radius: 18px;
                color: #f2f3f5;
                background: rgba(255, 255, 255, .075);
                font: inherit;
                font-size: 20px;
                font-weight: 600;
                cursor: pointer;
                transition: background .12s ease, transform .08s ease, border-color .12s ease;
            }
            .hls-key:hover { background: rgba(255, 255, 255, .13); border-color: rgba(255, 255, 255, .16); }
            .hls-key:active { transform: scale(.95); }
            .hls-key-small { color: #b5bac1; font-size: 16px; }

            .hls-password-form { display: grid; gap: 14px; }
            .hls-password-wrap { position: relative; }
            .hls-password-wrap input {
                width: 100%;
                height: 48px;
                padding: 0 82px 0 14px;
                border: 1px solid #3f4147;
                border-radius: 10px;
                outline: none;
                color: #f2f3f5;
                background: #111318;
                font: inherit;
                font-size: 16px;
            }
            .hls-password-wrap input:focus { border-color: #23a55a; box-shadow: 0 0 0 3px rgba(35, 165, 90, .16); }
            .hls-password-toggle {
                position: absolute;
                top: 50%;
                right: 10px;
                transform: translateY(-50%);
                border: 0;
                color: #b5bac1;
                background: transparent;
                cursor: pointer;
                font: inherit;
                font-size: 12px;
                font-weight: 600;
            }
            .hls-primary-button {
                height: 44px;
                border: 0;
                border-radius: 10px;
                color: white;
                background: #23a55a;
                font: inherit;
                font-weight: 700;
                cursor: pointer;
                transition: background .12s ease, transform .08s ease;
            }
            .hls-primary-button:hover { background: #1a8f4b; }
            .hls-primary-button:active { transform: scale(.985); }
            .hls-primary-button:disabled { opacity: .55; cursor: wait; }

            .hls-pattern-hint { margin-bottom: 10px; color: #80848e; font-size: 12px; }
            .hls-pattern-pad {
                position: relative;
                width: min(300px, 76vw);
                aspect-ratio: 1;
                margin: 0 auto;
                touch-action: none;
                cursor: crosshair;
            }
            .hls-pattern-pad.compact { width: min(270px, 72vw); }
            .hls-pattern-pad svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
            .hls-pattern-pad polyline { stroke: #23a55a; stroke-width: 8; opacity: .85; }
            .hls-pattern-node {
                position: absolute;
                width: 52px;
                height: 52px;
                display: grid;
                place-items: center;
                transform: translate(-50%, -50%);
                border: 2px solid #6d6f78;
                border-radius: 50%;
                background: #1a1d23;
                transition: border-color .1s ease, background .1s ease, transform .1s ease;
                pointer-events: none;
            }
            .hls-pattern-node span { width: 12px; height: 12px; border-radius: 50%; background: #6d6f78; }
            .hls-pattern-node.selected { border-color: #23a55a; background: rgba(35, 165, 90, .16); transform: translate(-50%, -50%) scale(1.06); }
            .hls-pattern-node.selected span { background: #23a55a; }
            .hls-pattern-pad.failure polyline { stroke: #da373c; }
            .hls-pattern-pad.failure .hls-pattern-node.selected { border-color: #da373c; background: rgba(218, 55, 60, .16); }
            .hls-pattern-pad.failure .hls-pattern-node.selected span { background: #da373c; }
            .hls-pattern-pad.success polyline { stroke: #23a55a; }

            .hls-shake { animation: hls-shake .32s ease; }
            @keyframes hls-shake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-8px); }
                40% { transform: translateX(7px); }
                60% { transform: translateX(-5px); }
                80% { transform: translateX(3px); }
            }

            #haxurus-lockscreen-button {
                position: fixed;
                right: 18px;
                bottom: 18px;
                z-index: 9999;
                width: 40px;
                height: 40px;
                display: grid;
                place-items: center;
                border: 1px solid rgba(255, 255, 255, .1);
                border-radius: 14px;
                color: #dbdee1;
                background: rgba(30, 31, 34, .92);
                box-shadow: 0 8px 24px rgba(0, 0, 0, .28);
                cursor: pointer;
                transition: transform .12s ease, background .12s ease, color .12s ease;
            }
            #haxurus-lockscreen-button:hover { color: white; background: #23a55a; transform: translateY(-2px); }
            #haxurus-lockscreen-button svg { width: 20px; height: 20px; fill: currentColor; }
            html[data-haxurus-locked="true"] #haxurus-lockscreen-button { display: none; }

            .hls-settings {
                max-width: 820px;
                padding: 4px 4px 40px;
                color: var(--text-primary);
                font-family: var(--font-primary, "gg sans", sans-serif);
            }
            .hls-settings * { box-sizing: border-box; }
            .hls-settings-heading { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
            .hls-settings-heading h2 { margin: 0 0 4px; font-size: 22px; }
            .hls-settings-heading p { margin: 0; color: var(--text-muted); }
            .hls-settings-icon {
                width: 46px;
                height: 46px;
                display: grid;
                place-items: center;
                border-radius: 14px;
                background: #23a55a;
            }
            .hls-settings-icon svg { width: 28px; height: 28px; fill: white; }
            .hls-settings-warning {
                margin-bottom: 16px;
                padding: 12px 14px;
                border: 1px solid rgba(250, 168, 26, .35);
                border-radius: 10px;
                color: var(--text-normal);
                background: rgba(250, 168, 26, .09);
                line-height: 1.45;
            }
            .hls-settings-card {
                margin-bottom: 16px;
                overflow: hidden;
                border: 1px solid var(--background-modifier-accent);
                border-radius: 12px;
                background: var(--background-secondary);
            }
            .hls-settings-card-header { padding: 16px 18px 13px; border-bottom: 1px solid var(--background-modifier-accent); }
            .hls-settings-card-header h3 { margin: 0 0 4px; font-size: 16px; }
            .hls-settings-card-header p { margin: 0; color: var(--text-muted); font-size: 13px; }
            .hls-settings-card-body { padding: 0 18px; }
            .hls-setting-row {
                min-height: 68px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 20px;
                padding: 13px 0;
                border-bottom: 1px solid var(--background-modifier-accent);
            }
            .hls-setting-row:last-child { border-bottom: 0; }
            .hls-setting-copy { min-width: 0; }
            .hls-setting-title { color: var(--text-primary); font-weight: 600; }
            .hls-setting-description { margin-top: 4px; color: var(--text-muted); font-size: 12px; line-height: 1.35; }
            .hls-settings-input {
                width: min(260px, 48%);
                min-width: 140px;
                height: 38px;
                padding: 0 10px;
                border: 1px solid var(--input-border, var(--background-modifier-accent));
                border-radius: 8px;
                outline: 0;
                color: var(--text-primary);
                background: var(--input-background, var(--background-tertiary));
                font: inherit;
            }
            .hls-settings-input:focus { border-color: #23a55a; box-shadow: 0 0 0 2px rgba(35, 165, 90, .15); }
            .hls-number-input { width: 96px; min-width: 96px; }
            .hls-toggle {
                width: 42px;
                height: 24px;
                flex: 0 0 auto;
                appearance: none;
                position: relative;
                border-radius: 999px;
                background: var(--background-modifier-selected);
                cursor: pointer;
                transition: background .15s ease;
            }
            .hls-toggle::after {
                content: "";
                position: absolute;
                width: 18px;
                height: 18px;
                top: 3px;
                left: 3px;
                border-radius: 50%;
                background: white;
                transition: transform .15s ease;
            }
            .hls-toggle:checked { background: #23a55a; }
            .hls-toggle:checked::after { transform: translateX(18px); }
            .hls-credential-setup { padding-bottom: 16px; }
            .hls-pattern-setup-title { margin: 18px 0 8px; text-align: center; font-weight: 600; }
            .hls-settings-status { min-height: 20px; margin-top: 10px; color: var(--text-muted); font-size: 13px; text-align: center; }
            .hls-settings-status.success { color: #23a55a; }
            .hls-settings-status.error { color: #da373c; }
            .hls-settings-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
            .hls-settings-actions-wide { justify-content: flex-start; padding: 18px 0; margin: 0; }
            .hls-settings-button {
                min-height: 38px;
                padding: 0 14px;
                border: 0;
                border-radius: 8px;
                color: white;
                font: inherit;
                font-weight: 600;
                cursor: pointer;
            }
            .hls-settings-button.primary { background: #23a55a; }
            .hls-settings-button.primary:hover { background: #1a8f4b; }
            .hls-settings-button.secondary { background: var(--button-secondary-background, #4e5058); }
            .hls-settings-button.danger { background: #da373c; }
            .hls-settings-button.danger:hover { background: #a1282c; }
            .hls-settings-button:disabled { opacity: .55; cursor: wait; }

            @media (max-width: 520px) {
                .hls-card { padding: 24px 18px 20px; border-radius: 18px; }
                .hls-time { font-size: 36px; }
                .hls-setting-row { align-items: flex-start; flex-direction: column; gap: 10px; }
                .hls-settings-input { width: 100%; }
            }
        `);
    }
};
