import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { deleteRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import getRecords from '@salesforce/apex/PortfolioAdminController.getRecords';

const OBJECTS = [
    { api: 'Portfolio_Profile__c', label: 'Profile' },
    { api: 'Experience__c', label: 'Experience' },
    { api: 'Project__c', label: 'Projects' },
    { api: 'Skill_Group__c', label: 'Skills' },
    { api: 'Certification__c', label: 'Certifications' },
    { api: 'Education__c', label: 'Education' },
    { api: 'Award__c', label: 'Awards' }
];

// always rendered last so ordering/visibility controls sit together
const TRAILING_FIELDS = ['Display_Order__c', 'Is_Active__c'];

export default class PortfolioAdmin extends LightningElement {
    activeObject = OBJECTS[0].api;
    records;
    loadError;
    selectedId;
    isCreating = false;
    wireResult;

    @wire(getObjectInfo, { objectApiName: '$activeObject' })
    objectInfo;

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

    // Discovered from the object describe: every editable custom field (plus
    // Name) renders automatically — new fields need no code changes here.
    get formFields() {
        const info = this.objectInfo && this.objectInfo.data;
        if (!info) {
            return [];
        }
        const leading = Object.values(info.fields)
            .filter((field) => field.updateable && (field.custom || field.apiName === 'Name'))
            .filter((field) => !TRAILING_FIELDS.includes(field.apiName))
            .sort((a, b) => (a.apiName === 'Name' ? -1 : b.apiName === 'Name' ? 1 : a.label.localeCompare(b.label)))
            .map((field) => field.apiName);
        return [...leading, ...TRAILING_FIELDS];
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
