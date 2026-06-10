import { LightningElement, wire } from 'lwc';
import getSkillGroups from '@salesforce/apex/PortfolioController.getSkillGroups';

export default class PortfolioSkills extends LightningElement {
    groups = [];
    state = 'loading';

    @wire(getSkillGroups)
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
