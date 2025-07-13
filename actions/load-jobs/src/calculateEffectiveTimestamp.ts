import { Jobs } from '@monotonix/schema';
import { getLastCommit } from './getLastCommit';

export const calculateEffectiveTimestamps = async (
  jobs: Jobs,
  appNameToPath: Map<string, string>
): Promise<Jobs> => {
  // Create maps for quick lookup
  const appNameToJobs = new Map<string, typeof jobs>();
  const appNameToMaxTimestamp = new Map<string, number>();

  // Group jobs by app name and calculate initial max timestamp per app
  for (const job of jobs) {
    const appName = job.app.name;
    const timestamp = job.context.last_commit.timestamp;

    if (!appNameToJobs.has(appName)) {
      appNameToJobs.set(appName, []);
    }
    appNameToJobs.get(appName)!.push(job);

    const currentMax = appNameToMaxTimestamp.get(appName) || 0;
    appNameToMaxTimestamp.set(appName, Math.max(currentMax, timestamp));
  }

  // Calculate effective timestamps considering dependencies
  const effectiveTimestamps = new Map<string, number>();
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const calculateEffectiveTimestamp = async (appName: string): Promise<number> => {
    if (effectiveTimestamps.has(appName)) {
      return effectiveTimestamps.get(appName)!;
    }

    if (visiting.has(appName)) {
      throw new Error(`Circular dependency detected involving app: ${appName}`);
    }

    visiting.add(appName);

    const appJobs = appNameToJobs.get(appName);
    if (!appJobs || appJobs.length === 0) {
      // If app has no jobs in current workflow, but path is known, get its commit info
      const appPath = appNameToPath.get(appName);
      if (appPath) {
        console.log(`🔍 [DEBUG] Fetching commit info for dependency app '${appName}' at path '${appPath}'`);
        try {
          const commitInfo = await getLastCommit(appPath);
          const timestamp = commitInfo.timestamp;
          effectiveTimestamps.set(appName, timestamp);
          visiting.delete(appName);
          visited.add(appName);
          return timestamp;
        } catch (err) {
          console.warn(`⚠️  Failed to get commit info for dependency app '${appName}': ${err}`);
        }
      }
      visiting.delete(appName);
      visited.add(appName);
      return 0;
    }

    // Start with this app's own max timestamp
    let maxTimestamp = appNameToMaxTimestamp.get(appName) || 0;

    // Check dependencies
    const dependsOn = appJobs[0]?.app.depends_on || [];
    for (const depAppName of dependsOn) {
      const depTimestamp = await calculateEffectiveTimestamp(depAppName);
      maxTimestamp = Math.max(maxTimestamp, depTimestamp);
    }

    effectiveTimestamps.set(appName, maxTimestamp);
    visiting.delete(appName);
    visited.add(appName);

    return maxTimestamp;
  };

  // Calculate effective timestamps for all apps
  for (const appName of appNameToJobs.keys()) {
    await calculateEffectiveTimestamp(appName);
  }

  // Update jobs with effective timestamps
  return jobs.map(job => {
    const appName = job.app.name;
    const effectiveTimestamp =
      effectiveTimestamps.get(appName) || job.context.last_commit.timestamp;

    return {
      ...job,
      context: {
        ...job.context,
        last_commit: {
          ...job.context.last_commit,
          timestamp: effectiveTimestamp,
        },
      },
    };
  });
};
