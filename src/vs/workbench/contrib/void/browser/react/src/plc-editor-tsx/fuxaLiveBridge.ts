/*
 * fuxaLiveBridge — exposes live tag values from logicStore via window.__fuxaLiveTags
 * so the Electron main process (fuxaProcess.js) can poll and serve them on port 9091.
 */

import { logicStore } from './logicStore.js';

declare global {
    interface Window {
        __fuxaLiveTags: Record<string, string | undefined>;
    }
}

let _started = false;

export function startFuxaLiveBridge() {
    if (_started) return;
    _started = true;

    window.__fuxaLiveTags = {};

    const update = () => {
        const tags = logicStore.state.tagDatabase;
        const out: Record<string, string | undefined> = {};
        for (const t of tags) {
            out[t.name] = t.liveValue ?? t.forcedValue;
        }
        window.__fuxaLiveTags = out;
    };

    logicStore.subscribe(update);
    update();
}
