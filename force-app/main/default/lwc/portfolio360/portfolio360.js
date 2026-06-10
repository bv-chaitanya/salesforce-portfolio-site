import { LightningElement } from 'lwc';

const TABS = [
    { id: 'experience', label: 'Experience' },
    { id: 'skills', label: 'Skills' },
    { id: 'certifications', label: 'Certifications' },
    { id: 'education', label: 'Education & Awards' }
];

export default class Portfolio360 extends LightningElement {
    activeTab = TABS[0].id;

    connectedCallback() {
        try {
            const hash = window.location.hash.replace('#', '').toLowerCase();
            if (TABS.some((tab) => tab.id === hash)) {
                this.activeTab = hash;
            }
        } catch (e) {
            // hash routing is a nice-to-have; never break rendering over it
        }
    }

    get tabs() {
        return TABS.map((tab) => ({
            ...tab,
            cssClass: tab.id === this.activeTab ? 'tab active' : 'tab',
            selected: tab.id === this.activeTab ? 'true' : 'false'
        }));
    }

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.id;
        try {
            window.history.replaceState(null, '', `#${this.activeTab}`);
        } catch (e) {
            // ignore — see above
        }
    }

    panelClass(id) {
        return this.activeTab === id ? 'panel' : 'panel hidden';
    }

    get experiencePanelClass() {
        return this.panelClass('experience');
    }

    get skillsPanelClass() {
        return this.panelClass('skills');
    }

    get certificationsPanelClass() {
        return this.panelClass('certifications');
    }

    get educationPanelClass() {
        return this.panelClass('education');
    }
}
