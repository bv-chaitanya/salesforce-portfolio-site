import { createElement } from 'lwc';
import Portfolio360 from 'c/portfolio360';
import getItemSections from '@salesforce/apex/PortfolioController.getItemSections';

jest.mock(
    '@salesforce/apex/PortfolioController.getItemSections',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PortfolioController.getProfiles',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const NAVIGATE_EVENT = 'portfolio360navigate';
const TAB_IN_VIEW_EVENT = 'portfolio360tabinview';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function visibleTabs(element) {
    return Array.from(element.shadowRoot.querySelectorAll('[data-tab]'))
        .filter((panel) => !panel.className.includes('hidden'))
        .map((panel) => panel.dataset.tab);
}

describe('c-portfolio360', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        window.location.hash = '';
    });

    function create() {
        const element = createElement('c-portfolio360', { is: Portfolio360 });
        document.body.appendChild(element);
        return element;
    }

    it('shows only the experience page by default', () => {
        const element = create();

        expect(visibleTabs(element)).toEqual(['experience']);
    });

    it('lands on the deep-linked page from the URL hash', () => {
        window.location.hash = '#certifications';

        const element = create();

        expect(visibleTabs(element)).toEqual(['certifications']);
    });

    it('switches pages with a horizontal slide and broadcasts the change', async () => {
        const element = create();
        const handler = jest.fn();
        window.addEventListener(TAB_IN_VIEW_EVENT, handler);

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'skills' } }));
        await flush();

        expect(visibleTabs(element)).toEqual(['skills']);
        expect(element.shadowRoot.querySelector('[data-tab="skills"]').className)
            .toContain('slide-from-right');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({ tabId: 'skills' });
        window.removeEventListener(TAB_IN_VIEW_EVENT, handler);
    });

    it('ignores unknown tab ids', async () => {
        const element = create();

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'bogus' } }));
        await flush();

        expect(visibleTabs(element)).toEqual(['experience']);
    });

    it('renders Next-only pager on the first page and walks forward on click', async () => {
        const element = create();

        expect(element.shadowRoot.querySelector('.pager-btn:not(.pager-next)')).toBeNull();
        const next = element.shadowRoot.querySelector('.pager-next');
        expect(next.textContent).toContain('Skills');

        next.click();
        await flush();

        expect(visibleTabs(element)).toEqual(['skills']);
        expect(element.shadowRoot.querySelector('.pager-btn:not(.pager-next)').textContent)
            .toContain('Experience');
    });

    it('walks backward via the Prev button', async () => {
        window.location.hash = '#certifications';
        const element = create();

        element.shadowRoot.querySelector('.pager-btn:not(.pager-next)').click();
        await flush();

        expect(visibleTabs(element)).toEqual(['skills']);
        expect(element.shadowRoot.querySelector('[data-tab="skills"]').className)
            .toContain('slide-from-left');
    });

    it('hides Next on the last available page and never offers an empty More', async () => {
        window.location.hash = '#education';
        const element = create();

        expect(element.shadowRoot.querySelector('.pager-next')).toBeNull();

        getItemSections.emit([{ section: 'Publications', items: [] }]);
        await flush();

        expect(element.shadowRoot.querySelector('.pager-next').textContent).toContain('More');
    });

    it('flips pages on a horizontal swipe only', async () => {
        const element = create();

        window.dispatchEvent(new TouchEvent('touchstart', {
            touches: [{ clientX: 300, clientY: 100 }]
        }));
        window.dispatchEvent(new TouchEvent('touchend', {
            changedTouches: [{ clientX: 120, clientY: 110 }]
        }));
        await flush();
        expect(visibleTabs(element)).toEqual(['skills']);

        // vertical swipe must NOT flip
        window.dispatchEvent(new TouchEvent('touchstart', {
            touches: [{ clientX: 300, clientY: 500 }]
        }));
        window.dispatchEvent(new TouchEvent('touchend', {
            changedTouches: [{ clientX: 305, clientY: 100 }]
        }));
        await flush();
        expect(visibleTabs(element)).toEqual(['skills']);
    });

    it('never flips on vertical wheel scrolling', async () => {
        const element = create();
        Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
        Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
        Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, configurable: true });

        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, deltaX: 0 }));
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: -300, deltaX: 0 }));
        await flush();

        expect(visibleTabs(element)).toEqual(['experience']);
    });

    it('flips on a clearly horizontal wheel gesture', async () => {
        const element = create();

        window.dispatchEvent(new WheelEvent('wheel', { deltaX: 120, deltaY: 10 }));
        await flush();

        expect(visibleTabs(element)).toEqual(['skills']);
    });

    it('restarts at the first tab after returning to the top', async () => {
        const element = create();
        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'education' } }));
        await flush();
        expect(visibleTabs(element)).toEqual(['education']);

        Object.defineProperty(window, 'scrollY', { value: 600, configurable: true });
        window.dispatchEvent(new CustomEvent('scroll'));
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

        Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
        window.dispatchEvent(new CustomEvent('scroll'));
        await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

        expect(visibleTabs(element)).toEqual(['experience']);
    });

    it('stops listening after disconnect', async () => {
        const element = create();
        document.body.removeChild(element);

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'skills' } }));
        await flush();

        document.body.appendChild(element);
        expect(visibleTabs(element)).toEqual(['experience']);
    });
});
