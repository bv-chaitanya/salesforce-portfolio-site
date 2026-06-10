import { createElement } from 'lwc';
import PortfolioNav from 'c/portfolioNav';
import getProfile from '@salesforce/apex/PortfolioController.getProfile';

jest.mock(
    '@salesforce/apex/PortfolioController.getProfile',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const NAVIGATE_EVENT = 'portfolio360navigate';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

function setScrollY(value) {
    Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true });
}

function addHeroStub(rect) {
    const hero = document.createElement('c-portfolio-hero');
    hero.getBoundingClientRect = () => rect;
    document.body.appendChild(hero);
    return hero;
}

describe('c-portfolio-nav', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        window.location.hash = '';
        setScrollY(0);
    });

    async function create() {
        const element = createElement('c-portfolio-nav', { is: PortfolioNav });
        document.body.appendChild(element);
        getProfile.emit({ fullName: 'Test Person' });
        await flush();
        return element;
    }

    function activeLabel(element) {
        return element.shadowRoot.querySelector('.nav-btn.active').textContent;
    }

    it('renders the five dock items with About active by default', async () => {
        const element = await create();

        const buttons = element.shadowRoot.querySelectorAll('.nav-btn');
        expect(Array.from(buttons).map((button) => button.textContent)).toEqual([
            'About', 'Experience', 'Skills', 'Certifications', 'Education & Awards'
        ]);
        expect(activeLabel(element)).toBe('About');
    });

    it('activates the deep-linked tab from the URL hash', async () => {
        window.location.hash = '#skills';

        const element = await create();

        expect(activeLabel(element)).toBe('Skills');
    });

    it('dispatches the navigate event and activates the clicked tab', async () => {
        const element = await create();
        const handler = jest.fn();
        window.addEventListener(NAVIGATE_EVENT, handler);

        element.shadowRoot.querySelector('[data-id="certifications"]').click();
        await flush();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({ tabId: 'certifications' });
        expect(activeLabel(element)).toBe('Certifications');
        window.removeEventListener(NAVIGATE_EVENT, handler);
    });

    it('does not dispatch navigate for About', async () => {
        const element = await create();
        const handler = jest.fn();
        window.addEventListener(NAVIGATE_EVENT, handler);

        element.shadowRoot.querySelector('[data-id="about"]').click();
        await flush();

        expect(handler).not.toHaveBeenCalled();
        window.removeEventListener(NAVIGATE_EVENT, handler);
    });

    it('shows the name chip and restores the open tab once scrolled away from the hero', async () => {
        addHeroStub({ top: -400, bottom: -100 });
        window.location.hash = '#experience';
        const element = await create();

        setScrollY(500);
        window.dispatchEvent(new CustomEvent('scroll'));
        await nextFrame();
        await flush();

        expect(element.shadowRoot.querySelector('.name-chip').className).toContain('show');
        expect(activeLabel(element)).toBe('Experience');
    });

    it('returns to About at the top of the page and hides the chip', async () => {
        addHeroStub({ top: 0, bottom: 700 });
        const element = await create();

        setScrollY(0);
        window.dispatchEvent(new CustomEvent('scroll'));
        await nextFrame();
        await flush();

        expect(activeLabel(element)).toBe('About');
        expect(element.shadowRoot.querySelector('.name-chip').className).not.toContain('show');
    });
});

describe('c-portfolio-nav without an active profile', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders nothing when the profile wire returns null', async () => {
        const element = createElement('c-portfolio-nav', { is: PortfolioNav });
        document.body.appendChild(element);
        getProfile.emit(null);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(element.shadowRoot.querySelector('.stack')).toBeNull();
    });
});
