@IsTest
private class PortfolioControllerTest {
    @TestSetup
    static void makeData() {
        insert new List<Portfolio_Profile__c>{
            new Portfolio_Profile__c(
                Name = 'Test Person',
                Headline__c = 'Salesforce Developer',
                Summary__c = '<p>Summary text</p>',
                Email__c = 'test@example.com',
                Phone__c = '+10000000000',
                Location__c = 'Hyderabad, India',
                LinkedIn_URL__c = 'https://www.linkedin.com/in/example/',
                Photo_URL__c = 'https://example.com/photo.png',
                Display_Order__c = 1,
                Is_Active__c = true
            ),
            new Portfolio_Profile__c(Name = 'Inactive Person', Is_Active__c = false, Display_Order__c = 0)
        };

        List<Experience__c> jobs = new List<Experience__c>{
            new Experience__c(
                Name = 'Software Developer III',
                Company__c = 'Acme Corp',
                Start_Date__c = Date.newInstance(2025, 2, 1),
                Is_Current__c = true,
                Display_Order__c = 1,
                Is_Active__c = true
            ),
            new Experience__c(
                Name = 'Consultant',
                Company__c = 'Beta LLC',
                Start_Date__c = Date.newInstance(2023, 12, 1),
                End_Date__c = Date.newInstance(2025, 2, 1),
                Display_Order__c = 2,
                Is_Active__c = true
            ),
            new Experience__c(Name = 'Hidden Job', Company__c = 'Gamma', Is_Active__c = false, Display_Order__c = 0)
        };
        insert jobs;

        insert new List<Project__c>{
            new Project__c(
                Name = 'Project B',
                Job__c = jobs[0].Id,
                Client__c = 'Client X',
                Description__c = '<ul><li>Did things</li></ul>',
                Tech_Stack__c = 'Apex; LWC',
                Impact__c = 'Saved money',
                Display_Order__c = 2,
                Is_Active__c = true
            ),
            new Project__c(Name = 'Project A', Job__c = jobs[0].Id, Display_Order__c = 1, Is_Active__c = true),
            new Project__c(Name = 'Hidden Project', Job__c = jobs[0].Id, Display_Order__c = 0, Is_Active__c = false)
        };

        insert new List<Skill_Group__c>{
            new Skill_Group__c(Name = 'Languages', Skills__c = 'Apex; Python;; JavaScript ', Display_Order__c = 2, Is_Active__c = true),
            new Skill_Group__c(Name = 'Tooling', Skills__c = 'Git', Display_Order__c = 1, Is_Active__c = true),
            new Skill_Group__c(Name = 'Hidden Skills', Skills__c = 'X', Display_Order__c = 0, Is_Active__c = false)
        };

        insert new List<Certification__c>{
            new Certification__c(Name = 'Platform Developer I', Issuer__c = 'Salesforce', Status__c = 'Active', Display_Order__c = 1, Is_Active__c = true),
            new Certification__c(Name = 'Administrator', Issuer__c = 'Salesforce', Status__c = 'Active', Display_Order__c = 2, Is_Active__c = true),
            new Certification__c(Name = 'Hidden Cert', Is_Active__c = false, Display_Order__c = 0)
        };

        insert new List<Education__c>{
            new Education__c(Name = 'B.Tech CSE', Institution__c = 'Test College', Location__c = 'Kadapa, India', Display_Order__c = 1, Is_Active__c = true),
            new Education__c(Name = 'Hidden Degree', Is_Active__c = false, Display_Order__c = 0)
        };

        insert new List<Award__c>{
            new Award__c(Name = 'Impact Award', Year__c = '2023', Description__c = 'Nominated', Display_Order__c = 1, Is_Active__c = true),
            new Award__c(Name = 'Hidden Award', Is_Active__c = false, Display_Order__c = 0)
        };
    }

    @IsTest
    static void getProfileReturnsActiveRecordOnly() {
        PortfolioController.ProfileDTO dto = PortfolioController.getProfile();

        Assert.isNotNull(dto, 'Expected an active profile');
        Assert.areEqual('Test Person', dto.fullName, 'Inactive profile must never win, regardless of order');
        Assert.areEqual('Salesforce Developer', dto.headline, 'Headline should map');
        Assert.areEqual('test@example.com', dto.email, 'Email should map');
        Assert.areEqual('https://example.com/photo.png', dto.photoUrl, 'Photo URL should map');
        Assert.areEqual('https://www.linkedin.com/in/example/', dto.linkedInUrl, 'LinkedIn URL should map');
    }

    @IsTest
    static void getProfileReturnsNullWhenNoActiveRecords() {
        delete [SELECT Id FROM Portfolio_Profile__c WHERE Is_Active__c = true];

        Assert.isNull(PortfolioController.getProfile(), 'No active profile should return null, not throw');
    }

    @IsTest
    static void getExperiencesFiltersOrdersAndNestsProjects() {
        List<PortfolioController.ExperienceDTO> jobs = PortfolioController.getExperiences();

        Assert.areEqual(2, jobs.size(), 'Inactive experience must be excluded');
        Assert.areEqual('Software Developer III', jobs[0].jobTitle, 'Ordered by Display_Order__c');
        Assert.areEqual('Consultant', jobs[1].jobTitle, 'Second by Display_Order__c');
        Assert.isTrue(jobs[0].isCurrent, 'Current flag should map');
        Assert.isNull(jobs[0].endDate, 'Current role has no end date');

        Assert.areEqual(2, jobs[0].projects.size(), 'Inactive project must be excluded');
        Assert.areEqual('Project A', jobs[0].projects[0].name, 'Projects ordered by Display_Order__c');
        Assert.areEqual('Project B', jobs[0].projects[1].name, 'Projects ordered by Display_Order__c');
        Assert.areEqual('Client X', jobs[0].projects[1].client, 'Client should map');
        Assert.areEqual(0, jobs[1].projects.size(), 'Job without projects returns empty list, not null');
    }

    @IsTest
    static void getSkillGroupsSplitsAndCleansDelimitedList() {
        List<PortfolioController.SkillGroupDTO> groups = PortfolioController.getSkillGroups();

        Assert.areEqual(2, groups.size(), 'Inactive group must be excluded');
        Assert.areEqual('Tooling', groups[0].category, 'Ordered by Display_Order__c');
        Assert.areEqual(new List<String>{ 'Apex', 'Python', 'JavaScript' }, groups[1].skills,
            'Skills should be split on semicolons, trimmed, with empties dropped');
    }

    @IsTest
    static void getSkillGroupsHandlesBlankSkills() {
        Skill_Group__c blank = new Skill_Group__c(Name = 'Empty', Skills__c = null, Display_Order__c = 9, Is_Active__c = true);
        insert blank;

        List<PortfolioController.SkillGroupDTO> groups = PortfolioController.getSkillGroups();

        PortfolioController.SkillGroupDTO last = groups[groups.size() - 1];
        Assert.areEqual('Empty', last.category, 'Blank-skill group still returned');
        Assert.areEqual(0, last.skills.size(), 'Blank skills should return empty list, not null');
    }

    @IsTest
    static void getCertificationsFiltersAndOrders() {
        List<PortfolioController.CertificationDTO> certs = PortfolioController.getCertifications();

        Assert.areEqual(2, certs.size(), 'Inactive cert must be excluded');
        Assert.areEqual('Platform Developer I', certs[0].name, 'Ordered by Display_Order__c');
        Assert.areEqual('Salesforce', certs[0].issuer, 'Issuer should map');
        Assert.areEqual('Active', certs[0].status, 'Status should map');
    }

    @IsTest
    static void getEducationFiltersInactive() {
        List<PortfolioController.EducationDTO> education = PortfolioController.getEducation();

        Assert.areEqual(1, education.size(), 'Inactive education must be excluded');
        Assert.areEqual('B.Tech CSE', education[0].degree, 'Degree should map from Name');
        Assert.areEqual('Test College', education[0].institution, 'Institution should map');
    }

    @IsTest
    static void getAwardsFiltersInactive() {
        List<PortfolioController.AwardDTO> awards = PortfolioController.getAwards();

        Assert.areEqual(1, awards.size(), 'Inactive award must be excluded');
        Assert.areEqual('Impact Award', awards[0].title, 'Title should map from Name');
        Assert.areEqual('2023', awards[0].year, 'Year should map');
    }

    @IsTest
    static void allListMethodsReturnEmptyNotNullWhenNoData() {
        delete [SELECT Id FROM Project__c];
        delete [SELECT Id FROM Experience__c];
        delete [SELECT Id FROM Skill_Group__c];
        delete [SELECT Id FROM Certification__c];
        delete [SELECT Id FROM Education__c];
        delete [SELECT Id FROM Award__c];

        Assert.areEqual(0, PortfolioController.getExperiences().size(), 'Empty list expected');
        Assert.areEqual(0, PortfolioController.getSkillGroups().size(), 'Empty list expected');
        Assert.areEqual(0, PortfolioController.getCertifications().size(), 'Empty list expected');
        Assert.areEqual(0, PortfolioController.getEducation().size(), 'Empty list expected');
        Assert.areEqual(0, PortfolioController.getAwards().size(), 'Empty list expected');
    }
}
