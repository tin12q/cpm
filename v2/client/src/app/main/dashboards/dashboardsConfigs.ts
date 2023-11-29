import { FuseRouteConfigsType } from "@fuse/utils/FuseUtils";
import LandingPageConfig from "./landingPage/LandingPageConfig";
import TasksConfig from "./tasks/TasksConfig";
import ProjectConfig from "./projects/ProjectConfig";

/**
 * Dashboards
 */
const dashboardsConfigs: FuseRouteConfigsType = [
  LandingPageConfig,
  TasksConfig,
  ProjectConfig,
];

export default dashboardsConfigs;
