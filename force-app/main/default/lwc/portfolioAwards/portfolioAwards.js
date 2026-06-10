import { LightningElement, wire } from 'lwc';
import getAwards from '@salesforce/apex/PortfolioController.getAwards';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

export default class PortfolioAwards extends LightningElement {
    awards = [];
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

    @wire(getAwards, { profileId: '$profileId' })
    wiredAwards({ data, error }) {
        if (error) {
            this.state = 'error';
        } else if (data) {
            this.awards = data.map((award, index) => ({
                key: `award-${index}`,
                ...award
            }));
            this.state = this.awards.length ? 'ready' : 'empty';
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
