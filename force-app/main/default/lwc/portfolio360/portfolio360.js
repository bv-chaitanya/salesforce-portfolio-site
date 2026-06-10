import { LightningElement } from 'lwc';

// Fired by c-portfolio-nav (the floating dock) — the single navigation surface.
const NAVIGATE_EVENT = 'portfolio360navigate';
const TABS = ['experience', 'skills', 'certifications', 'education'];

export default class Portfolio360 extends LightningElement {
    activeTab = TABS[0];

    connectedCallback() {
        try {
            const hash = window.location.hash.replace('#', '').toLowerCase();
            if (TABS.includes(hash)) {
                this.activeTab = hash;
            }
        } catch (e) {
            // hash routing is a nice-to-have; never break rendering over it
        }
        this.boundNavigate = (event) => this.handleNavigate(event);
        window.addEventListener(NAVIGATE_EVENT, this.boundNavigate);
    }

    disconnectedCallback() {
        if (this.boundNavigate) {
            window.removeEventListener(NAVIGATE_EVENT, this.boundNavigate);
            this.boundNavigate = undefined;
        }
    }

    handleNavigate(event) {
        const tabId = event.detail && event.detail.tabId;
        if (!TABS.includes(tabId) || tabId === this.activeTab) {
            return;
        }
        const apply = () => {
            this.activeTab = tabId;
            try {
                window.history.replaceState(null, '', `#${tabId}`);
            } catch (e) {
                // ignore — see above
            }
        };
        // View Transitions crossfade where supported; plain swap elsewhere
        try {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (typeof document.startViewTransition === 'function' && !reduceMotion) {
                document.startViewTransition(() => {
                    apply();
                    // give LWC a frame to flush the re-render before the snapshot
                    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
                });
                return;
            }
        } catch (e) {
            // fall through to plain swap
        }
        apply();
    }

    panelClass(id) {
        return this.activeTab === id ? 'panel' : 'panel hidden';
    }

    get experiencePanelClass() {
        return this.panelClass('experience');
    }

    get skillsPanelClass() {
        return this.panelClass('skills');
    }

    get certificationsPanelClass() {
        return this.panelClass('certifications');
    }

    get educationPanelClass() {
        return this.panelClass('education');
    }
}
