/**
 * Internal-only data provider for the Portfolio Content Manager app page.
 * Returns ALL records (active and inactive), scoped to a working profile when
 * profileId is provided (Projects scope through their Job's profile). The edit
 * form discovers its fields from the object describe. Never grant this class
 * to the site guest profile.
 */
public with sharing class PortfolioAdminController {
    @TestVisible
    private static final Set<String> ALLOWED_OBJECTS = new Set<String>{
        'Portfolio_Profile__c', 'Experience__c', 'Project__c', 'Skill_Group__c',
        'Certification__c', 'Education__c', 'Award__c'
    };

    @AuraEnabled(cacheable=true)
    public static List<SObject> getRecords(String objectApiName, Id profileId) {
        if (!ALLOWED_OBJECTS.contains(objectApiName)) {
            throw new AuraHandledException('Unsupported object: ' + objectApiName);
        }
        // allowlisted object + fixed field list — no user input reaches the query
        String soql = 'SELECT Id, Name, Display_Order__c, Is_Active__c FROM ' + objectApiName;
        if (profileId != null && objectApiName == 'Project__c') {
            soql += ' WHERE Job__r.Profile__c = :profileId';
        } else if (profileId != null && objectApiName != 'Portfolio_Profile__c') {
            soql += ' WHERE Profile__c = :profileId';
        }
        soql += ' ORDER BY Display_Order__c ASC NULLS LAST, Name ASC';
        return Database.query(soql);
    }
}
