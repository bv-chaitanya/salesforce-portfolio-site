import { LightningElement, api, wire } from 'lwc';
import getExperiences from '@salesforce/apex/PortfolioController.getExperiences';

const MONTH_YEAR = { month: 'short', year: 'numeric' };

function formatMonthYear(isoDate) {
    if (!isoDate) {
        return '';
    }
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', MONTH_YEAR);
}

function formatRange(startDate, endDate, isCurrent) {
    const start = formatMonthYear(startDate);
    const end = isCurrent || !endDate ? 'Present' : formatMonthYear(endDate);
    if (!start) {
        return end === 'Present' ? '' : end;
    }
    return `${start} – ${end}`;
}

function splitList(raw) {
    return raw
        ? raw.split(';').map((part) => part.trim()).filter(Boolean)
        : [];
}

export default class PortfolioExperience extends LightningElement {
    @api hideTitle = false;
    jobs = [];
    state = 'loading';
    profileId = null;

    connectedCallback() {
        this.boundProfileChange = (event) => {
            this.profileId = event.detail.profileId;
        };
        window.addEventListener('portfolioprofilechange', this.boundProfileChange);
    }

    disconnectedCallback() {
        window.removeEventListener('portfolioprofilechange', this.boundProfileChange);
    }

    @wire(getExperiences, { profileId: '$profileId' })
    wiredExperiences({ data, error }) {
        if (error) {
            this.state = 'error';
        } else if (data) {
            this.jobs = data.map((job, jobIndex) => ({
                key: `job-${jobIndex}`,
                title: job.jobTitle,
                company: job.company,
                location: job.location,
                dateRange: formatRange(job.startDate, job.endDate, job.isCurrent),
                isCurrent: Boolean(job.isCurrent),
                projects: (job.projects || []).map((project, projectIndex) => ({
                    key: `job-${jobIndex}-project-${projectIndex}`,
                    name: project.name,
                    client: project.client,
                    description: project.description,
                    impact: project.impact,
                    projectUrl: project.projectUrl,
                    techList: splitList(project.techStack).map((tech, techIndex) => ({
                        key: `job-${jobIndex}-project-${projectIndex}-tech-${techIndex}`,
                        label: tech
                    }))
                }))
            }));
            this.state = this.jobs.length ? 'ready' : 'empty';
        }
    }

    get showTitle() {
        return !this.hideTitle;
    }

    get isReady() {
        return this.state === 'ready';
    }

    get isError() {
        return this.state === 'error';
    }

    get isEmpty() {
        return this.state === 'empty';
    }
}
