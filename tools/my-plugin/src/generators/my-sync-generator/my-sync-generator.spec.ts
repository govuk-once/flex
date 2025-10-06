import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readProjectConfiguration } from '@nx/devkit';

import { mySyncGeneratorGenerator } from './my-sync-generator';
import { MySyncGeneratorGeneratorSchema } from './schema';

describe('my-sync-generator generator', () => {
  let tree: Tree;
  const options: MySyncGeneratorGeneratorSchema = { name: 'test' };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should run successfully', async () => {
    await mySyncGeneratorGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });
});
