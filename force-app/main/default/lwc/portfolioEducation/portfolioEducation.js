import { LightningElement, wire } from 'lwc';
import getEducation from '@salesforce/apex/PortfolioController.getEducation';

export default class PortfolioEducation extends LightningElement {
    entries = [];
    state = 'loading';

    @wire(getEducation)
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
