import { createElement } from 'lwc';
import Portfolio360 from 'c/portfolio360';

jest.mock(
    '@salesforce/apex/PortfolioController.getProfiles',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);


const NAVIGATE_EVENT = 'portfolio360navigate';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function panelClasses(element) {
    return Array.from(element.shadowRoot.querySelectorAll('[role="tabpanel"]')).map(
        (panel) => panel.className
    );
}

describe('c-portfolio360', () => {
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

    it('shows the experience panel by default and hides the rest', () => {
        const element = create();

        const classes = panelClasses(element);
        expect(classes[0]).toBe('panel');
        expect(classes.slice(1)).toEqual(['panel hidden', 'panel hidden', 'panel hidden', 'panel hidden']);
    });

    it('opens the tab from the URL hash deep link', () => {
        window.location.hash = '#certifications';

        const element = create();

        const classes = panelClasses(element);
        expect(classes[2]).toBe('panel');
        expect(classes[0]).toBe('panel hidden');
    });

    it('switches panels when the dock dispatches a navigate event', async () => {
        const element = create();
        const replaceState = jest.spyOn(window.history, 'replaceState');

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'skills' } }));
        await flush();

        const classes = panelClasses(element);
        expect(classes[1]).toBe('panel');
        expect(classes[0]).toBe('panel hidden');
        expect(replaceState).toHaveBeenCalledWith(null, '', '#skills');
    });

    it('ignores unknown tab ids', async () => {
        const element = create();

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'bogus' } }));
        await flush();

        expect(panelClasses(element)[0]).toBe('panel');
    });

    it('stops listening after disconnect', async () => {
        const element = create();
        document.body.removeChild(element);

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'skills' } }));
        await flush();

        // re-attach and confirm state never moved off the default
        document.body.appendChild(element);
        expect(panelClasses(element)[0]).toBe('panel');
    });
});
