import { Jobs } from '@monotonix/schema';

export const calculateEffectiveTimestamps = (jobs: Jobs): Jobs => {
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
  
  const calculateEffectiveTimestamp = (appName: string): number => {
    if (effectiveTimestamps.has(appName)) {
      return effectiveTimestamps.get(appName)!;
    }
    
    if (visiting.has(appName)) {
      throw new Error(`Circular dependency detected involving app: ${appName}`);
    }
    
    visiting.add(appName);
    
    const appJobs = appNameToJobs.get(appName);
    if (!appJobs || appJobs.length === 0) {
      visiting.delete(appName);
      visited.add(appName);
      return 0;
    }
    
    // Start with this app's own max timestamp
    let maxTimestamp = appNameToMaxTimestamp.get(appName) || 0;
    
    // Check dependencies
    const dependsOn = appJobs[0]?.app.depends_on || [];
    for (const depAppName of dependsOn) {
      if (!appNameToJobs.has(depAppName)) {
        throw new Error(`Dependency app '${depAppName}' not found for app '${appName}'`);
      }
      const depTimestamp = calculateEffectiveTimestamp(depAppName);
      maxTimestamp = Math.max(maxTimestamp, depTimestamp);
    }
    
    effectiveTimestamps.set(appName, maxTimestamp);
    visiting.delete(appName);
    visited.add(appName);
    
    return maxTimestamp;
  };
  
  // Calculate effective timestamps for all apps
  for (const appName of appNameToJobs.keys()) {
    calculateEffectiveTimestamp(appName);
  }
  
  // Update jobs with effective timestamps
  return jobs.map(job => {
    const appName = job.app.name;
    const effectiveTimestamp = effectiveTimestamps.get(appName) || job.context.last_commit.timestamp;
    
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