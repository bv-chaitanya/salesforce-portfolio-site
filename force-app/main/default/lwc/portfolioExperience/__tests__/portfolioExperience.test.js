import { createElement } from 'lwc';
import PortfolioExperience from 'c/portfolioExperience';
import getExperiences from '@salesforce/apex/PortfolioController.getExperiences';

jest.mock(
    '@salesforce/apex/PortfolioController.getProfiles',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/PortfolioController.getExperiences',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const JOBS = [
    {
        jobTitle: 'Software Developer III',
        company: 'Acme Corp',
        location: 'Hyderabad, India',
        startDate: '2025-02-01',
        endDate: null,
        isCurrent: true,
        projects: [
            {
                name: 'Project A',
                client: 'Client X',
                description: '<ul><li>Did things</li></ul>',
                techStack: 'Apex; LWC ; ;Platform Events',
                impact: 'Saved money',
                projectUrl: 'https://example.com/a'
            }
        ]
    },
    {
        jobTitle: 'Consultant',
        company: 'Beta LLC',
        location: null,
        startDate: '2023-12-01',
        endDate: '2025-02-01',
        isCurrent: false,
        projects: []
    }
];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('c-portfolio-experience', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    function create(props = {}) {
        const element = createElement('c-portfolio-experience', { is: PortfolioExperience });
        Object.assign(element, props);
        document.body.appendChild(element);
        return element;
    }

    it('renders jobs with formatted date ranges', async () => {
        const element = create();
        getExperiences.emit(JOBS);
        await flush();

        const titles = element.shadowRoot.querySelectorAll('.job-title');
        expect(titles).toHaveLength(2);
        expect(titles[0].textContent).toBe('Software Developer III');
        const dates = element.shadowRoot.querySelectorAll('.job-dates');
        expect(dates[0].textContent).toBe('Feb 2025 – Present');
        expect(dates[1].textContent).toBe('Dec 2023 – Feb 2025');
    });

    it('splits tech stacks into trimmed chips and renders project details', async () => {
        const element = create();
        getExperiences.emit(JOBS);
        await flush();

        const chips = element.shadowRoot.querySelectorAll('.chip');
        expect(Array.from(chips).map((chip) => chip.textContent)).toEqual([
            'Apex', 'LWC', 'Platform Events'
        ]);
        expect(element.shadowRoot.querySelector('.project-client').textContent).toBe('Client X');
        expect(element.shadowRoot.querySelector('.project-impact').textContent).toBe('Saved money');
        expect(element.shadowRoot.querySelector('.project-link').href).toBe('https://example.com/a');
    });

    it('hides the section title when hideTitle is set', async () => {
        const element = create({ hideTitle: true });
        getExperiences.emit(JOBS);
        await flush();

        expect(element.shadowRoot.querySelector('.section-title')).toBeNull();
    });

    it('shows the empty state without data', async () => {
        const element = create();
        getExperiences.emit([]);
        await flush();

        expect(element.shadowRoot.querySelector('.state').textContent).toBe('No experience published yet.');
    });

    it('shows the error state when the wire fails', async () => {
        const element = create();
        getExperiences.error();
        await flush();

        expect(element.shadowRoot.querySelector('.state').textContent).toBe('Experience is unavailable right now.');
    });
});
