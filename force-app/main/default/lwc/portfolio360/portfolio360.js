import { LightningElement, wire } from 'lwc';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

// Fired by c-portfolio-nav (the floating dock) — the single navigation surface.
const NAVIGATE_EVENT = 'portfolio360navigate';
// Fired by this component as panels scroll into view; the dock highlights along.
const TAB_IN_VIEW_EVENT = 'portfolio360tabinview';
const TABS = ['experience', 'skills', 'certifications', 'education', 'more'];

export default class Portfolio360 extends LightningElement {
    spyStarted = false;
    observer;

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
        this.boundNavigate = (event) => this.handleNavigate(event);
        window.addEventListener(NAVIGATE_EVENT, this.boundNavigate);
    }

    disconnectedCallback() {
        if (this.boundNavigate) {
            window.removeEventListener(NAVIGATE_EVENT, this.boundNavigate);
            this.boundNavigate = undefined;
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = undefined;
        }
    }

    renderedCallback() {
        if (this.spyStarted) {
            return;
        }
        const panels = this.template.querySelectorAll('[data-tab]');
        if (!panels.length) {
            return;
        }
        this.spyStarted = true;
        // Spy is progressive enhancement: panels scrolling through the middle
        // band of the viewport broadcast their tab so the dock follows along.
        try {
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            const tabId = entry.target.dataset.tab;
                            window.dispatchEvent(
                                new CustomEvent(TAB_IN_VIEW_EVENT, { detail: { tabId } })
                            );
                            try {
                                window.history.replaceState(null, '', `#${tabId}`);
                            } catch {
                                // hash sync is a nice-to-have
                            }
                        }
                    });
                },
                { rootMargin: '-40% 0px -55% 0px' }
            );
            panels.forEach((panel) => this.observer.observe(panel));
        } catch {
            this.observer = undefined;
        }
        // deep link: land on the hashed tab
        try {
            const hash = window.location.hash.replace('#', '').toLowerCase();
            if (TABS.includes(hash)) {
                this.scrollToTab(hash, 'auto');
            }
        } catch {
            // ignore
        }
    }

    handleNavigate(event) {
        const tabId = event.detail && event.detail.tabId;
        if (TABS.includes(tabId)) {
            this.scrollToTab(tabId, this.preferredBehavior());
        }
    }

    scrollToTab(tabId, behavior) {
        const panel = this.template.querySelector(`[data-tab="${tabId}"]`);
        if (panel) {
            panel.scrollIntoView({ behavior, block: 'start' });
        }
    }

    preferredBehavior() {
        try {
            if (typeof window.matchMedia === 'function'
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return 'auto';
            }
        } catch {
            // fall through
        }
        return 'smooth';
    }
}
