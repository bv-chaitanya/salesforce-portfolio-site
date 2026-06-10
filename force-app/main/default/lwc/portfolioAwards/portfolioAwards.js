import { LightningElement, wire } from 'lwc';
import getAwards from '@salesforce/apex/PortfolioController.getAwards';

export default class PortfolioAwards extends LightningElement {
    awards = [];
    state = 'loading';

    @wire(getAwards)
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
