import { LightningElement, api, wire } from 'lwc';
import getCertifications from '@salesforce/apex/PortfolioController.getCertifications';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

export default class PortfolioCertifications extends LightningElement {
    @api hideTitle = false;
    certifications = [];
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

    @wire(getCertifications, { profileId: '$profileId' })
    wiredCertifications({ data, error }) {
        if (error) {
            this.state = 'error';
        } else if (data) {
            this.certifications = data.map((cert, index) => ({
                key: `cert-${index}`,
                ...cert
            }));
            this.state = this.certifications.length ? 'ready' : 'empty';
        }
    }

    get showTitle() {
        return !this.hideTitle;
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
