import { LightningElement, wire } from 'lwc';
import getItemSections from '@salesforce/apex/PortfolioController.getItemSections';
import getProfiles from '@salesforce/apex/PortfolioController.getProfiles';

export default class PortfolioItems extends LightningElement {
    sections = [];
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

    @wire(getItemSections, { profileId: '$profileId' })
    wiredSections({ data, error }) {
        if (error) {
            this.state = 'error';
        } else if (data) {
            this.sections = data.map((section, sectionIndex) => ({
                key: `section-${sectionIndex}`,
                title: section.section,
                items: (section.items || []).map((item, itemIndex) => ({
                    ...item,
                    key: `section-${sectionIndex}-item-${itemIndex}`,
                    tags: (item.tags || []).map((tag, tagIndex) => ({
                        key: `section-${sectionIndex}-item-${itemIndex}-tag-${tagIndex}`,
                        label: tag
                    }))
                }))
            }));
            this.state = this.sections.length ? 'ready' : 'empty';
        }
    }

    // dynamic sections render nothing when empty — the dock hides "More" too
    get isReady() {
        return this.state === 'ready';
    }
}
