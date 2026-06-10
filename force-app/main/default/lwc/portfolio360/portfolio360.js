import { LightningElement, wire } from 'lwc';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';
import getItemSections from '@salesforce/apex/PortfolioController.getItemSections';

// Fired by c-portfolio-nav (the floating dock) — the single navigation surface.
const NAVIGATE_EVENT = 'portfolio360navigate';
// Fired by this component whenever the visible page changes; the dock follows.
const TAB_IN_VIEW_EVENT = 'portfolio360tabinview';
const TABS = ['experience', 'skills', 'certifications', 'education', 'more'];
const TAB_LABELS = {
    experience: 'Experience',
    skills: 'Skills',
    certifications: 'Certifications',
    education: 'Education & Awards',
    more: 'More'
};

// Vertical scrolling NEVER flips pages — heuristic intent detection on kinetic
// devices is unreliable. Page turns are deterministic: dock, Next/Prev
// buttons, or clearly-horizontal gestures.
const WHEEL_COOLDOWN_MS = 450;
const GESTURE_GAP_MS = 250;
const LATCH_HARD_CAP_MS = 1100;
const WHEEL_MIN_DELTA = 30;
const SWIPE_MIN_PX = 60;
// truly back at the top (hero) — the reading sequence restarts there
const TOP_ZONE_PX = 48;

export default class Portfolio360 extends LightningElement {
    activeTab = TABS[0];
    slideClass = '';
    lastFlipAt = 0;
    lastWheelEventAt = 0;
    requireNewGesture = false;
    prevScrollY = 0;
    scrollTicking = false;
    touchStartX = 0;
    touchStartY = 0;
    profileId = null;
    hasMoreItems = false;

    profilesKnownEmpty = false;

    @wire(getProfiles)
    wiredProfilesGuard({ data }) {
        if (data) {
            this.profilesKnownEmpty = data.length === 0;
        }
    }

    @wire(getItemSections, { profileId: '$profileId' })
    wiredItemSections({ data }) {
        if (data) {
            this.hasMoreItems = data.length > 0;
        }
    }

    get siteHasProfiles() {
        return !this.profilesKnownEmpty;
    }

    // 'more' is only navigable when dynamic items exist — never page onto a blank
    get availableTabs() {
        return this.hasMoreItems ? TABS : TABS.slice(0, -1);
    }

    get prevLabel() {
        const tabs = this.availableTabs;
        const index = tabs.indexOf(this.activeTab);
        return index > 0 ? TAB_LABELS[tabs[index - 1]] : undefined;
    }

    get nextLabel() {
        const tabs = this.availableTabs;
        const index = tabs.indexOf(this.activeTab);
        return index >= 0 && index < tabs.length - 1 ? TAB_LABELS[tabs[index + 1]] : undefined;
    }

    get showPagerNav() {
        return Boolean(this.prevLabel || this.nextLabel);
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
        this.boundProfileChange = (event) => {
            this.profileId = event.detail.profileId;
        };
        window.addEventListener('portfolioprofilechange', this.boundProfileChange);
        this.prevScrollY = window.scrollY;
        this.boundScroll = () => this.queueScrollCheck();
        window.addEventListener('scroll', this.boundScroll, { passive: true });
        // window-level input so gestures work regardless of what's under the cursor
        this.boundWheel = (event) => this.handleWheel(event);
        window.addEventListener('wheel', this.boundWheel, { passive: true });
        this.boundTouchStart = (event) => this.handleTouchStart(event);
        window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
        this.boundTouchEnd = (event) => this.handleTouchEnd(event);
        window.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    }

    disconnectedCallback() {
        const cleanup = [
            [NAVIGATE_EVENT, 'boundNavigate'],
            ['portfolioprofilechange', 'boundProfileChange'],
            ['scroll', 'boundScroll'],
            ['wheel', 'boundWheel'],
            ['touchstart', 'boundTouchStart'],
            ['touchend', 'boundTouchEnd']
        ];
        cleanup.forEach(([name, prop]) => {
            if (this[prop]) {
                window.removeEventListener(name, this[prop]);
                this[prop] = undefined;
            }
        });
    }

    queueScrollCheck() {
        if (this.scrollTicking) {
            return;
        }
        this.scrollTicking = true;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        requestAnimationFrame(() => {
            this.scrollTicking = false;
            this.onScrollFrame();
        });
    }

    // coming back up to the very top restarts the sequence: the next
    // read-through starts from the FIRST tab again
    onScrollFrame() {
        const y = window.scrollY;
        if (y < TOP_ZONE_PX && this.prevScrollY >= TOP_ZONE_PX && this.activeTab !== TABS[0]) {
            this.switchTo(TABS[0], { animate: false, land: 'keep' });
        }
        this.prevScrollY = y;
    }

    handleNavigate(event) {
        const tabId = event.detail && event.detail.tabId;
        this.switchTo(tabId);
    }

    handlePrev() {
        this.step(-1);
    }

    handleNext() {
        this.step(1);
    }

    switchTo(tabId, { animate = true, land = 'top' } = {}) {
        if (!this.availableTabs.includes(tabId) || tabId === this.activeTab) {
            return;
        }
        // any flip latches wheel paging until the current kinetic stream ends
        this.requireNewGesture = true;
        // entering page slides in from the direction of travel
        this.slideClass = !animate ? ''
            : TABS.indexOf(tabId) > TABS.indexOf(this.activeTab)
                ? 'slide-from-right'
                : 'slide-from-left';
        this.activeTab = tabId;
        window.dispatchEvent(new CustomEvent(TAB_IN_VIEW_EVENT, { detail: { tabId } }));
        try {
            window.history.replaceState(null, '', `#${tabId}`);
        } catch {
            // ignore — see above
        }
        if (land === 'top') {
            this.ensureTopVisible();
        }
    }

    step(direction) {
        const tabs = this.availableTabs;
        const index = tabs.indexOf(this.activeTab) + direction;
        if (index >= 0 && index < tabs.length) {
            this.switchTo(tabs[index]);
        }
    }

    // ONLY clearly-horizontal wheel gestures flip pages (sideways trackpad
    // swipe / tilt wheel); vertical scrolling is plain reading.
    handleWheel(event) {
        const now = Date.now();
        const sinceLast = now - this.lastWheelEventAt;
        this.lastWheelEventAt = now;
        if (this.requireNewGesture) {
            if (sinceLast <= GESTURE_GAP_MS && now - this.lastFlipAt < LATCH_HARD_CAP_MS) {
                return;
            }
            this.requireNewGesture = false;
        }
        // Firefox reports lines, not pixels
        const unit = event.deltaMode === 1 ? 16 : 1;
        const deltaX = event.deltaX * unit;
        const deltaY = event.deltaY * unit;
        const horizontal = Math.abs(deltaX) > Math.abs(deltaY) * 2
            && Math.abs(deltaX) > WHEEL_MIN_DELTA;
        if (horizontal && now - this.lastFlipAt >= WHEEL_COOLDOWN_MS) {
            this.lastFlipAt = now;
            this.step(deltaX > 0 ? 1 : -1);
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
        }
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
