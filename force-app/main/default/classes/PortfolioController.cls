/**
 * Read-only data provider for the public portfolio LWR site.
 * All methods are cacheable and profile-scoped: a null profileId resolves to the
 * first active profile, and an explicit profileId is only honored if that profile
 * is active. No active profiles = every method returns null/empty (master switch).
 * Records render only when Is_Active__c = true, ordered by Display_Order__c.
 * Guest record access is granted via criteria-based guest sharing rules.
 *
 * Note: Phone__c is intentionally never queried/exposed — the site is public.
 */
public with sharing class PortfolioController {
    @AuraEnabled(cacheable=true)
    public static List<ProfileSummaryDTO> getProfiles() {
        List<ProfileSummaryDTO> result = new List<ProfileSummaryDTO>();
        for (Portfolio_Profile__c p : [
            SELECT Id, Name, Headline__c, Photo_URL__c
            FROM Portfolio_Profile__c
            WHERE Is_Active__c = true
            ORDER BY Display_Order__c ASC NULLS LAST, CreatedDate ASC
        ]) {
            ProfileSummaryDTO dto = new ProfileSummaryDTO();
            dto.id = p.Id;
            dto.fullName = p.Name;
            dto.headline = p.Headline__c;
            dto.photoUrl = p.Photo_URL__c;
            result.add(dto);
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static ProfileDTO getProfile(Id profileId) {
        Id resolved = resolveProfileId(profileId);
        if (resolved == null) {
            return null;
        }
        Portfolio_Profile__c p = [
            SELECT Id, Name, Headline__c, Summary__c, Email__c, Location__c,
                LinkedIn_URL__c, Photo_URL__c
            FROM Portfolio_Profile__c
            WHERE Id = :resolved
            LIMIT 1
        ];
        ProfileDTO dto = new ProfileDTO();
        dto.id = p.Id;
        dto.fullName = p.Name;
        dto.headline = p.Headline__c;
        dto.summary = p.Summary__c;
        dto.email = p.Email__c;
        dto.location = p.Location__c;
        dto.linkedInUrl = p.LinkedIn_URL__c;
        dto.photoUrl = p.Photo_URL__c;
        return dto;
    }

    @AuraEnabled(cacheable=true)
    public static List<ExperienceDTO> getExperiences(Id profileId) {
        List<ExperienceDTO> result = new List<ExperienceDTO>();
        Id resolved = resolveProfileId(profileId);
        if (resolved == null) {
            return result;
        }
        for (Experience__c job : [
            SELECT Name, Company__c, Location__c, Start_Date__c, End_Date__c, Is_Current__c,
                (SELECT Name, Client__c, Description__c, Tech_Stack__c, Impact__c, Project_URL__c
                 FROM Projects__r
                 WHERE Is_Active__c = true
                 ORDER BY Display_Order__c ASC NULLS LAST, Name ASC)
            FROM Experience__c
            WHERE Is_Active__c = true AND Profile__c = :resolved
            ORDER BY Display_Order__c ASC NULLS LAST, Start_Date__c DESC
        ]) {
            ExperienceDTO dto = new ExperienceDTO();
            dto.jobTitle = job.Name;
            dto.company = job.Company__c;
            dto.location = job.Location__c;
            dto.startDate = job.Start_Date__c;
            dto.endDate = job.End_Date__c;
            dto.isCurrent = job.Is_Current__c;
            dto.projects = new List<ProjectDTO>();
            for (Project__c proj : job.Projects__r) {
                dto.projects.add(toProjectDTO(proj));
            }
            result.add(dto);
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<SkillGroupDTO> getSkillGroups(Id profileId) {
        List<SkillGroupDTO> result = new List<SkillGroupDTO>();
        Id resolved = resolveProfileId(profileId);
        if (resolved == null) {
            return result;
        }
        for (Skill_Group__c grp : [
            SELECT Name, Skills__c
            FROM Skill_Group__c
            WHERE Is_Active__c = true AND Profile__c = :resolved
            ORDER BY Display_Order__c ASC NULLS LAST, Name ASC
        ]) {
            SkillGroupDTO dto = new SkillGroupDTO();
            dto.category = grp.Name;
            dto.skills = splitSkills(grp.Skills__c);
            result.add(dto);
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<CertificationDTO> getCertifications(Id profileId) {
        List<CertificationDTO> result = new List<CertificationDTO>();
        Id resolved = resolveProfileId(profileId);
        if (resolved == null) {
            return result;
        }
        for (Certification__c cert : [
            SELECT Name, Issuer__c, Status__c, Credential_URL__c
            FROM Certification__c
            WHERE Is_Active__c = true AND Profile__c = :resolved
            ORDER BY Display_Order__c ASC NULLS LAST, Name ASC
        ]) {
            CertificationDTO dto = new CertificationDTO();
            dto.name = cert.Name;
            dto.issuer = cert.Issuer__c;
            dto.status = cert.Status__c;
            dto.credentialUrl = cert.Credential_URL__c;
            result.add(dto);
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<EducationDTO> getEducation(Id profileId) {
        List<EducationDTO> result = new List<EducationDTO>();
        Id resolved = resolveProfileId(profileId);
        if (resolved == null) {
            return result;
        }
        for (Education__c edu : [
            SELECT Name, Institution__c, Location__c
            FROM Education__c
            WHERE Is_Active__c = true AND Profile__c = :resolved
            ORDER BY Display_Order__c ASC NULLS LAST, Name ASC
        ]) {
            EducationDTO dto = new EducationDTO();
            dto.degree = edu.Name;
            dto.institution = edu.Institution__c;
            dto.location = edu.Location__c;
            result.add(dto);
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<AwardDTO> getAwards(Id profileId) {
        List<AwardDTO> result = new List<AwardDTO>();
        Id resolved = resolveProfileId(profileId);
        if (resolved == null) {
            return result;
        }
        for (Award__c award : [
            SELECT Name, Year__c, Description__c
            FROM Award__c
            WHERE Is_Active__c = true AND Profile__c = :resolved
            ORDER BY Display_Order__c ASC NULLS LAST, Name ASC
        ]) {
            AwardDTO dto = new AwardDTO();
            dto.title = award.Name;
            dto.year = award.Year__c;
            dto.description = award.Description__c;
            result.add(dto);
        }
        return result;
    }

    // Null = first active profile. An explicit id is honored only when that
    // profile is active, so inactive profiles are unreachable even by id.
    private static Id resolveProfileId(Id profileId) {
        List<Portfolio_Profile__c> rows;
        if (profileId != null) {
            rows = [
                SELECT Id FROM Portfolio_Profile__c
                WHERE Id = :profileId AND Is_Active__c = true
                LIMIT 1
            ];
        } else {
            rows = [
                SELECT Id FROM Portfolio_Profile__c
                WHERE Is_Active__c = true
                ORDER BY Display_Order__c ASC NULLS LAST, CreatedDate ASC
                LIMIT 1
            ];
        }
        return rows.isEmpty() ? null : rows[0].Id;
    }

    private static ProjectDTO toProjectDTO(Project__c proj) {
        ProjectDTO dto = new ProjectDTO();
        dto.name = proj.Name;
        dto.client = proj.Client__c;
        dto.description = proj.Description__c;
        dto.techStack = proj.Tech_Stack__c;
        dto.impact = proj.Impact__c;
        dto.projectUrl = proj.Project_URL__c;
        return dto;
    }

    private static List<String> splitSkills(String raw) {
        List<String> skills = new List<String>();
        if (String.isBlank(raw)) {
            return skills;
        }
        for (String part : raw.split(';')) {
            String trimmed = part.trim();
            if (String.isNotBlank(trimmed)) {
                skills.add(trimmed);
            }
        }
        return skills;
    }

    public class ProfileSummaryDTO {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String fullName { get; set; }
        @AuraEnabled public String headline { get; set; }
        @AuraEnabled public String photoUrl { get; set; }
    }

    public class ProfileDTO {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String fullName { get; set; }
        @AuraEnabled public String headline { get; set; }
        @AuraEnabled public String summary { get; set; }
        @AuraEnabled public String email { get; set; }
        @AuraEnabled public String location { get; set; }
        @AuraEnabled public String linkedInUrl { get; set; }
        @AuraEnabled public String photoUrl { get; set; }
    }

    public class ExperienceDTO {
        @AuraEnabled public String jobTitle { get; set; }
        @AuraEnabled public String company { get; set; }
        @AuraEnabled public String location { get; set; }
        @AuraEnabled public Date startDate { get; set; }
        @AuraEnabled public Date endDate { get; set; }
        @AuraEnabled public Boolean isCurrent { get; set; }
        @AuraEnabled public List<ProjectDTO> projects { get; set; }
    }

    public class ProjectDTO {
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String client { get; set; }
        @AuraEnabled public String description { get; set; }
        @AuraEnabled public String techStack { get; set; }
        @AuraEnabled public String impact { get; set; }
        @AuraEnabled public String projectUrl { get; set; }
    }

    public class SkillGroupDTO {
        @AuraEnabled public String category { get; set; }
        @AuraEnabled public List<String> skills { get; set; }
    }

    public class CertificationDTO {
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String issuer { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String credentialUrl { get; set; }
    }

    public class EducationDTO {
        @AuraEnabled public String degree { get; set; }
        @AuraEnabled public String institution { get; set; }
        @AuraEnabled public String location { get; set; }
    }

    public class AwardDTO {
        @AuraEnabled public String title { get; set; }
        @AuraEnabled public String year { get; set; }
        @AuraEnabled public String description { get; set; }
    }
}
