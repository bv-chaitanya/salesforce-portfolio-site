/**
 * Internal-only data provider for the Portfolio Content Manager app page.
 * Unlike PortfolioController, it returns ALL records (active and inactive) so
 * content can be toggled, fixed, or removed. Never grant this class to the
 * site guest profile.
 */
public with sharing class PortfolioAdminController {
    @TestVisible
    private static final Map<String, List<String>> FIELDS_BY_OBJECT = new Map<String, List<String>>{
        'Portfolio_Profile__c' => new List<String>{ 'Name', 'Headline__c', 'Email__c', 'Location__c', 'Photo_URL__c', 'Display_Order__c', 'Is_Active__c' },
        'Experience__c' => new List<String>{ 'Name', 'Company__c', 'Start_Date__c', 'End_Date__c', 'Is_Current__c', 'Display_Order__c', 'Is_Active__c' },
        'Project__c' => new List<String>{ 'Name', 'Client__c', 'Impact__c', 'Tech_Stack__c', 'Display_Order__c', 'Is_Active__c' },
        'Skill_Group__c' => new List<String>{ 'Name', 'Skills__c', 'Display_Order__c', 'Is_Active__c' },
        'Certification__c' => new List<String>{ 'Name', 'Issuer__c', 'Status__c', 'Credential_URL__c', 'Display_Order__c', 'Is_Active__c' },
        'Education__c' => new List<String>{ 'Name', 'Institution__c', 'Location__c', 'Display_Order__c', 'Is_Active__c' },
        'Award__c' => new List<String>{ 'Name', 'Year__c', 'Description__c', 'Display_Order__c', 'Is_Active__c' }
    };

    @AuraEnabled(cacheable=true)
    public static List<SObject> getRecords(String objectApiName) {
        List<String> fields = FIELDS_BY_OBJECT.get(objectApiName);
        if (fields == null) {
            throw new AuraHandledException('Unsupported object: ' + objectApiName);
        }
        // objectApiName is allowlisted above and the field list is static — no
        // user input reaches the query string.
        String soql = 'SELECT Id, ' + String.join(fields, ', ')
            + ' FROM ' + objectApiName
            + ' ORDER BY Display_Order__c ASC NULLS LAST, Name ASC';
        return Database.query(soql);
    }
}
