import i18next from 'i18next';
import { FuseNavigationType } from '@fuse/core/FuseNavigation/types/FuseNavigationType';
import ar from './navigation-i18n/ar';
import en from './navigation-i18n/en';
import tr from './navigation-i18n/tr';
// import { authRoles } from '../auth';

i18next.addResourceBundle('en', 'navigation', en);
i18next.addResourceBundle('tr', 'navigation', tr);
i18next.addResourceBundle('ar', 'navigation', ar);

/**
 * The navigationConfig object is an array of navigation items for the Fuse application.
 */
const navigationConfig: FuseNavigationType = [
	{
		id: 'dashboards',
		title: 'Dashboards',
		type: 'group',
		icon: 'heroicons-outline:home',
		translate: 'DASHBOARDS',
		children: [
			{
				id: 'dashboards.landingpage',
				title: 'Landing Page',
				type: 'item',
				icon: 'heroicons-outline:home',
				url: '/dashboards/landingpage'
			},
			{
				id: 'dashboards.tasks',
				title: 'Tasks',
				type: 'item',
				icon: 'heroicons-outline:check-circle',
				url: '/dashboards/tasks',
				translate: 'TASKS'
			},
			{
				id: 'dashboards.projects',
				title: 'projects',
				type: 'item',
				icon: 'heroicons-outline:clipboard-check',
				url: '/dashboards/projects',
				translate: 'Projects'
			},
			
		]
	},
	{
		id: 'apps',
		title: 'Applications',
		type: 'group',
		icon: 'heroicons-outline:cube',
		translate: 'APPLICATIONS',
		children: [
			{
				id: 'apps.calendar',
				title: 'Calendar',
				type: 'item',
				icon: 'heroicons-outline:calendar',
				url: '/apps/calendar',
				translate: 'CALENDAR'
			},
			{
				id: 'apps.chat',
				title: 'Chat',
				type: 'item',
				icon: 'heroicons-outline:chat-alt',
				url: '/apps/chat',
				translate: 'CHAT'
			},
			{
				id: 'apps.users',
				title: 'Users',
				type: 'item',
				icon: 'heroicons-outline:user-group',
				url: '/apps/users',
				translate: 'Users'
			},
			{
				id: 'apps.notes',
				title: 'Notes',
				type: 'item',
				icon: 'heroicons-outline:pencil-alt',
				url: '/apps/notes',
				translate: 'NOTES'
			},
			{
				id: 'apps.scrumboard',
				title: 'Scrumboard',
				type: 'item',
				icon: 'heroicons-outline:view-boards',
				url: '/apps/scrumboard',
				translate: 'SCRUMBOARD'
			},
		]
	},
	
];

export default navigationConfig;
