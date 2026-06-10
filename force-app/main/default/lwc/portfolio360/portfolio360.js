import { LightningElement, wire } from 'lwc';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

// Fired by c-portfolio-nav (the floating dock) — the single navigation surface.
const NAVIGATE_EVENT = 'portfolio360navigate';
// Fired by this component whenever the visible page changes; the dock follows.
const TAB_IN_VIEW_EVENT = 'portfolio360tabinview';
const TABS = ['experience', 'skills', 'certifications', 'education', 'more'];
const WHEEL_COOLDOWN_MS = 550;
// a wheel event after this much silence is a NEW gesture; anything sooner is
// momentum/inertia continuation and must never flip a page
const GESTURE_GAP_MS = 250;
const WHEEL_MIN_DELTA = 30;
const SWIPE_MIN_PX = 60;

export default class Portfolio360 extends LightningElement {
    activeTab = TABS[0];
    slideClass = '';
    lastFlipAt = 0;
    lastWheelEventAt = 0;
    touchStartX = 0;
    touchStartY = 0;

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
        this.switchTo(tabId);
    }

    switchTo(tabId) {
        if (!TABS.includes(tabId) || tabId === this.activeTab) {
            return;
        }
        // entering page slides in from the direction of travel
        this.slideClass = TABS.indexOf(tabId) > TABS.indexOf(this.activeTab)
            ? 'slide-from-right'
            : 'slide-from-left';
        this.activeTab = tabId;
        window.dispatchEvent(new CustomEvent(TAB_IN_VIEW_EVENT, { detail: { tabId } }));
        try {
            window.history.replaceState(null, '', `#${tabId}`);
        } catch {
            // ignore — see above
        }
        this.ensureTopVisible();
    }

    step(direction) {
        const index = TABS.indexOf(this.activeTab) + direction;
        if (index >= 0 && index < TABS.length) {
            this.switchTo(TABS[index]);
        }
    }

    // horizontal trackpad/mouse-tilt scrolling flips pages; vertical scrolling
    // past the END of a page advances to the next tab in order. Only a FRESH
    // gesture flips — momentum events chain otherwise and skip through pages.
    handleWheel(event) {
        const now = Date.now();
        const freshGesture = now - this.lastWheelEventAt > GESTURE_GAP_MS;
        this.lastWheelEventAt = now;
        if (!freshGesture || now - this.lastFlipAt < WHEEL_COOLDOWN_MS) {
            return;
        }
        // Firefox reports lines, not pixels
        const unit = event.deltaMode === 1 ? 16 : 1;
        const deltaX = event.deltaX * unit;
        const deltaY = event.deltaY * unit;
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > WHEEL_MIN_DELTA) {
            this.lastFlipAt = now;
            this.step(deltaX > 0 ? 1 : -1);
            return;
        }
        if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > WHEEL_MIN_DELTA
            && this.isAtPageBottom()) {
            this.lastFlipAt = now;
            this.step(1);
        }
    }

    handleTouchStart(event) {
        const touch = event.touches && event.touches[0];
        if (touch) {
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
        }
    }

    handleTouchEnd(event) {
        const touch = event.changedTouches && event.changedTouches[0];
        if (!touch) {
            return;
        }
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;
        if (Math.abs(deltaX) > SWIPE_MIN_PX && Math.abs(deltaX) > Math.abs(deltaY)) {
            this.step(deltaX < 0 ? 1 : -1);
        } else if (deltaY < -SWIPE_MIN_PX && Math.abs(deltaY) > Math.abs(deltaX)
            && this.isAtPageBottom()) {
            // swiping up at the end of a page moves to the next one
            this.step(1);
        }
    }

    isAtPageBottom() {
        const doc = document.documentElement;
        return window.innerHeight + window.scrollY >= doc.scrollHeight - 16;
    }

    ensureTopVisible() {
        const wrap = this.template.querySelector('.wrap');
        if (wrap && wrap.getBoundingClientRect().top < 0) {
            wrap.scrollIntoView({ behavior: this.preferredBehavior(), block: 'start' });
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

    panelCls(id) {
        return id === this.activeTab ? `panel ${this.slideClass}`.trim() : 'panel hidden';
    }

    get experiencePanelClass() {
        return this.panelCls('experience');
    }

    get skillsPanelClass() {
        return this.panelCls('skills');
    }

    get certificationsPanelClass() {
        return this.panelCls('certifications');
    }

    get educationPanelClass() {
        return this.panelCls('education');
    }

    get morePanelClass() {
        return this.panelCls('more');
    }
}
