import { LightningElement, wire } from 'lwc';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';
import getItemSections from '@salesforce/apex/PortfolioController.getItemSections';

// Fired by c-portfolio-nav (the floating dock) — the single navigation surface.
const NAVIGATE_EVENT = 'portfolio360navigate';
// Fired by this component whenever the visible page changes; the dock follows.
const TAB_IN_VIEW_EVENT = 'portfolio360tabinview';
const TABS = ['experience', 'skills', 'certifications', 'education', 'more'];
const WHEEL_COOLDOWN_MS = 450;
// silence longer than this marks a brand-new gesture
const GESTURE_GAP_MS = 250;
const WHEEL_MIN_DELTA = 30;
// discrete mouse-wheel notches repeat a constant large delta
const NOTCH_MIN_DELTA = 40;
// the page is "at its end" once inside this zone (content ends ~120px of
// dock-clearance padding above the hard bottom)
const BOTTOM_ZONE_PX = 160;
// continued scroll distance inside the zone that flips without a new impulse
const OVERSHOOT_PX = 160;
const SWIPE_MIN_PX = 60;
// truly back at the top (hero) — small on purpose: short pages live at low
// scrollY values, so a generous zone would hijack their up-scrolls
const TOP_ZONE_PX = 48;

export default class Portfolio360 extends LightningElement {
    activeTab = TABS[0];
    slideClass = '';
    lastFlipAt = 0;
    lastWheelEventAt = 0;
    lastAbsDelta = 0;
    bottomAccum = 0;
    profileId = null;
    hasMoreItems = false;
    prevScrollY = 0;
    scrollTicking = false;
    touchStartX = 0;
    touchStartY = 0;

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

    // 'more' is only navigable when dynamic items exist — never page onto a blank
    get availableTabs() {
        return this.hasMoreItems ? TABS : TABS.slice(0, -1);
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
        this.boundProfileChange = (event) => {
            this.profileId = event.detail.profileId;
        };
        window.addEventListener('portfolioprofilechange', this.boundProfileChange);
        this.prevScrollY = window.scrollY;
        this.boundScroll = () => this.queueScrollCheck();
        window.addEventListener('scroll', this.boundScroll, { passive: true });
        // window-level input: page flips must not depend on which element the
        // cursor/finger happens to be over (the hero fills half the viewport
        // on short pages)
        this.boundWheel = (event) => this.handleWheel(event);
        window.addEventListener('wheel', this.boundWheel, { passive: true });
        this.boundTouchStart = (event) => this.handleTouchStart(event);
        window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
        this.boundTouchEnd = (event) => this.handleTouchEnd(event);
        window.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    }

    disconnectedCallback() {
        if (this.boundNavigate) {
            window.removeEventListener(NAVIGATE_EVENT, this.boundNavigate);
            this.boundNavigate = undefined;
        }
        if (this.boundScroll) {
            window.removeEventListener('scroll', this.boundScroll);
            this.boundScroll = undefined;
        }
        if (this.boundProfileChange) {
            window.removeEventListener('portfolioprofilechange', this.boundProfileChange);
            this.boundProfileChange = undefined;
        }
        if (this.boundWheel) {
            window.removeEventListener('wheel', this.boundWheel);
            this.boundWheel = undefined;
        }
        if (this.boundTouchStart) {
            window.removeEventListener('touchstart', this.boundTouchStart);
            this.boundTouchStart = undefined;
        }
        if (this.boundTouchEnd) {
            window.removeEventListener('touchend', this.boundTouchEnd);
            this.boundTouchEnd = undefined;
        }
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

    // coming back up to the hero restarts the sequence: the next scroll-down
    // reads from the FIRST tab again instead of wherever the visitor left off
    onScrollFrame() {
        const y = window.scrollY;
        if (y < TOP_ZONE_PX && this.prevScrollY >= TOP_ZONE_PX && this.activeTab !== TABS[0]) {
            this.switchTo(TABS[0], false);
        }
        this.prevScrollY = y;
    }

    handleNavigate(event) {
        const tabId = event.detail && event.detail.tabId;
        this.switchTo(tabId);
    }

    switchTo(tabId, animate = true) {
        if (!this.availableTabs.includes(tabId) || tabId === this.activeTab) {
            return;
        }
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
        this.ensureTopVisible();
    }

    step(direction) {
        const tabs = this.availableTabs;
        const index = tabs.indexOf(this.activeTab) + direction;
        if (index >= 0 && index < tabs.length) {
            this.switchTo(tabs[index]);
        }
    }

    // horizontal trackpad/mouse-tilt scrolling flips pages; vertical scrolling
    // past the END of a page advances to the next tab in order. A flip needs a
    // HUMAN IMPULSE: a fresh gesture after silence, a RISING delta (trackpad
    // inertia only decays), or a constant large notch (discrete mouse wheel).
    handleWheel(event) {
        const now = Date.now();
        const sinceLast = now - this.lastWheelEventAt;
        this.lastWheelEventAt = now;
        // Firefox reports lines, not pixels
        const unit = event.deltaMode === 1 ? 16 : 1;
        const deltaX = event.deltaX * unit;
        const deltaY = event.deltaY * unit;
        const dominantX = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
        const abs = dominantX ? Math.abs(deltaX) : Math.abs(deltaY);
        const prevAbs = sinceLast > GESTURE_GAP_MS ? 0 : this.lastAbsDelta;
        this.lastAbsDelta = abs;
        const coolingDown = now - this.lastFlipAt < WHEEL_COOLDOWN_MS;
        const impulse = abs >= WHEEL_MIN_DELTA && (prevAbs === 0
            || abs > prevAbs * 1.2
            || (abs >= NOTCH_MIN_DELTA && Math.abs(abs - prevAbs) < 1));

        if (dominantX) {
            this.bottomAccum = 0;
            if (impulse && !coolingDown) {
                this.lastFlipAt = now;
                this.step(deltaX > 0 ? 1 : -1);
            }
            return;
        }
        if (deltaY <= 0 || !this.isAtPageBottom()) {
            this.bottomAccum = 0;
            return;
        }
        // inside the bottom zone: a fresh impulse OR enough continued scroll
        // distance from the same gesture flips — one flip max, then cooldown
        this.bottomAccum += deltaY;
        if (!coolingDown && (impulse || this.bottomAccum > OVERSHOOT_PX)) {
            this.lastFlipAt = now;
            this.bottomAccum = 0;
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
        return window.innerHeight + window.scrollY >= doc.scrollHeight - BOTTOM_ZONE_PX;
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
