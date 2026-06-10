import { createElement } from 'lwc';
import PortfolioSkills from 'c/portfolioSkills';
import getSkillGroups from '@salesforce/apex/PortfolioController.getSkillGroups';

jest.mock(
    '@salesforce/apex/PortfolioController.getProfiles',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PortfolioController.getSkillGroups',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const GROUPS = [
    { category: 'Salesforce Development', skills: ['Apex', 'LWC'] },
    { category: 'Tooling', skills: [] }
];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('c-portfolio-skills', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    function create(props = {}) {
        const element = createElement('c-portfolio-skills', { is: PortfolioSkills });
        Object.assign(element, props);
        document.body.appendChild(element);
        return element;
    }

    it('renders one card per category with its chips', async () => {
        const element = create();
        getSkillGroups.emit(GROUPS);
        await flush();

        const titles = element.shadowRoot.querySelectorAll('.group-title');
        expect(Array.from(titles).map((title) => title.textContent)).toEqual([
            'Salesforce Development', 'Tooling'
        ]);
        expect(element.shadowRoot.querySelectorAll('.chip')).toHaveLength(2);
    });

    it('hides the section title when hideTitle is set', async () => {
        const element = create({ hideTitle: true });
        getSkillGroups.emit(GROUPS);
        await flush();

        expect(element.shadowRoot.querySelector('.section-title')).toBeNull();
    });

    it('shows the empty state without data', async () => {
        const element = create();
        getSkillGroups.emit([]);
        await flush();

        expect(element.shadowRoot.querySelector('.state').textContent).toBe('No skills published yet.');
    });
});
