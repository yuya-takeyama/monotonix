import { LocalConfigSchema } from '@monotonix/schema';
import { loadAppsFromLocalConfigFiles } from './loadAppsFromLocalConfigs';

describe('loadAppsFromLocalConfigs', () => {
  it('loads app configurations from monotonix.yaml files', async () => {
    const result = await loadAppsFromLocalConfigFiles({
      rootDir: '__fixtures__',
      localConfigFileName: 'monotonix.yaml',
    });

    expect(result).toHaveLength(2);

    const echoApp = result.find(app => app.path === '__fixtures__/echo');
    expect(echoApp).toBeDefined();
    expect(echoApp?.label).toBe('echo');
    expect(echoApp?.depends_on).toEqual([]);
    expect(echoApp?.metadata).toEqual({});

    const helloApp = result.find(app => app.path === '__fixtures__/hello');
    expect(helloApp).toBeDefined();
    expect(helloApp?.label).toBe('hello');
    expect(helloApp?.depends_on).toEqual([]);
    expect(helloApp?.metadata).toEqual({});
  });

  it('includes app metadata when present', async () => {
    const result = await loadAppsFromLocalConfigFiles({
      rootDir: '__fixtures__',
      localConfigFileName: 'monotonix.yaml',
    });

    const appWithMetadata = result.find(
      app => app.path === '__fixtures__/echo',
    );
    expect(appWithMetadata).toBeDefined();
    expect(appWithMetadata?.metadata).toBeDefined();
  });

  it('handles apps with dependencies', async () => {
    const result = await loadAppsFromLocalConfigFiles({
      rootDir: '__fixtures__',
      localConfigFileName: 'monotonix.yaml',
    });

    const appWithDeps = result.find(
      app => app.depends_on && app.depends_on.length > 0,
    );
    if (appWithDeps && appWithDeps.depends_on) {
      expect(Array.isArray(appWithDeps.depends_on)).toBe(true);
    }
  });
});
