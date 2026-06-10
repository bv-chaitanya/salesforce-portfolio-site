import { LightningElement, wire } from 'lwc';
import getEducation from '@salesforce/apex/PortfolioController.getEducation';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

export default class PortfolioEducation extends LightningElement {
    entries = [];
    state = 'loading';
    profileId = null;

    profilesKnownEmpty = false;

    @wire(getProfiles)
    wiredProfilesGuard({ data }) {
        if (data) {
            this.profilesKnownEmpty = data.length === 0;
        }
    }

    get siteHasProfiles() {
        return !this.profilesKnownEmpty;
    }

    connectedCallback() {
        this.boundProfileChange = (event) => {
            this.profileId = event.detail.profileId;
        };
        window.addEventListener('portfolioprofilechange', this.boundProfileChange);
    }

    disconnectedCallback() {
        window.removeEventListener('portfolioprofilechange', this.boundProfileChange);
    }

    @wire(getEducation, { profileId: '$profileId' })
    wiredEducation({ data, error }) {
        if (error) {
            this.state = 'error';
        } else if (data) {
            this.entries = data.map((entry, index) => ({
                key: `edu-${index}`,
                ...entry
            }));
            this.state = this.entries.length ? 'ready' : 'empty';
        }
    }

    get isReady() {
        return this.state === 'ready';
    }

    get isError() {
        return this.state === 'error';
    }

    get isEmpty() {
        return this.state === 'empty';
    }
}
