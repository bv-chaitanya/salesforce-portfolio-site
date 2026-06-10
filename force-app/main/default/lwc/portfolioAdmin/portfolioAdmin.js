import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { deleteRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';
import getRecords from '@salesforce/apex/PortfolioAdminController.getRecords';

const OBJECTS = [
    {
        api: 'Portfolio_Profile__c', label: 'Profile',
        fields: ['Name', 'Headline__c', 'Summary__c', 'Email__c', 'Phone__c', 'Location__c',
            'LinkedIn_URL__c', 'Photo_URL__c', 'Display_Order__c', 'Is_Active__c']
    },
    {
        api: 'Experience__c', label: 'Experience',
        fields: ['Name', 'Company__c', 'Location__c', 'Start_Date__c', 'End_Date__c',
            'Is_Current__c', 'Display_Order__c', 'Is_Active__c']
    },
    {
        api: 'Project__c', label: 'Projects',
        fields: ['Name', 'Job__c', 'Client__c', 'Description__c', 'Tech_Stack__c', 'Impact__c',
            'Project_URL__c', 'Display_Order__c', 'Is_Active__c']
    },
    {
        api: 'Skill_Group__c', label: 'Skills',
        fields: ['Name', 'Skills__c', 'Display_Order__c', 'Is_Active__c']
    },
    {
        api: 'Certification__c', label: 'Certifications',
        fields: ['Name', 'Issuer__c', 'Status__c', 'Credential_URL__c', 'Display_Order__c', 'Is_Active__c']
    },
    {
        api: 'Education__c', label: 'Education',
        fields: ['Name', 'Institution__c', 'Location__c', 'Display_Order__c', 'Is_Active__c']
    },
    {
        api: 'Award__c', label: 'Awards',
        fields: ['Name', 'Year__c', 'Description__c', 'Display_Order__c', 'Is_Active__c']
    }
];

export default class PortfolioAdmin extends LightningElement {
    activeObject = OBJECTS[0].api;
    records;
    loadError;
    selectedId;
    isCreating = false;
    wireResult;

    @wire(getRecords, { objectApiName: '$activeObject' })
    wiredRows(result) {
        this.wireResult = result;
        if (result.data) {
            this.records = result.data;
            this.loadError = undefined;
            const stillThere = this.selectedId
                && this.records.some((record) => record.Id === this.selectedId);
            if (!this.isCreating && !stillThere) {
                this.selectedId = this.records.length ? this.records[0].Id : undefined;
            }
        } else if (result.error) {
            this.loadError = this.toMessage(result.error);
            this.records = undefined;
        }
    }

    get objectConfig() {
        return OBJECTS.find((object) => object.api === this.activeObject);
    }

    get formFields() {
        return this.objectConfig.fields;
    }

    get listItems() {
        return (this.records || []).map((record) => ({
            id: record.Id,
            name: record.Name,
            inactive: record.Is_Active__c === false,
            cls: record.Id === this.selectedId
                ? 'rec slds-p-around_x-small slds-grid slds-grid_align-spread selected'
                : 'rec slds-p-around_x-small slds-grid slds-grid_align-spread'
        }));
    }

    get isLoading() {
        return !this.records && !this.loadError;
    }

    get hasRecords() {
        return Boolean(this.records && this.records.length);
    }

    get showEditForm() {
        return !this.isCreating && Boolean(this.selectedId);
    }

    get showEmptyState() {
        return !this.isCreating && !this.selectedId && !this.isLoading && !this.loadError;
    }

    get formHeading() {
        if (this.isCreating) {
            return `New ${this.objectConfig.label} record`;
        }
        const selected = (this.records || []).find((record) => record.Id === this.selectedId);
        return selected ? `Edit: ${selected.Name}` : '';
    }

    handleTabActive(event) {
        this.activeObject = event.target.value;
        this.selectedId = undefined;
        this.isCreating = false;
    }

    handleSelect(event) {
        this.selectedId = event.currentTarget.dataset.id;
        this.isCreating = false;
    }

    handleNew() {
        this.isCreating = true;
        this.selectedId = undefined;
    }

    handleCancelCreate() {
        this.isCreating = false;
        this.selectedId = this.records && this.records.length ? this.records[0].Id : undefined;
    }

    handleSuccess(event) {
        const id = event.detail.id;
        const verb = this.isCreating ? 'created' : 'saved';
        this.isCreating = false;
        this.selectedId = id;
        this.toast('Success', `Record ${verb}. The public site reflects it on next load.`, 'success');
        return refreshApex(this.wireResult);
    }

    handleError(event) {
        const detail = event.detail || {};
        this.toast('Save failed', detail.detail || detail.message || 'See field errors below', 'error');
    }

    async handleDelete() {
        const selected = (this.records || []).find((record) => record.Id === this.selectedId);
        if (!selected) {
            return;
        }
        const confirmed = await LightningConfirm.open({
            message: `Delete "${selected.Name}" permanently? Unchecking Active hides it without deleting.`,
            label: 'Delete record',
            theme: 'warning'
        });
        if (!confirmed) {
            return;
        }
        deleteRecord(selected.Id)
            .then(() => {
                this.selectedId = undefined;
                this.toast('Deleted', `"${selected.Name}" removed`, 'success');
                return refreshApex(this.wireResult);
            })
            .catch((error) => this.toast('Delete failed', this.toMessage(error), 'error'));
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    toMessage(error) {
        if (error && error.body) {
            if (Array.isArray(error.body)) {
                return error.body.map((item) => item.message).join(', ');
            }
            if (error.body.message) {
                return error.body.message;
            }
        }
        return 'Unexpected error';
    }
}
