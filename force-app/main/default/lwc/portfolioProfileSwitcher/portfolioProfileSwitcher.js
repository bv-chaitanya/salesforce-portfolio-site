import { LightningElement, wire } from 'lwc';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

// Every profile-aware component re-queries when this fires.
const PROFILE_EVENT = 'portfolioprofilechange';

export default class PortfolioProfileSwitcher extends LightningElement {
    profiles = [];
    activeId;

    @wire(getProfiles)
    wiredProfiles({ data }) {
        if (data) {
            this.profiles = data;
            if (!this.activeId && data.length) {
                // mirror the server default (first active profile), no event needed
                this.activeId = data[0].id;
            }
        }
    }

    // the rail only exists when there is actually something to switch between
    get showRail() {
        return this.profiles.length > 1;
    }

    get items() {
        return this.profiles.map((profile) => ({
            ...profile,
            initials: this.toInitials(profile.fullName),
            title: profile.headline ? `${profile.fullName} — ${profile.headline}` : profile.fullName,
            cls: profile.id === this.activeId ? 'pbtn active' : 'pbtn',
            pressed: profile.id === this.activeId ? 'true' : 'false'
        }));
    }

    handleClick(event) {
        const id = event.currentTarget.dataset.id;
        if (id === this.activeId) {
            return;
        }
        this.activeId = id;
        window.dispatchEvent(new CustomEvent(PROFILE_EVENT, { detail: { profileId: id } }));
    }

    toInitials(name) {
        return (name || '')
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }
}
