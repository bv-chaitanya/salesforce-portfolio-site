import { createElement } from 'lwc';
import PortfolioHero from 'c/portfolioHero';
import getProfile from '@salesforce/apex/PortfolioController.getProfile';

jest.mock(
    '@salesforce/apex/PortfolioController.getProfile',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const PROFILE = {
    fullName: 'Test Person',
    headline: 'Salesforce Developer',
    summary: '<p>Summary</p>',
    email: 'test@example.com',
    location: 'Hyderabad, India',
    linkedInUrl: 'https://www.linkedin.com/in/example/',
    photoUrl: 'https://example.com/photo.png'
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('c-portfolio-hero', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    function create() {
        const element = createElement('c-portfolio-hero', { is: PortfolioHero });
        document.body.appendChild(element);
        return element;
    }

    it('renders name, headline, photo, and links from the wire', async () => {
        const element = create();
        getProfile.emit(PROFILE);
        await flush();

        expect(element.shadowRoot.querySelector('.name').textContent).toBe('Test Person');
        expect(element.shadowRoot.querySelector('.headline').textContent).toBe('Salesforce Developer');
        expect(element.shadowRoot.querySelector('.avatar-img').src).toBe(PROFILE.photoUrl);
        expect(element.shadowRoot.querySelector('.btn-solid').href).toBe('mailto:test@example.com');
        const linkedIn = element.shadowRoot.querySelector('.btn-outline');
        expect(linkedIn.href).toBe(PROFILE.linkedInUrl);
        expect(linkedIn.rel).toBe('noopener noreferrer');
    });

    it('falls back to initials when the photo fails to load', async () => {
        const element = create();
        getProfile.emit(PROFILE);
        await flush();

        element.shadowRoot.querySelector('.avatar-img').dispatchEvent(new CustomEvent('error'));
        await flush();

        expect(element.shadowRoot.querySelector('.avatar-img')).toBeNull();
        expect(element.shadowRoot.querySelector('.avatar-initials').textContent).toBe('TP');
    });

    it('uses initials when no photo URL is set', async () => {
        const element = create();
        getProfile.emit({ ...PROFILE, photoUrl: null });
        await flush();

        expect(element.shadowRoot.querySelector('.avatar-initials').textContent).toBe('TP');
    });

    it('shows the empty state when no profile exists', async () => {
        const element = create();
        getProfile.emit(null);
        await flush();

        expect(element.shadowRoot.querySelector('.state').textContent).toBe('No profile published yet.');
    });

    it('shows the error state when the wire fails', async () => {
        const element = create();
        getProfile.error();
        await flush();

        expect(element.shadowRoot.querySelector('.state').textContent).toBe('Profile is unavailable right now.');
    });
});
