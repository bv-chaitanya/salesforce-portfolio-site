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
// page start counts as visible while the wrap top is at/below this offset
const TOP_EDGE_PX = -8;
// continued scroll distance inside a boundary zone that flips without a
// fresh impulse
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
    topAccum = 0;
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
    // scroll-down reads from the FIRST tab again
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

    switchTo(tabId, { animate = true, land = 'top' } = {}) {
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
        if (land === 'top') {
            this.ensureTopVisible();
        } else if (land === 'bottom') {
            this.landAtBottom();
        }
    }

    step(direction, land = 'top') {
        const tabs = this.availableTabs;
        const index = tabs.indexOf(this.activeTab) + direction;
        if (index >= 0 && index < tabs.length) {
            this.switchTo(tabs[index], { land });
        }
    }

    // horizontal scrolling flips pages; vertical scrolling past a page
    // BOUNDARY pages forward/back. A flip needs a HUMAN IMPULSE (fresh
    // gesture, rising delta — inertia only decays — or a constant mouse
    // notch) or enough continued in-zone scroll distance.
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
            this.topAccum = 0;
            if (impulse && !coolingDown) {
                this.lastFlipAt = now;
                this.step(deltaX > 0 ? 1 : -1);
            }
            return;
        }
        if (deltaY > 0) {
            this.topAccum = 0;
            if (!this.isAtPageBottom()) {
                this.bottomAccum = 0;
                return;
            }
            this.bottomAccum += deltaY;
            if (!coolingDown && (impulse || this.bottomAccum > OVERSHOOT_PX)) {
                this.lastFlipAt = now;
                this.bottomAccum = 0;
                this.step(1, 'top');
            }
            return;
        }
        if (deltaY < 0) {
            this.bottomAccum = 0;
            if (!this.isAtPageTop()) {
                this.topAccum = 0;
                return;
            }
            this.topAccum += -deltaY;
            if (!coolingDown && (impulse || this.topAccum > OVERSHOOT_PX)) {
                this.lastFlipAt = now;
                this.topAccum = 0;
                // previous page, landing at its bottom for scroll continuity
                this.step(-1, 'bottom');
            }
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
            this.step(1, 'top');
        } else if (deltaY > SWIPE_MIN_PX && Math.abs(deltaY) > Math.abs(deltaX)
            && this.isAtPageTop()) {
            // swiping down at the start of a page moves back one
            this.step(-1, 'bottom');
        }
    }

    isAtPageBottom() {
        const doc = document.documentElement;
        return window.innerHeight + window.scrollY >= doc.scrollHeight - BOTTOM_ZONE_PX;
    }

    isAtPageTop() {
        const wrap = this.template.querySelector('.wrap');
        return Boolean(wrap) && wrap.getBoundingClientRect().top >= TOP_EDGE_PX;
    }

    ensureTopVisible() {
        const wrap = this.template.querySelector('.wrap');
        if (wrap && wrap.getBoundingClientRect().top < 0) {
            wrap.scrollIntoView({ behavior: this.preferredBehavior(), block: 'start' });
        }
    }

    landAtBottom() {
        // double rAF: wait for the re-render before measuring the new height
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        requestAnimationFrame(() => {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            requestAnimationFrame(() => {
                const doc = document.documentElement;
                const top = Math.max(0, doc.scrollHeight - window.innerHeight - 4);
                window.scrollTo({ top, behavior: 'auto' });
                this.prevScrollY = window.scrollY;
            });
        });
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
