import { LightningElement, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { updateRecord, deleteRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getRecords from '@salesforce/apex/PortfolioAdminController.getRecords';

const ROW_ACTIONS = [
    { label: 'Open', name: 'open' },
    { label: 'Delete', name: 'delete' }
];

const ORDER_COL = { label: 'Order', fieldName: 'Display_Order__c', type: 'number', editable: true, initialWidth: 90 };
const ACTIVE_COL = { label: 'Active', fieldName: 'Is_Active__c', type: 'boolean', editable: true, initialWidth: 90 };
const ACTION_COL = { type: 'action', typeAttributes: { rowActions: ROW_ACTIONS } };

const OBJECTS = [
    {
        api: 'Portfolio_Profile__c', label: 'Profile',
        columns: [
            { label: 'Full Name', fieldName: 'Name', editable: true },
            { label: 'Headline', fieldName: 'Headline__c', editable: true },
            { label: 'Email', fieldName: 'Email__c', type: 'email', editable: true },
            { label: 'Location', fieldName: 'Location__c', editable: true },
            { label: 'Photo URL', fieldName: 'Photo_URL__c', type: 'url', editable: true }
        ]
    },
    {
        api: 'Experience__c', label: 'Experience',
        columns: [
            { label: 'Job Title', fieldName: 'Name', editable: true },
            { label: 'Company', fieldName: 'Company__c', editable: true },
            { label: 'Start', fieldName: 'Start_Date__c', type: 'date-local', editable: true },
            { label: 'End', fieldName: 'End_Date__c', type: 'date-local', editable: true },
            { label: 'Current', fieldName: 'Is_Current__c', type: 'boolean', editable: true, initialWidth: 95 }
        ]
    },
    {
        api: 'Project__c', label: 'Projects',
        columns: [
            { label: 'Project', fieldName: 'Name', editable: true },
            { label: 'Client', fieldName: 'Client__c', editable: true, initialWidth: 110 },
            { label: 'Impact', fieldName: 'Impact__c', editable: true },
            { label: 'Tech Stack', fieldName: 'Tech_Stack__c', editable: true }
        ]
    },
    {
        api: 'Skill_Group__c', label: 'Skills',
        columns: [
            { label: 'Category', fieldName: 'Name', editable: true, initialWidth: 220 },
            { label: 'Skills (semicolon-separated)', fieldName: 'Skills__c', editable: true }
        ]
    },
    {
        api: 'Certification__c', label: 'Certifications',
        columns: [
            { label: 'Certification', fieldName: 'Name', editable: true },
            { label: 'Issuer', fieldName: 'Issuer__c', editable: true },
            { label: 'Status', fieldName: 'Status__c', editable: true, initialWidth: 110 },
            { label: 'Credential URL', fieldName: 'Credential_URL__c', type: 'url', editable: true }
        ]
    },
    {
        api: 'Education__c', label: 'Education',
        columns: [
            { label: 'Degree', fieldName: 'Name', editable: true },
            { label: 'Institution', fieldName: 'Institution__c', editable: true },
            { label: 'Location', fieldName: 'Location__c', editable: true }
        ]
    },
    {
        api: 'Award__c', label: 'Awards',
        columns: [
            { label: 'Award', fieldName: 'Name', editable: true },
            { label: 'Year', fieldName: 'Year__c', editable: true, initialWidth: 90 },
            { label: 'Description', fieldName: 'Description__c', editable: true }
        ]
    }
];

export default class PortfolioAdmin extends NavigationMixin(LightningElement) {
    objectTabs = OBJECTS;
    activeObject = OBJECTS[0].api;
    draftValues = [];
    wireResult;
    rows;
    loadError;

    @wire(getRecords, { objectApiName: '$activeObject' })
    wiredRows(result) {
        this.wireResult = result;
        if (result.data) {
            this.rows = result.data;
            this.loadError = undefined;
        } else if (result.error) {
            this.loadError = this.toMessage(result.error);
            this.rows = undefined;
        }
    }

    get columns() {
        const config = OBJECTS.find((object) => object.api === this.activeObject);
        return [...config.columns, ORDER_COL, ACTIVE_COL, ACTION_COL];
    }

    get isLoading() {
        return !this.rows && !this.loadError;
    }

    get rowCountLabel() {
        return this.rows ? `${this.rows.length} record(s) — inline edit, then Save` : '';
    }

    handleTabActive(event) {
        this.activeObject = event.target.value;
        this.draftValues = [];
    }

    handleNew() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName: this.activeObject, actionName: 'new' }
        });
    }

    handleRowAction(event) {
        const action = event.detail.action.name;
        const row = event.detail.row;
        if (action === 'open') {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: { recordId: row.Id, actionName: 'view' }
            });
        } else if (action === 'delete') {
            deleteRecord(row.Id)
                .then(() => {
                    this.toast('Deleted', `"${row.Name}" removed`, 'success');
                    return refreshApex(this.wireResult);
                })
                .catch((error) => this.toast('Delete failed', this.toMessage(error), 'error'));
        }
    }

    handleSave(event) {
        const drafts = event.detail.draftValues;
        Promise.all(drafts.map((draft) => updateRecord({ fields: draft })))
            .then(() => {
                this.draftValues = [];
                this.toast('Saved', `${drafts.length} record(s) updated`, 'success');
                return refreshApex(this.wireResult);
            })
            .catch((error) => this.toast('Save failed', this.toMessage(error), 'error'));
    }

    handleCancel() {
        this.draftValues = [];
    }

    toast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    toMessage(error) {
        if (error && error.body) {
            if (Array.isArray(error.body)) {
                return error.body.map((item) => item.message).join(', ');
            }
            if (error.body.output && Array.isArray(error.body.output.errors) && error.body.output.errors.length) {
                return error.body.output.errors.map((item) => item.message).join(', ');
            }
            if (error.body.message) {
                return error.body.message;
            }
        }
        return 'Unexpected error';
    }
}
