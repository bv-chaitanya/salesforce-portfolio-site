@IsTest
private class PortfolioAdminControllerTest {
    @TestSetup
    static void makeData() {
        List<Portfolio_Profile__c> profiles = new List<Portfolio_Profile__c>{
            new Portfolio_Profile__c(Name = 'Main', Display_Order__c = 1, Is_Active__c = true),
            new Portfolio_Profile__c(Name = 'Alt', Display_Order__c = 2, Is_Active__c = true)
        };
        insert profiles;

        insert new List<Award__c>{
            new Award__c(Name = 'Second', Profile__c = profiles[0].Id, Display_Order__c = 2, Is_Active__c = true),
            new Award__c(Name = 'First', Profile__c = profiles[0].Id, Display_Order__c = 1, Is_Active__c = false),
            new Award__c(Name = 'Alt Award', Profile__c = profiles[1].Id, Display_Order__c = 1, Is_Active__c = true)
        };

        Experience__c mainJob = new Experience__c(Name = 'Main Job', Profile__c = profiles[0].Id,
            Display_Order__c = 1, Is_Active__c = true);
        Experience__c altJob = new Experience__c(Name = 'Alt Job', Profile__c = profiles[1].Id,
            Display_Order__c = 1, Is_Active__c = true);
        insert new List<Experience__c>{ mainJob, altJob };

        insert new List<Project__c>{
            new Project__c(Name = 'Main Project', Job__c = mainJob.Id, Display_Order__c = 1, Is_Active__c = true),
            new Project__c(Name = 'Alt Project', Job__c = altJob.Id, Display_Order__c = 1, Is_Active__c = true)
        };
    }

    static Id idOf(String name) {
        return [SELECT Id FROM Portfolio_Profile__c WHERE Name = :name LIMIT 1].Id;
    }

    @IsTest
    static void returnsAllRecordsIncludingInactiveInOrderForProfile() {
        List<SObject> rows = PortfolioAdminController.getRecords('Award__c', idOf('Main'));

        Assert.areEqual(2, rows.size(), 'Scoped to the working profile, inactive included');
        Assert.areEqual('First', rows[0].get('Name'), 'Ordered by Display_Order__c');
        Assert.areEqual(false, rows[0].get('Is_Active__c'), 'Inactive record returned');
    }

    @IsTest
    static void nullProfileReturnsEverything() {
        Assert.areEqual(3, PortfolioAdminController.getRecords('Award__c', null).size(),
            'No profile filter -> all records');
        Assert.areEqual(2, PortfolioAdminController.getRecords('Portfolio_Profile__c', idOf('Main')).size(),
            'Profile object itself is never profile-filtered');
    }

    @IsTest
    static void projectsScopeThroughTheirJob() {
        List<SObject> rows = PortfolioAdminController.getRecords('Project__c', idOf('Alt'));

        Assert.areEqual(1, rows.size(), 'Projects filter via Job__r.Profile__c');
        Assert.areEqual('Alt Project', rows[0].get('Name'), 'Only the alt profile project');
    }

    @IsTest
    static void rejectsObjectsOutsideAllowlist() {
        try {
            PortfolioAdminController.getRecords('Account', null);
            Assert.fail('Expected AuraHandledException for non-portfolio object');
        } catch (AuraHandledException e) {
            Assert.isTrue(true, 'Allowlist rejected unsupported object');
        }
    }

    @IsTest
    static void supportsEveryPortfolioObject() {
        for (String objectName : PortfolioAdminController.ALLOWED_OBJECTS) {
            List<SObject> rows = PortfolioAdminController.getRecords(objectName, idOf('Main'));
            Assert.isNotNull(rows, 'Query must succeed for ' + objectName);
        }
    }
}
