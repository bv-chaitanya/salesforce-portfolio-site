@IsTest
private class PortfolioControllerTest {
    @TestSetup
    static void makeData() {
        List<Portfolio_Profile__c> profiles = new List<Portfolio_Profile__c>{
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
            new Portfolio_Profile__c(Name = 'Second Persona', Display_Order__c = 2, Is_Active__c = true),
            new Portfolio_Profile__c(Name = 'Inactive Person', Is_Active__c = false, Display_Order__c = 0)
        };
        insert profiles;
        Id mainId = profiles[0].Id;
        Id altId = profiles[1].Id;

        List<Experience__c> jobs = new List<Experience__c>{
            new Experience__c(
                Name = 'Software Developer III',
                Company__c = 'Acme Corp',
                Profile__c = mainId,
                Start_Date__c = Date.newInstance(2025, 2, 1),
                Is_Current__c = true,
                Display_Order__c = 1,
                Is_Active__c = true
            ),
            new Experience__c(
                Name = 'Consultant',
                Company__c = 'Beta LLC',
                Profile__c = mainId,
                Start_Date__c = Date.newInstance(2023, 12, 1),
                End_Date__c = Date.newInstance(2025, 2, 1),
                Display_Order__c = 2,
                Is_Active__c = true
            ),
            new Experience__c(Name = 'Alt Job', Company__c = 'Gamma', Profile__c = altId,
                Display_Order__c = 1, Is_Active__c = true),
            new Experience__c(Name = 'Hidden Job', Company__c = 'Gamma', Profile__c = mainId,
                Is_Active__c = false, Display_Order__c = 0)
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
            new Skill_Group__c(Name = 'Languages', Profile__c = mainId,
                Skills__c = 'Apex; Python;; JavaScript ', Display_Order__c = 2, Is_Active__c = true),
            new Skill_Group__c(Name = 'Tooling', Profile__c = mainId, Skills__c = 'Git',
                Display_Order__c = 1, Is_Active__c = true),
            new Skill_Group__c(Name = 'Hidden Skills', Profile__c = mainId, Skills__c = 'X',
                Display_Order__c = 0, Is_Active__c = false)
        };

        insert new List<Certification__c>{
            new Certification__c(Name = 'Platform Developer I', Issuer__c = 'Salesforce', Status__c = 'Active',
                Profile__c = mainId, Display_Order__c = 1, Is_Active__c = true),
            new Certification__c(Name = 'Administrator', Issuer__c = 'Salesforce', Status__c = 'Active',
                Profile__c = mainId, Display_Order__c = 2, Is_Active__c = true),
            new Certification__c(Name = 'Alt Cert', Issuer__c = 'Other', Profile__c = altId,
                Display_Order__c = 1, Is_Active__c = true),
            new Certification__c(Name = 'Hidden Cert', Profile__c = mainId, Is_Active__c = false, Display_Order__c = 0)
        };

        insert new List<Education__c>{
            new Education__c(Name = 'B.Tech CSE', Institution__c = 'Test College', Location__c = 'Kadapa, India',
                Profile__c = mainId, Display_Order__c = 1, Is_Active__c = true),
            new Education__c(Name = 'Hidden Degree', Profile__c = mainId, Is_Active__c = false, Display_Order__c = 0)
        };

        insert new List<Portfolio_Item__c>{
            new Portfolio_Item__c(Name = 'Talk B', Section__c = 'Speaking', Section_Order__c = 2,
                Profile__c = mainId, Display_Order__c = 2, Is_Active__c = true,
                Tags__c = 'LWC; Apex', Link_URL__c = 'https://example.com/talk'),
            new Portfolio_Item__c(Name = 'Talk A', Section__c = 'Speaking', Section_Order__c = 2,
                Profile__c = mainId, Display_Order__c = 1, Is_Active__c = true, Link_Label__c = 'Watch'),
            new Portfolio_Item__c(Name = 'Paper', Section__c = 'Publications', Section_Order__c = 1,
                Profile__c = mainId, Display_Order__c = 1, Is_Active__c = true),
            new Portfolio_Item__c(Name = 'Alt Item', Section__c = 'Publications', Section_Order__c = 1,
                Profile__c = altId, Display_Order__c = 1, Is_Active__c = true),
            new Portfolio_Item__c(Name = 'Hidden Item', Section__c = 'Speaking', Profile__c = mainId,
                Is_Active__c = false, Display_Order__c = 0)
        };

        insert new List<Award__c>{
            new Award__c(Name = 'Impact Award', Year__c = '2023', Description__c = 'Nominated',
                Profile__c = mainId, Display_Order__c = 1, Is_Active__c = true),
            new Award__c(Name = 'Hidden Award', Profile__c = mainId, Is_Active__c = false, Display_Order__c = 0)
        };
    }

    static Id idOf(String name) {
        return [SELECT Id FROM Portfolio_Profile__c WHERE Name = :name LIMIT 1].Id;
    }

    @IsTest
    static void getProfilesReturnsActiveOrdered() {
        List<PortfolioController.ProfileSummaryDTO> profiles = PortfolioController.getProfiles();

        Assert.areEqual(2, profiles.size(), 'Inactive profile must be excluded');
        Assert.areEqual('Test Person', profiles[0].fullName, 'Ordered by Display_Order__c');
        Assert.areEqual('Second Persona', profiles[1].fullName, 'Second by Display_Order__c');
        Assert.isNotNull(profiles[0].id, 'Switcher needs ids');
    }

    @IsTest
    static void getProfileDefaultsToFirstActiveProfile() {
        PortfolioController.ProfileDTO dto = PortfolioController.getProfile(null);

        Assert.isNotNull(dto, 'Expected an active profile');
        Assert.areEqual('Test Person', dto.fullName, 'Null id resolves to first active profile');
        Assert.areEqual('test@example.com', dto.email, 'Email should map');
        Assert.areEqual('https://example.com/photo.png', dto.photoUrl, 'Photo URL should map');
        Assert.areEqual('https://www.linkedin.com/in/example/', dto.linkedInUrl, 'LinkedIn URL should map');
    }

    @IsTest
    static void getProfileHonorsExplicitActiveProfileOnly() {
        Assert.areEqual('Second Persona', PortfolioController.getProfile(idOf('Second Persona')).fullName,
            'Explicit active profile id is honored');
        Assert.isNull(PortfolioController.getProfile(idOf('Inactive Person')),
            'Inactive profiles are unreachable even by id');
    }

    @IsTest
    static void noActiveProfilesActsAsMasterSwitch() {
        List<Portfolio_Profile__c> all = [SELECT Id FROM Portfolio_Profile__c];
        for (Portfolio_Profile__c p : all) {
            p.Is_Active__c = false;
        }
        update all;

        Assert.isNull(PortfolioController.getProfile(null), 'No active profile -> null profile');
        Assert.areEqual(0, PortfolioController.getProfiles().size(), 'No active profiles listed');
        Assert.areEqual(0, PortfolioController.getExperiences(null).size(), 'Sections gated by profile');
        Assert.areEqual(0, PortfolioController.getSkillGroups(null).size(), 'Sections gated by profile');
        Assert.areEqual(0, PortfolioController.getCertifications(null).size(), 'Sections gated by profile');
        Assert.areEqual(0, PortfolioController.getEducation(null).size(), 'Sections gated by profile');
        Assert.areEqual(0, PortfolioController.getAwards(null).size(), 'Sections gated by profile');
        Assert.areEqual(0, PortfolioController.getItemSections(null).size(), 'Dynamic sections gated too');
    }

    @IsTest
    static void getExperiencesScopesToProfileAndNestsProjects() {
        List<PortfolioController.ExperienceDTO> jobs = PortfolioController.getExperiences(null);

        Assert.areEqual(2, jobs.size(), 'Default profile sees only its own active jobs');
        Assert.areEqual('Software Developer III', jobs[0].jobTitle, 'Ordered by Display_Order__c');
        Assert.isTrue(jobs[0].isCurrent, 'Current flag should map');
        Assert.areEqual(2, jobs[0].projects.size(), 'Inactive project must be excluded');
        Assert.areEqual('Project A', jobs[0].projects[0].name, 'Projects ordered by Display_Order__c');
        Assert.areEqual('Client X', jobs[0].projects[1].client, 'Client should map');
        Assert.areEqual(0, jobs[1].projects.size(), 'Job without projects returns empty list, not null');

        List<PortfolioController.ExperienceDTO> altJobs =
            PortfolioController.getExperiences(idOf('Second Persona'));
        Assert.areEqual(1, altJobs.size(), 'Alt profile sees only its job');
        Assert.areEqual('Alt Job', altJobs[0].jobTitle, 'Profile scoping works');
    }

    @IsTest
    static void getSkillGroupsSplitsAndCleansDelimitedList() {
        List<PortfolioController.SkillGroupDTO> groups = PortfolioController.getSkillGroups(null);

        Assert.areEqual(2, groups.size(), 'Inactive group must be excluded');
        Assert.areEqual('Tooling', groups[0].category, 'Ordered by Display_Order__c');
        Assert.areEqual(new List<String>{ 'Apex', 'Python', 'JavaScript' }, groups[1].skills,
            'Skills split on semicolons, trimmed, empties dropped');
    }

    @IsTest
    static void getSkillGroupsHandlesBlankSkills() {
        insert new Skill_Group__c(Name = 'Empty', Skills__c = null, Profile__c = idOf('Test Person'),
            Display_Order__c = 9, Is_Active__c = true);

        List<PortfolioController.SkillGroupDTO> groups = PortfolioController.getSkillGroups(null);

        PortfolioController.SkillGroupDTO last = groups[groups.size() - 1];
        Assert.areEqual('Empty', last.category, 'Blank-skill group still returned');
        Assert.areEqual(0, last.skills.size(), 'Blank skills should return empty list, not null');
    }

    @IsTest
    static void getCertificationsScopesToProfile() {
        List<PortfolioController.CertificationDTO> certs = PortfolioController.getCertifications(null);

        Assert.areEqual(2, certs.size(), 'Default profile certs only, inactive excluded');
        Assert.areEqual('Platform Developer I', certs[0].name, 'Ordered by Display_Order__c');

        List<PortfolioController.CertificationDTO> altCerts =
            PortfolioController.getCertifications(idOf('Second Persona'));
        Assert.areEqual(1, altCerts.size(), 'Alt profile sees only its cert');
        Assert.areEqual('Alt Cert', altCerts[0].name, 'Profile scoping works');
    }

    @IsTest
    static void getItemSectionsGroupsOrdersAndScopes() {
        List<PortfolioController.ItemSectionDTO> sections = PortfolioController.getItemSections(null);

        Assert.areEqual(2, sections.size(), 'Two dynamic sections for the default profile');
        Assert.areEqual('Publications', sections[0].section, 'Sections ordered by Section_Order__c');
        Assert.areEqual('Speaking', sections[1].section, 'Second section by order');
        Assert.areEqual(2, sections[1].items.size(), 'Inactive item excluded');
        Assert.areEqual('Talk A', sections[1].items[0].title, 'Items ordered by Display_Order__c');
        Assert.areEqual('Watch', sections[1].items[0].linkLabel, 'Custom link label kept');
        Assert.areEqual('View', sections[1].items[1].linkLabel, 'Link label defaults to View');
        Assert.areEqual(new List<String>{ 'LWC', 'Apex' }, sections[1].items[1].tags, 'Tags split');

        List<PortfolioController.ItemSectionDTO> alt =
            PortfolioController.getItemSections(idOf('Second Persona'));
        Assert.areEqual(1, alt.size(), 'Alt profile sees only its sections');
        Assert.areEqual('Alt Item', alt[0].items[0].title, 'Profile scoping works');
    }

    @IsTest
    static void getEducationAndAwardsFilterInactive() {
        List<PortfolioController.EducationDTO> education = PortfolioController.getEducation(null);
        Assert.areEqual(1, education.size(), 'Inactive education must be excluded');
        Assert.areEqual('B.Tech CSE', education[0].degree, 'Degree maps from Name');

        List<PortfolioController.AwardDTO> awards = PortfolioController.getAwards(null);
        Assert.areEqual(1, awards.size(), 'Inactive award must be excluded');
        Assert.areEqual('Impact Award', awards[0].title, 'Title maps from Name');
        Assert.areEqual('2023', awards[0].year, 'Year should map');
    }
}
