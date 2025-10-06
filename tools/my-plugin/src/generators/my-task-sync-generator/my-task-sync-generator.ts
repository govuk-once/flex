import { Tree, createProjectGraphAsync, joinPathFragments } from '@nx/devkit';
import { MyTaskSyncGeneratorGeneratorSchema } from './schema';

export async function myTaskSyncGeneratorGenerator(
  tree: Tree,
  options: MyTaskSyncGeneratorGeneratorSchema,
) {
  const projectGraph = await createProjectGraphAsync();
  console.log("Updating license.txt files for all projects");
  Object.values(projectGraph.nodes).forEach((project) => {
    tree.write(
      joinPathFragments(project.data.root, 'license.txt'),
      `${project.name} uses the GNU license.`
    );
  });
  return {
    outOfSyncMessage: 'Some projects are missing a license.txt file.',
  };
}

export default myTaskSyncGeneratorGenerator;
