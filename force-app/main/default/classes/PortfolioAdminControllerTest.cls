@IsTest
private class PortfolioAdminControllerTest {
    @IsTest
    static void returnsAllRecordsIncludingInactiveInOrder() {
        insert new List<Award__c>{
            new Award__c(Name = 'Second', Display_Order__c = 2, Is_Active__c = true),
            new Award__c(Name = 'First', Display_Order__c = 1, Is_Active__c = false)
        };

        List<SObject> rows = PortfolioAdminController.getRecords('Award__c');

        Assert.areEqual(2, rows.size(), 'Admin view must include inactive records');
        Assert.areEqual('First', rows[0].get('Name'), 'Ordered by Display_Order__c');
        Assert.areEqual(false, rows[0].get('Is_Active__c'), 'Inactive record returned');
    }

    @IsTest
    static void rejectsObjectsOutsideAllowlist() {
        try {
            PortfolioAdminController.getRecords('Account');
            Assert.fail('Expected AuraHandledException for non-portfolio object');
        } catch (AuraHandledException e) {
            Assert.isTrue(true, 'Allowlist rejected unsupported object');
        }
    }

    @IsTest
    static void supportsEveryPortfolioObject() {
        for (String objectName : PortfolioAdminController.FIELDS_BY_OBJECT.keySet()) {
            List<SObject> rows = PortfolioAdminController.getRecords(objectName);
            Assert.isNotNull(rows, 'Query must succeed for ' + objectName);
        }
    }
}
