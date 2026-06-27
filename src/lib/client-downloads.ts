import clientConfig from "../../shared/client-config.json";

export const DESKTOP_AGENT_DOWNLOAD_URL = clientConfig.desktopAgentReleaseUrl;
export const FIELD_TEAM_APK_DOWNLOAD_URL = clientConfig.fieldTeamApkReleaseUrl;
export const OBSERVER_ADMIN_APK_DOWNLOAD_URL =
  (clientConfig as { observerAdminApkReleaseUrl?: string }).observerAdminApkReleaseUrl ??
  clientConfig.fieldTeamApkReleaseUrl.replace("FieldTeam", "ObserverAdmin");
