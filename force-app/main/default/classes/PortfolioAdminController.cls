/**
 * Internal-only data provider for the Portfolio Content Manager app page.
 * Returns ALL records (active and inactive) for the record picker; the edit
 * form discovers its fields from the object describe, so new custom fields
 * need no changes here. Never grant this class to the site guest profile.
 */
public with sharing class PortfolioAdminController {
    @TestVisible
    private static final Set<String> ALLOWED_OBJECTS = new Set<String>{
        'Portfolio_Profile__c', 'Experience__c', 'Project__c', 'Skill_Group__c',
        'Certification__c', 'Education__c', 'Award__c'
    };

    @AuraEnabled(cacheable=true)
    public static List<SObject> getRecords(String objectApiName) {
        if (!ALLOWED_OBJECTS.contains(objectApiName)) {
            throw new AuraHandledException('Unsupported object: ' + objectApiName);
        }
        // allowlisted object + fixed field list — no user input reaches the query
        String soql = 'SELECT Id, Name, Display_Order__c, Is_Active__c'
            + ' FROM ' + objectApiName
            + ' ORDER BY Display_Order__c ASC NULLS LAST, Name ASC';
        return Database.query(soql);
    }
}
