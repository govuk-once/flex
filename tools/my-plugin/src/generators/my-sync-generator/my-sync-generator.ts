import {
  createProjectGraphAsync,
  joinPathFragments,
  Tree,
} from '@nx/devkit';
import { MySyncGeneratorGeneratorSchema } from './schema';

export async function mySyncGeneratorGenerator(
  tree: Tree,
  options: MySyncGeneratorGeneratorSchema,
) {
  const projectGraph = await createProjectGraphAsync();
  Object.values(projectGraph.nodes).forEach((project) => {
    tree.write(
      joinPathFragments(project.data.root, 'license.txt'),
      `${project.name} uses the Acme Corp license.`
    );
  });
  return {
    outOfSyncMessage: 'Some projects are missing a license.txt file.',
  };
}

export default mySyncGeneratorGenerator;
