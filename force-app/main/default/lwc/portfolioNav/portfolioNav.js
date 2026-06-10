import { LightningElement, wire } from 'lwc';
import getProfile from '@salesforce/apex/PortfolioController.getProfile';

const SECTIONS = [
    { id: 'about', label: 'About', selector: 'c-portfolio-hero' },
    { id: 'experience', label: 'Experience', selector: 'c-portfolio-experience' },
    { id: 'skills', label: 'Skills', selector: 'c-portfolio-skills' },
    { id: 'certifications', label: 'Certifications', selector: 'c-portfolio-certifications' },
    { id: 'education', label: 'Education', selector: 'c-portfolio-education' },
    { id: 'awards', label: 'Awards', selector: 'c-portfolio-awards' }
];
const LAST_SECTION_ID = SECTIONS[SECTIONS.length - 1].id;
const SPY_RETRY_MS = 300;
const SPY_MAX_RETRIES = 10;
// the big hero name sits ~240px into the hero — reveal the chip as it exits
const NAME_REVEAL_OFFSET_PX = 240;
const BOTTOM_EPSILON_PX = 8;

export default class PortfolioNav extends LightningElement {
    activeId = 'about';
    profileName;
    showName = false;
    observer;
    spyStarted = false;
    scrollTicking = false;

    @wire(getProfile)
    wiredProfile({ data }) {
        if (data) {
            this.profileName = data.fullName;
        }
    }

    get items() {
        return SECTIONS.map((section) => ({
            ...section,
            cls: section.id === this.activeId ? 'nav-btn active' : 'nav-btn'
        }));
    }

    get nameChipClass() {
        return this.showName ? 'name-chip show' : 'name-chip';
    }

    renderedCallback() {
        if (!this.spyStarted) {
            this.spyStarted = true;
            this.trySetupObserver(0);
            this.boundScroll = () => this.queueScrollUpdate();
            window.addEventListener('scroll', this.boundScroll, { passive: true });
            this.queueScrollUpdate();
        }
    }

    disconnectedCallback() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = undefined;
        }
        if (this.boundScroll) {
            window.removeEventListener('scroll', this.boundScroll);
            this.boundScroll = undefined;
        }
    }

    handleClick(event) {
        const { selector, id } = event.currentTarget.dataset;
        this.activeId = id;
        const target = document.querySelector(selector);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    handleNameClick() {
        this.activeId = 'about';
        const hero = document.querySelector(SECTIONS[0].selector);
        if (hero) {
            hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const hero = document.querySelector(SECTIONS[0].selector);
        if (hero) {
            this.showName = hero.getBoundingClientRect().top < -NAME_REVEAL_OFFSET_PX;
        }
        // The observer's trigger band can never reach the last section when the
        // page bottoms out first — force it active at the end of the scroll.
        const doc = document.documentElement;
        if (window.innerHeight + window.scrollY >= doc.scrollHeight - BOTTOM_EPSILON_PX) {
            this.activeId = LAST_SECTION_ID;
        }
    }

    // Scroll spy is progressive enhancement: section hosts render with the page
    // shell, but retry briefly in case any mount late. Failures just mean no
    // active-pill highlight.
    trySetupObserver(attempt) {
        const found = SECTIONS
            .map((section) => ({ id: section.id, el: document.querySelector(section.selector) }))
            .filter((target) => target.el);
        if (found.length < SECTIONS.length && attempt < SPY_MAX_RETRIES) {
            setTimeout(() => this.trySetupObserver(attempt + 1), SPY_RETRY_MS);
            return;
        }
        if (!found.length || this.observer) {
            return;
        }
        try {
            const idByEl = new WeakMap(found.map((target) => [target.el, target.id]));
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            const id = idByEl.get(entry.target);
                            if (id) {
                                this.activeId = id;
                            }
                        }
                    });
                },
                { rootMargin: '-35% 0px -55% 0px' }
            );
            found.forEach((target) => this.observer.observe(target.el));
        } catch (ignore) {
            this.observer = undefined;
        }
    }
}
