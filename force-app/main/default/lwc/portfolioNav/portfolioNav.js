import { LightningElement, wire } from 'lwc';
import getProfile from '@salesforce/apex/PortfolioController.getProfile';
import getItemSections from '@salesforce/apex/PortfolioController.getItemSections';

// Consumed by c-portfolio360, which swaps its panels in response.
const NAVIGATE_EVENT = 'portfolio360navigate';
const TAB_IN_VIEW_EVENT = 'portfolio360tabinview';
const ITEMS = [
    { id: 'about', label: 'About' },
    { id: 'experience', label: 'Experience' },
    { id: 'skills', label: 'Skills' },
    { id: 'certifications', label: 'Certifications' },
    { id: 'education', label: 'Education & Awards' }
];
const TAB_IDS = new Set(['experience', 'skills', 'certifications', 'education', 'more']);
const MORE_ITEM = { id: 'more', label: 'More' };
const HERO_SELECTOR = 'c-portfolio-hero';
// the big hero name sits ~240px into the hero — reveal the chip as it exits
const NAME_REVEAL_OFFSET_PX = 240;

export default class PortfolioNav extends LightningElement {
    activeId = 'about';
    lastTabId = 'experience';
    profileName;
    profileId = null;
    showName = false;
    indicatorReady = false;
    scrollTicking = false;

    hasProfile = false;
    hasMoreItems = false;

    @wire(getItemSections, { profileId: '$profileId' })
    wiredItemSections({ data }) {
        if (data) {
            this.hasMoreItems = data.length > 0;
        }
    }

    @wire(getProfile, { profileId: '$profileId' })
    wiredProfile({ data }) {
        if (data !== undefined) {
            this.hasProfile = Boolean(data);
            this.profileName = data ? data.fullName : undefined;
        }
    }

    get items() {
        const list = this.hasMoreItems ? [...ITEMS, MORE_ITEM] : ITEMS;
        return list.map((item) => ({
            ...item,
            cls: item.id === this.activeId ? 'nav-btn active' : 'nav-btn'
        }));
    }

    get nameChipClass() {
        return this.showName ? 'name-chip show' : 'name-chip';
    }

    connectedCallback() {
        try {
            const hash = window.location.hash.replace('#', '').toLowerCase();
            if (TAB_IDS.has(hash)) {
                this.activeId = hash;
                this.lastTabId = hash;
            }
        } catch {
            // deep links are a nice-to-have
        }
        this.boundScroll = () => this.queueScrollUpdate();
        window.addEventListener('scroll', this.boundScroll, { passive: true });
        this.boundProfileChange = (event) => {
            this.profileId = event.detail.profileId;
        };
        window.addEventListener('portfolioprofilechange', this.boundProfileChange);
        this.boundTabInView = (event) => {
            const tabId = event.detail && event.detail.tabId;
            if (TAB_IDS.has(tabId) && window.scrollY >= 140) {
                this.activeId = tabId;
                this.lastTabId = tabId;
            }
        };
        window.addEventListener(TAB_IN_VIEW_EVENT, this.boundTabInView);
        this.queueScrollUpdate();
    }

    renderedCallback() {
        this.positionIndicator();
    }

    disconnectedCallback() {
        if (this.boundScroll) {
            window.removeEventListener('scroll', this.boundScroll);
            this.boundScroll = undefined;
        }
        if (this.boundProfileChange) {
            window.removeEventListener('portfolioprofilechange', this.boundProfileChange);
            this.boundProfileChange = undefined;
        }
        if (this.boundTabInView) {
            window.removeEventListener(TAB_IN_VIEW_EVENT, this.boundTabInView);
            this.boundTabInView = undefined;
        }
    }

    // FLIP-style sliding pill: the indicator is one absolutely positioned
    // element animated with transform/width only (compositor-cheap).
    positionIndicator() {
        const dock = this.template.querySelector('.dock');
        const active = this.template.querySelector('.nav-btn.active');
        const indicator = this.template.querySelector('.indicator');
        if (!dock || !active || !indicator) {
            return;
        }
        indicator.style.width = `${active.offsetWidth}px`;
        indicator.style.transform = `translateX(${active.offsetLeft}px)`;
        if (!this.indicatorReady) {
            this.indicatorReady = true;
            // first paint lands instantly; animate from the second change on
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            requestAnimationFrame(() => indicator.classList.add('animate'));
        }
        if (dock.scrollWidth > dock.clientWidth) {
            dock.scrollTo({
                left: Math.max(0, active.offsetLeft - 24),
                behavior: 'smooth'
            });
        }
    }

    handleClick(event) {
        const id = event.currentTarget.dataset.id;
        this.activeId = id;
        if (id === 'about') {
            this.scrollTo(HERO_SELECTOR);
            return;
        }
        this.lastTabId = id;
        // portfolio360 scrolls the right panel into view itself
        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: id } }));
    }

    handleNameClick() {
        this.activeId = 'about';
        this.scrollTo(HERO_SELECTOR);
    }

    scrollTo(selector) {
        // sibling components on the LWR page — reachable only via document
        // eslint-disable-next-line @lwc/lwc/no-document-query
        const target = document.querySelector(selector);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    queueScrollUpdate() {
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

    onScrollFrame() {
        // eslint-disable-next-line @lwc/lwc/no-document-query
        const hero = document.querySelector(HERO_SELECTOR);
        if (!hero) {
            return;
        }
        const rect = hero.getBoundingClientRect();
        this.showName = rect.top < -NAME_REVEAL_OFFSET_PX;
        // "About" only when genuinely back at the top — short panels can't
        // scroll the hero fully away, and hero-visibility checks stole the
        // active state right back after a tab click.
        if (window.scrollY < 140) {
            this.activeId = 'about';
        } else if (this.activeId === 'about') {
            this.activeId = this.lastTabId;
        }
    }
}
