import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { myTaskSyncGeneratorGenerator } from './my-task-sync-generator';
import { MyTaskSyncGeneratorGeneratorSchema } from './schema';

describe('my-task-sync-generator generator', () => {
  let tree: Tree;
  const options: MyTaskSyncGeneratorGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await myTaskSyncGeneratorGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
