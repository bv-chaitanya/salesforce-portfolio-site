import { createElement } from 'lwc';
import PortfolioProfileSwitcher from 'c/portfolioProfileSwitcher';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

jest.mock(
    '@salesforce/apex/PortfolioController.getProfiles',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return { default: createApexTestWireAdapter(jest.fn()) };
    },
    { virtual: true }
);

const PROFILES = [
    { id: '001A', fullName: 'Test Person', headline: 'Salesforce Developer', photoUrl: 'https://example.com/a.png' },
    { id: '001B', fullName: 'Second Persona', headline: null, photoUrl: null }
];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('c-portfolio-profile-switcher', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    function create() {
        const element = createElement('c-portfolio-profile-switcher', { is: PortfolioProfileSwitcher });
        document.body.appendChild(element);
        return element;
    }

    it('renders nothing with a single profile', async () => {
        const element = create();
        getProfiles.emit([PROFILES[0]]);
        await flush();

        expect(element.shadowRoot.querySelector('.rail')).toBeNull();
    });

    it('renders circular tabs with photo or initials, first active', async () => {
        const element = create();
        getProfiles.emit(PROFILES);
        await flush();

        const buttons = element.shadowRoot.querySelectorAll('.pbtn');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].className).toContain('active');
        expect(buttons[0].querySelector('.pimg').src).toBe(PROFILES[0].photoUrl);
        expect(buttons[1].querySelector('.pinitials').textContent).toBe('SP');
        expect(buttons[0].title).toBe('Test Person — Salesforce Developer');
    });

    it('broadcasts the profile change and moves the active ring', async () => {
        const element = create();
        getProfiles.emit(PROFILES);
        await flush();
        const handler = jest.fn();
        window.addEventListener('portfolioprofilechange', handler);

        element.shadowRoot.querySelectorAll('.pbtn')[1].click();
        await flush();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({ profileId: '001B' });
        expect(element.shadowRoot.querySelectorAll('.pbtn')[1].className).toContain('active');

        // clicking the already-active tab is a no-op
        element.shadowRoot.querySelectorAll('.pbtn')[1].click();
        await flush();
        expect(handler).toHaveBeenCalledTimes(1);
        window.removeEventListener('portfolioprofilechange', handler);
    });
});
