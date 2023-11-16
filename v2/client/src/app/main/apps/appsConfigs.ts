import { FuseRouteConfigsType } from '@fuse/utils/FuseUtils';
import CalendarAppConfig from './calendar/CalendarAppConfig';
import ChatAppConfig from './chat/ChatAppConfig';
import ContactsAppConfig from './contacts/ContactsAppConfig';
import FileManagerAppConfig from './file-manager/FileManagerAppConfig';
import MailboxAppConfig from './mailbox/MailboxAppConfig';
import NotesAppConfig from './notes/NotesAppConfig';
import ProfileAppConfig from './profile/profileAppConfig';
import ScrumboardAppConfig from './scrumboard/ScrumboardAppConfig';
import TasksAppConfig from './tasks/TasksAppConfig';

/**
 * The list of application configurations.
 */
const appsConfigs: FuseRouteConfigsType = [
	CalendarAppConfig,
	ChatAppConfig,
	ContactsAppConfig,
	FileManagerAppConfig,
	MailboxAppConfig,
	NotesAppConfig,
	ProfileAppConfig,
	ScrumboardAppConfig,
	TasksAppConfig
];

export default appsConfigs;
