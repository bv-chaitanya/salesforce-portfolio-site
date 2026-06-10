import { LightningElement, wire } from 'lwc';
import getProfile from '@salesforce/apex/PortfolioController.getProfile';

// Consumed by c-portfolio360, which swaps its panels in response.
const NAVIGATE_EVENT = 'portfolio360navigate';
const ITEMS = [
    { id: 'about', label: 'About' },
    { id: 'experience', label: 'Experience' },
    { id: 'skills', label: 'Skills' },
    { id: 'certifications', label: 'Certifications' },
    { id: 'education', label: 'Education & Awards' }
];
const TAB_IDS = new Set(['experience', 'skills', 'certifications', 'education']);
const HERO_SELECTOR = 'c-portfolio-hero';
const PANEL_SELECTOR = 'c-portfolio360';
// the big hero name sits ~240px into the hero — reveal the chip as it exits
const NAME_REVEAL_OFFSET_PX = 240;

export default class PortfolioNav extends LightningElement {
    activeId = 'about';
    lastTabId = 'experience';
    profileName;
    showName = false;
    initialized = false;
    scrollTicking = false;

    @wire(getProfile)
    wiredProfile({ data }) {
        if (data) {
            this.profileName = data.fullName;
        }
    }

    get items() {
        return ITEMS.map((item) => ({
            ...item,
            cls: item.id === this.activeId ? 'nav-btn active' : 'nav-btn'
        }));
    }

    get nameChipClass() {
        return this.showName ? 'name-chip show' : 'name-chip';
    }

    renderedCallback() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        try {
            const hash = window.location.hash.replace('#', '').toLowerCase();
            if (TAB_IDS.has(hash)) {
                this.activeId = hash;
                this.lastTabId = hash;
            }
        } catch (e) {
            // deep links are a nice-to-have
        }
        this.boundScroll = () => this.queueScrollUpdate();
        window.addEventListener('scroll', this.boundScroll, { passive: true });
        this.queueScrollUpdate();
    }

    disconnectedCallback() {
        if (this.boundScroll) {
            window.removeEventListener('scroll', this.boundScroll);
            this.boundScroll = undefined;
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
        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: id } }));
        this.scrollTo(PANEL_SELECTOR);
    }

    handleNameClick() {
        this.activeId = 'about';
        this.scrollTo(HERO_SELECTOR);
    }

    scrollTo(selector) {
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
        requestAnimationFrame(() => {
            this.scrollTicking = false;
            this.onScrollFrame();
        });
    }

    onScrollFrame() {
        const hero = document.querySelector(HERO_SELECTOR);
        if (!hero) {
            return;
        }
        const rect = hero.getBoundingClientRect();
        this.showName = rect.top < -NAME_REVEAL_OFFSET_PX;
        // hero dominating the viewport = "About"; otherwise the open tab
        if (rect.bottom > window.innerHeight * 0.45) {
            this.activeId = 'about';
        } else if (this.activeId === 'about') {
            this.activeId = this.lastTabId;
        }
    }
}
