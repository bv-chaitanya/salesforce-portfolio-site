import { LightningElement } from 'lwc';

const SECTIONS = [
    { id: 'about', label: 'About', selector: 'c-portfolio-hero' },
    { id: 'experience', label: 'Experience', selector: 'c-portfolio-experience' },
    { id: 'skills', label: 'Skills', selector: 'c-portfolio-skills' },
    { id: 'certifications', label: 'Certifications', selector: 'c-portfolio-certifications' },
    { id: 'education', label: 'Education', selector: 'c-portfolio-education' },
    { id: 'awards', label: 'Awards', selector: 'c-portfolio-awards' }
];
const SPY_RETRY_MS = 300;
const SPY_MAX_RETRIES = 10;

export default class PortfolioNav extends LightningElement {
    activeId = 'about';
    observer;
    spyStarted = false;

    get items() {
        return SECTIONS.map((section) => ({
            ...section,
            cls: section.id === this.activeId ? 'nav-btn active' : 'nav-btn'
        }));
    }

    renderedCallback() {
        if (!this.spyStarted) {
            this.spyStarted = true;
            this.trySetupObserver(0);
        }
    }

    disconnectedCallback() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = undefined;
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
