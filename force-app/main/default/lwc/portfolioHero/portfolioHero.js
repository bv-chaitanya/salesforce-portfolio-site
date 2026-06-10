import { LightningElement, wire } from 'lwc';
import getProfile from '@salesforce/apex/PortfolioController.getProfile';

export default class PortfolioHero extends LightningElement {
    profile;
    state = 'loading';
    photoFailed = false;
    profileId;

    connectedCallback() {
        this.boundProfileChange = (event) => {
            this.profileId = event.detail.profileId;
            this.photoFailed = false;
        };
        window.addEventListener('portfolioprofilechange', this.boundProfileChange);
    }

    disconnectedCallback() {
        window.removeEventListener('portfolioprofilechange', this.boundProfileChange);
    }

    @wire(getProfile, { profileId: '$profileId' })
    wiredProfile({ data, error }) {
        if (error) {
            this.state = 'error';
        } else if (data !== undefined) {
            this.profile = data;
            this.state = data ? 'ready' : 'empty';
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

    get initials() {
        if (!this.profile || !this.profile.fullName) {
            return '';
        }
        return this.profile.fullName
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    get showPhoto() {
        return Boolean(this.profile && this.profile.photoUrl) && !this.photoFailed;
    }

    get mailtoHref() {
        return this.profile && this.profile.email ? `mailto:${this.profile.email}` : null;
    }

    handlePhotoError() {
        this.photoFailed = true;
    }
}
