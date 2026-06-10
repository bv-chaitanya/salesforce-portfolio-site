import { LightningElement, api, wire } from 'lwc';
import getSkillGroups from '@salesforce/apex/PortfolioController.getSkillGroups';

export default class PortfolioSkills extends LightningElement {
    @api hideTitle = false;
    groups = [];
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

    @wire(getSkillGroups, { profileId: '$profileId' })
    wiredGroups({ data, error }) {
        if (error) {
            this.state = 'error';
        } else if (data) {
            this.groups = data.map((group, groupIndex) => ({
                key: `group-${groupIndex}`,
                category: group.category,
                skills: (group.skills || []).map((skill, skillIndex) => ({
                    key: `group-${groupIndex}-skill-${skillIndex}`,
                    label: skill
                }))
            }));
            this.state = this.groups.length ? 'ready' : 'empty';
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
