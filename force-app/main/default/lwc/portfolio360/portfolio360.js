import { LightningElement, wire } from 'lwc';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

// Fired by c-portfolio-nav (the floating dock) — the single navigation surface.
const NAVIGATE_EVENT = 'portfolio360navigate';
const TABS = ['experience', 'skills', 'certifications', 'education'];

export default class Portfolio360 extends LightningElement {
    activeTab = TABS[0];

    profilesKnownEmpty = false;

    @wire(getProfiles)
    wiredProfilesGuard({ data }) {
        if (data) {
            this.profilesKnownEmpty = data.length === 0;
        }
    }

    get siteHasProfiles() {
        return !this.profilesKnownEmpty;
    }

    connectedCallback() {
        try {
            const hash = window.location.hash.replace('#', '').toLowerCase();
            if (TABS.includes(hash)) {
                this.activeTab = hash;
            }
        } catch {
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
            } catch {
                // ignore — see above
            }
        };
        // NOTE: no document.startViewTransition here — rendering pauses during
        // its update callback, so waiting on rAF deadlocks (page freezes ~4s per
        // click). The CSS panel fade provides the crossfade instead.
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
