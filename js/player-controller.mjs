export function createPlayerController(trackIds, hooks = {}) {
    const allowed = new Set(trackIds);
    const widgets = new Map();
    let activeId = null;
    let playing = false;
    let requestedId = null;

    function assertTrack(id) {
        if (!allowed.has(id)) throw new Error(`Unknown track: ${id}`);
    }

    function notify() {
        hooks.onStateChange?.({ activeId, playing });
    }

    function setState(id, isPlaying) {
        activeId = id;
        playing = isPlaying;
        notify();
    }

    function toggle(id) {
        assertTrack(id);
        const widget = widgets.get(id);
        if (!widget) throw new Error(`Widget not ready for track: ${id}`);

        if (activeId === id && playing) {
            requestedId = null;
            widget.pause();
            setState(id, false);
            return;
        }

        requestedId = id;
        for (const [otherId, otherWidget] of widgets) {
            if (otherId !== id && otherId === activeId) otherWidget.pause();
        }
        setState(id, true);
        widget.play();
    }

    return {
        register(id, widget) {
            assertTrack(id);
            if (!widget || typeof widget.play !== 'function' || typeof widget.pause !== 'function') {
                throw new Error(`Invalid widget for track: ${id}`);
            }
            widgets.set(id, widget);
            hooks.onReady?.(id);
        },

        toggle,

        toggleCurrentOr(defaultId) {
            assertTrack(defaultId);
            toggle(activeId || defaultId);
        },

        handlePlay(id) {
            assertTrack(id);
            if (requestedId !== id) {
                widgets.get(id)?.pause();
                return;
            }
            for (const [otherId, widget] of widgets) {
                if (otherId !== id && otherId === activeId) widget.pause();
            }
            setState(id, true);
        },

        handlePause(id) {
            assertTrack(id);
            if (activeId === id) setState(id, false);
        },

        handleProgress(id, ratio) {
            assertTrack(id);
            if (activeId !== id) return;
            const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
            hooks.onProgress?.(id, clamped);
        },

        seek(id, ratio) {
            assertTrack(id);
            const widget = widgets.get(id);
            if (!widget) throw new Error(`Widget not ready for track: ${id}`);
            if (typeof widget.getDuration !== 'function' || typeof widget.seekTo !== 'function') {
                throw new Error(`Widget cannot seek track: ${id}`);
            }
            const clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
            widget.getDuration(duration => {
                if (!Number.isFinite(duration) || duration <= 0) return;
                widget.seekTo(duration * clamped);
                hooks.onProgress?.(id, clamped);
            });
        },

        handleError(id) {
            assertTrack(id);
            if (activeId === id) {
                requestedId = null;
                setState(id, false);
            }
            hooks.onError?.(id);
        },

        getState() {
            return { activeId, playing };
        },
    };
}
