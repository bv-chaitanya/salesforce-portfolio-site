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

describe('c-portfolio360', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = jest.fn();
    });

    beforeEach(() => {
        Element.prototype.scrollIntoView.mockClear();
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

    it('renders all five panels stacked in tab order', () => {
        const element = create();

        const panels = element.shadowRoot.querySelectorAll('.panel');
        expect(Array.from(panels).map((panel) => panel.dataset.tab)).toEqual([
            'experience', 'skills', 'certifications', 'education', 'more'
        ]);
    });

    it('scrolls the matching panel when the dock dispatches navigate', async () => {
        create();

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'skills' } }));
        await flush();

        expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('ignores unknown tab ids', async () => {
        create();

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'bogus' } }));
        await flush();

        expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('lands on the deep-linked panel from the URL hash', async () => {
        window.location.hash = '#certifications';

        create();
        await flush();

        expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: 'auto' })
        );
    });

    it('stops listening after disconnect', async () => {
        const element = create();
        document.body.removeChild(element);

        window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { tabId: 'skills' } }));
        await flush();

        expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });
});
