import { createElement } from 'lwc';
import PortfolioItems from 'c/portfolioItems';
import getItemSections from '@salesforce/apex/PortfolioController.getItemSections';

jest.mock(
    '@salesforce/apex/PortfolioController.getProfiles',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PortfolioController.getItemSections',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const SECTIONS = [
    {
        section: 'Publications',
        items: [
            {
                title: 'Paper A',
                subtitle: 'Some Journal',
                description: '<p>Abstract</p>',
                dateLabel: '2026',
                linkUrl: 'https://example.com/paper',
                linkLabel: 'Read',
                tags: ['Apex', 'LWC']
            }
        ]
    },
    {
        section: 'Speaking',
        items: [{ title: 'Talk A', subtitle: null, description: null, dateLabel: null, linkUrl: null, linkLabel: 'View', tags: [] }]
    }
];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('c-portfolio-items', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    function create() {
        const element = createElement('c-portfolio-items', { is: PortfolioItems });
        document.body.appendChild(element);
        return element;
    }

    it('renders one section per Section value with its items', async () => {
        const element = create();
        getItemSections.emit(SECTIONS);
        await flush();

        const titles = element.shadowRoot.querySelectorAll('.section-title');
        expect(Array.from(titles).map((title) => title.textContent)).toEqual([
            'Publications', 'Speaking'
        ]);
        expect(element.shadowRoot.querySelector('.date-pill').textContent).toBe('2026');
        expect(element.shadowRoot.querySelector('.subtitle').textContent).toBe('Some Journal');
        expect(element.shadowRoot.querySelectorAll('.chip')).toHaveLength(2);
        const link = element.shadowRoot.querySelector('.item-link');
        expect(link.href).toBe('https://example.com/paper');
        expect(link.textContent).toContain('Read');
    });

    it('renders nothing when there are no items', async () => {
        const element = create();
        getItemSections.emit([]);
        await flush();

        expect(element.shadowRoot.querySelector('.section')).toBeNull();
    });
});
