import { FuseRouteConfigsType } from '@fuse/utils/FuseUtils';
import ProjectDashboardAppConfig from './project/ProjectDashboardAppConfig';
import ECommerceAppConfig from './e-commerce/ECommerceAppConfig'
import AcademyAppConfig from './academy/AcademyAppConfig';

/**
 * Dashboards
 */
const dashboardsConfigs: FuseRouteConfigsType = [
	ProjectDashboardAppConfig,
	ECommerceAppConfig,
	AcademyAppConfig
];

export default dashboardsConfigs;
