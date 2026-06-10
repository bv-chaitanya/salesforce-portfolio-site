import { LightningElement, api, wire } from 'lwc';
import getCertifications from '@salesforce/apex/PortfolioController.getCertifications';

export default class PortfolioCertifications extends LightningElement {
    @api hideTitle = false;
    certifications = [];
    state = 'loading';
    profileId;

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
