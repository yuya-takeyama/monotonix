import { Jobs } from '@monotonix/schema';

export const propagateDependencyChanges = (
  jobs: Jobs,
  changedJobs: Jobs,
): Jobs => {
  // Create a map of app name to all jobs for that app
  const appNameToAllJobs = new Map<string, typeof jobs>();

  for (const job of jobs) {
    const appName = job.app.name;
    if (!appNameToAllJobs.has(appName)) {
      appNameToAllJobs.set(appName, []);
    }
    appNameToAllJobs.get(appName)!.push(job);
  }

  // Get set of initially changed app names
  const changedAppNames = new Set<string>();
  for (const job of changedJobs) {
    changedAppNames.add(job.app.name);
  }

  // Find all apps that should be considered changed (including transitive dependencies)
  const allChangedAppNames = new Set(changedAppNames);
  let changed = true;

  while (changed) {
    changed = false;
    for (const job of jobs) {
      const dependsOn = job.app.depends_on || [];

      // Check if any of this job's dependencies are in the changed apps
      const hasDependencyChanges = dependsOn.some(depAppName =>
        allChangedAppNames.has(depAppName),
      );

      if (hasDependencyChanges && !allChangedAppNames.has(job.app.name)) {
        allChangedAppNames.add(job.app.name);
        changed = true;
      }
    }
  }

  // Collect all jobs for all changed apps
  const allChangedJobs: Jobs = [];
  for (const appName of allChangedAppNames) {
    const appJobs = appNameToAllJobs.get(appName) || [];
    allChangedJobs.push(...appJobs);
  }

  return allChangedJobs;
};
