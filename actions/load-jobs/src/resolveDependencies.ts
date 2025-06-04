import { Jobs, Job } from '@monotonix/schema';

export const resolveDependencies = (jobs: Jobs): Jobs => {
  const appNameToJobs = new Map<string, Job[]>();
  
  // Group jobs by app name
  for (const job of jobs) {
    const appName = job.app.name;
    if (!appNameToJobs.has(appName)) {
      appNameToJobs.set(appName, []);
    }
    appNameToJobs.get(appName)!.push(job);
  }

  const resolvedJobs: Jobs = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const resolveApp = (appName: string): void => {
    if (visited.has(appName)) return;
    if (visiting.has(appName)) {
      throw new Error(`Circular dependency detected involving app: ${appName}`);
    }

    visiting.add(appName);

    const appJobs = appNameToJobs.get(appName);
    if (!appJobs || appJobs.length === 0) {
      visiting.delete(appName);
      visited.add(appName);
      return;
    }

    // Resolve dependencies first
    const dependsOn = appJobs[0]?.app.depends_on || [];
    for (const depAppName of dependsOn) {
      if (!appNameToJobs.has(depAppName)) {
        throw new Error(`Dependency app '${depAppName}' not found for app '${appName}'`);
      }
      resolveApp(depAppName);
    }

    // Add this app's jobs after dependencies
    resolvedJobs.push(...appJobs);

    visiting.delete(appName);
    visited.add(appName);
  };

  // Resolve all apps
  for (const appName of appNameToJobs.keys()) {
    resolveApp(appName);
  }

  return resolvedJobs;
};